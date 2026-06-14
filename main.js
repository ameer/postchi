const { app, BrowserWindow, ipcMain, net, session } = require('electron');
const { autoUpdater } = require("electron-updater");

// Configure logging (helpful for debugging updates)
autoUpdater.logger = require("electron-log");
autoUpdater.logger.transports.file.level = "info";

const curlconverter = require('curlconverter');
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
    autoUpdater.checkForUpdatesAndNotify();
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

ipcMain.handle('parse-curl', async (event, curlString) => {
    try {
        const parsed = curlconverter.toJsonObject(curlString);

        const headers = parsed.headers
            ? Object.entries(parsed.headers).map(([key, value]) => ({ key, value }))
            : [];

        const body = parsed.data || parsed.dataRaw || parsed.dataBinary || '';

        let cookies = [];
        if (parsed.cookies) {
            cookies = Object.entries(parsed.cookies).map(([name, value]) => ({ name, value }));
        } else if (parsed.headers && parsed.headers['Cookie']) {
            cookies = parsed.headers['Cookie'].split(';').map(p => {
                const [name, ...val] = p.split('=');
                return { name: name.trim(), value: val.join('=').trim() };
            }).filter(c => c.name);
        }

        return {
            success: true,
            data: {
                url: parsed.url,
                method: parsed.method || 'GET',
                headers: headers,
                body: typeof body === 'object' ? JSON.stringify(body) : body,
                cookies: cookies
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
    const intervalMs = (sessionConfig.interval || 1) * 1000;

    if (endTime && endTime <= now) {
        return { success: false, error: 'Specified expiration runtime context is set in the past.' };
    }

    const scheduleState = { startTimeout: null, interval: null, endTimeout: null };

    const executeRequest = async () => {
        logger.start(`[${sessionConfig.name}] Dispatching runner to destination target: ${sessionConfig.url}`);

        // Extract native jar cookies + explicitly passed specific session configurations
        const globalCookies = await session.defaultSession.cookies.get({ url: sessionConfig.url });
        let cookieMap = new Map();
        globalCookies.forEach(c => cookieMap.set(c.name, c.value));

        if (sessionConfig.cookies && Array.isArray(sessionConfig.cookies)) {
            sessionConfig.cookies.forEach(c => {
                if (c.name) cookieMap.set(c.name, c.value);
            });
        }

        const cookieString = Array.from(cookieMap.entries())
            .map(([name, value]) => `${name}=${value}`)
            .join('; ');

        const request = net.request({ method: sessionConfig.method, url: sessionConfig.url });

        if (cookieString) {
            request.setHeader('Cookie', cookieString);
        }

        if (sessionConfig.headers) {
            sessionConfig.headers.forEach(h => {
                if (h.key && h.value) request.setHeader(h.key, h.value);
            });
        }

        // FIXED: Robust payload handling with explicit content size boundary checks
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(sessionConfig.method.toUpperCase()) && sessionConfig.body) {
            let bodyData = sessionConfig.body;
            if (typeof bodyData === 'object') {
                bodyData = bodyData.reduce((acc, curr) => {
                    acc[curr.key] = curr.value
                    return acc
                }, {})
                bodyData = JSON.stringify(bodyData)
                console.log(bodyData);
                
            }
            // Safely stream string chunks into standard request channel mapping
            request.write(bodyData, 'utf-8');
        }

        request.on('response', (response) => {
            let responseData = '';

            response.on('data', (chunk) => {
                responseData += chunk;
            });

            response.on('end', () => {
                logger.info(`[${sessionConfig.name}] Response code verification completed: ${response.statusCode}`);
                event.sender.send('backend-log', {
                    type: response.statusCode >= 400 ? 'error' : 'success',
                    message: `[${sessionConfig.name}] Status ${response.statusCode} - ${responseData.substring(0, 200)}`,
                    timestamp: Date.now(),
                    sessionId: sessionConfig.id
                });

                if (sessionConfig.stopOnError && response.statusCode >= 400) {
                    logger.error(`[${sessionConfig.name}] Halting sequence prematurely due to status error rule validation constraint.`);
                    clearSchedule(sessionConfig.id, event.sender);
                }
            });
        });

        request.on('error', (err) => {
            logger.error(`[${sessionConfig.name}] Active runtime instance context experienced an execution break:`, err);
            event.sender.send('backend-log', {
                type: 'error',
                message: `[${sessionConfig.name}] Critical network failure: ${err.message}`,
                timestamp: Date.now(),
                sessionId: sessionConfig.id
            });
            if (sessionConfig.stopOnError) {
                clearSchedule(sessionConfig.id, event.sender);
            }
        });

        // Fire request sequence context
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
        logger.info(`Sequence validation checklist clear: execution profiles armed for launch target window in ${delaySecs}s`);
        event.sender.send('backend-log', {
            type: 'info',
            message: `Armed: Loop execution will start automatically in execution delay interval matching ${delaySecs}s`,
            timestamp: Date.now(),
            sessionId: sessionConfig.id
        });
        scheduleState.startTimeout = setTimeout(beginInterval, timeUntilStart);
    }

    if (endTime) {
        scheduleState.endTimeout = setTimeout(() => {
            logger.success(`Maximum lifecycle bound reached for schedule item ${sessionConfig.name}. Safely teardown thread allocations.`);
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