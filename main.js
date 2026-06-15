const { app, BrowserWindow, ipcMain, net, session } = require('electron');

const path = require('path');
const fs = require('fs');
const { createConsola } = require('consola');

const DATA_FILE = path.join(app.getPath('userData'), 'app_data.json');
const logger = createConsola({
    level: 4, // Info, success, warn, error
});

// Keep track of active scheduling routines
const activeSchedules = new Map();

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    if (app.isPackaged) {
        win.loadFile(path.join(__dirname, 'dist/index.html'));
    } else {
        win.loadURL('http://localhost:5173');
    }
}

app.whenReady().then(createWindow);

function clearSchedule(sessionId, webContents) {
    const schedule = activeSchedules.get(sessionId);
    if (schedule) {
        if (schedule.startTimeout) clearTimeout(schedule.startTimeout);
        if (schedule.interval) clearInterval(schedule.interval);
        if (schedule.endTimeout) clearTimeout(schedule.endTimeout);
        activeSchedules.delete(sessionId);

        logger.info(`Session ${sessionId} stopped.`);

        // Perfect Sync Event Notification
        if (webContents) {
            webContents.send('session-stopped', { sessionId });
        }
    }
}

// --- IPC Handlers for Parsing and Data Persistence ---
function parseCookieString(str, cookiesArray) {
    str.split(';').forEach(p => {
        const [name, ...val] = p.split('=');
        if (name && name.trim()) {
            cookiesArray.push({
                name: name.trim(),
                value: val.join('=').trim().replace(/^['"]|['"]$/g, '')
            });
        }
    });
}
function parseNativeCurlCommand(curlString) {
    // Standardize multi-line breaks out of standard terminal captures
    const cleanCurl = curlString.replace(/\\\r?\n/g, ' ').trim();

    const args = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = null;

    // Tokenize string while preserving shell quote groupings
    for (let i = 0; i < cleanCurl.length; i++) {
        const char = cleanCurl[i];
        if ((char === '"' || char === "'") && (i === 0 || cleanCurl[i - 1] !== '\\')) {
            if (inQuotes && char === quoteChar) {
                inQuotes = false;
                quoteChar = null;
            } else if (!inQuotes) {
                inQuotes = true;
                quoteChar = char;
            } else {
                current += char;
            }
        } else if (char === ' ' && !inQuotes) {
            if (current) {
                args.push(current);
                current = '';
            }
        } else {
            current += char;
        }
    }
    if (current) args.push(current);

    let url = '';
    let method = 'GET';
    const headers = [];
    let body = '';
    const cookies = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === 'curl') continue;

        if (arg === '-X' || arg === '--request') {
            method = args[++i]?.toUpperCase() || 'GET';
        } else if (arg === '-H' || arg === '--header') {
            const headerStr = args[++i] || '';
            const colonIdx = headerStr.indexOf(':');
            if (colonIdx !== -1) {
                const key = headerStr.substring(0, colonIdx).trim();
                const value = headerStr.substring(colonIdx + 1).trim();
                if (key.toLowerCase() === 'cookie') {
                    parseCookieString(value, cookies);
                } else {
                    headers.push({ key, value });
                }
            }
        } else if (arg === '-b' || arg === '--cookie') {
            const cookieStr = args[++i] || '';
            parseCookieString(cookieStr, cookies);
        } else if (['-d', '--data', '--data-raw', '--data-binary'].includes(arg)) {
            body = args[++i] || '';
            if (method === 'GET') method = 'POST'; // cURL switches to POST implicitly when payload properties exist
        } else if (!arg.startsWith('-')) {
            if (!url || arg.startsWith('http://') || arg.startsWith('https://')) {
                url = arg.replace(/^['"]|['"]$/g, '');
            }
        }
    }

    return { url, method, headers, body, cookies };
}
ipcMain.handle('parse-curl', async (event, curlString) => {
    try {
        const parsed = parseNativeCurlCommand(curlString);
        return {
            success: true,
            data: {
                url: parsed.url,
                method: parsed.method,
                headers: parsed.headers,
                body: parsed.body,
                cookies: parsed.cookies
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-data', async () => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf-8');
            return JSON.parse(data);
        }
        return { sessions: [] };
    } catch (error) {
        logger.error('Failed to load local data files:', error);
        return { sessions: [] };
    }
});

ipcMain.handle('save-data', async (event, data) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
        return { success: true };
    } catch (error) {
        logger.error('Failed to write updates to disk storage:', error);
        return { success: false, error: error.message };
    }
});

// --- IPC Handlers for Native Cookie Management ---

ipcMain.handle('set-global-cookies', async (event, cookiesArray) => {
    try {
        for (const cookie of cookiesArray) {
            const cleanDomain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
            const url = `https://${cleanDomain}${cookie.path || '/'}`;

            const cookieData = {
                url: url,
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain,
                path: cookie.path,
                secure: !!cookie.secure,
                httpOnly: !!cookie.httpOnly,
                sameSite: cookie.sameSite === 'unspecified' ? undefined : cookie.sameSite
            };

            await session.defaultSession.cookies.set(cookieData);
        }
        logger.info(`[Cookies] Successfully injected ${cookiesArray.length} cookies.`);
        return { success: true };
    } catch (error) {
        logger.error('[Cookies] Failed processing bulk injection context:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-cookies', async () => {
    return await session.defaultSession.cookies.get({});
});

ipcMain.handle('remove-cookie', async (event, { url, name }) => {
    await session.defaultSession.cookies.remove(url, name);
    return { success: true };
});

// --- Execution and Scheduling Pipeline Engine ---

ipcMain.handle('start-session', async (event, sessionConfig) => {
    clearSchedule(sessionConfig.id, event.sender);

    const now = Date.now();
    const startTime = sessionConfig.startTime ? new Date(sessionConfig.startTime).getTime() : now;
    const endTime = sessionConfig.endTime ? new Date(sessionConfig.endTime).getTime() : null;
    
    // FIX 1: Read the correct form parameter interval property explicitly safely
    const intervalMs = sessionConfig.intervalMs ? Number(sessionConfig.intervalMs) : 5000;

    if (endTime && endTime <= now) {
        return { success: false, error: 'Specified expiration runtime context is set in the past.' };
    }

    const scheduleState = { startTimeout: null, interval: null, endTimeout: null };

    const executeRequest = async () => {
        logger.start(`[${sessionConfig.name}] Dispatching runner to destination target: ${sessionConfig.url}`);

        const globalCookies = await session.defaultSession.cookies.get({ url: sessionConfig.url });
        let cookieMap = new Map();
        globalCookies.forEach(c => cookieMap.set(c.name, c.value));

        if (sessionConfig.cookies && Array.isArray(sessionConfig.cookies)) {
            sessionConfig.cookies.forEach(c => {
                if (c.key) cookieMap.set(c.key, c.value); // Map form schema correctly
            });
        }

        const cookieString = Array.from(cookieMap.entries())
            .map(([name, value]) => `${name}=${value}`)
            .join('; ');

        const request = net.request({ method: sessionConfig.method.toUpperCase(), url: sessionConfig.url });

        if (cookieString) {
            request.setHeader('Cookie', cookieString);
        }

        // Keep track of user headers
        let hasContentType = false;
        if (sessionConfig.headers) {
            sessionConfig.headers.forEach(h => {
                if (h.key && h.value) {
                    request.setHeader(h.key, h.value);
                    if (h.key.toLowerCase() === 'content-type') hasContentType = true;
                }
            });
        }

        // FIX 3: Robust nested payload execution checking configurations safely
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(sessionConfig.method.toUpperCase()) && sessionConfig.body) {
            let bodyData = sessionConfig.body;
            
            // If body is passing down a raw string, use it directly
            if (typeof bodyData === 'object') {
                bodyData = JSON.stringify(bodyData);
            }

            // Auto-inject JSON application header safely if the user has omitted it
            if (!hasContentType && bodyData.trim().startsWith('{')) {
                request.setHeader('Content-Type', 'application/json');
            }

            request.write(bodyData, 'utf-8');
        }

        request.on('response', (response) => {
            let responseData = '';
            response.on('data', (chunk) => { responseData += chunk; });
            response.on('end', () => {
                logger.info(`[${sessionConfig.name}] Response code verification completed: ${response.statusCode}`);
                event.sender.send('backend-log', {
                    type: response.statusCode >= 400 ? 'error' : 'success',
                    message: `[${sessionConfig.name}] Status ${response.statusCode} - ${responseData.substring(0, 200)}`,
                    timestamp: Date.now(),
                    sessionId: sessionConfig.id
                });

                if (sessionConfig.stopOnError && response.statusCode >= 400) {
                    clearSchedule(sessionConfig.id, event.sender);
                }
            });
        });

        request.on('error', (err) => {
            logger.error(`[${sessionConfig.name}] Active runtime instance experienced execution failure:`, err);
            event.sender.send('backend-log', {
                type: 'error',
                message: `[${sessionConfig.name}] Critical network failure: ${err.message}`,
                timestamp: Date.now(),
                sessionId: sessionConfig.id
            });
            if (sessionConfig.stopOnError) clearSchedule(sessionConfig.id, event.sender);
        });

        request.end();
    };

    const beginInterval = () => {
        logger.info(`Initializing cycle configuration for request profile matching ${sessionConfig.name}`);
        executeRequest();
        scheduleState.interval = setInterval(executeRequest, intervalMs);
    };

    const timeUntilStart = startTime - now;
    if (timeUntilStart <= 0) {
        beginInterval();
    } else {
        const delaySecs = Math.round(timeUntilStart / 1000);
        event.sender.send('backend-log', {
            type: 'info',
            message: `Armed: Loop execution will start automatically in ${delaySecs}s`,
            timestamp: Date.now(),
            sessionId: sessionConfig.id
        });
        scheduleState.startTimeout = setTimeout(beginInterval, timeUntilStart);
    }

    if (endTime) {
        scheduleState.endTimeout = setTimeout(() => {
            clearSchedule(sessionConfig.id, event.sender);
        }, endTime - now);
    }

    activeSchedules.set(sessionConfig.id, scheduleState);
    return { success: true };
});

ipcMain.handle('stop-session', (event, sessionId) => {
    clearSchedule(sessionId, event.sender);
    return { success: true };
});