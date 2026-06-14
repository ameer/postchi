const { app, BrowserWindow, ipcMain, net, session } = require('electron');

const path = require('path');
const fs = require('fs');
const { createConsola } = require('consola');
const DATA_FILE = path.join(app.getPath('userData'), 'app_data.json');
const logger = createConsola({
  level: 4, // Info, success, warn, error
});
function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true, // Crucial for security
            nodeIntegration: false
        }
    });

    // Assuming you are using Vite for the React frontend
    win.loadURL('http://localhost:5173');
}

app.whenReady().then(createWindow);

// --- IPC Handlers for JSON Persistence ---

ipcMain.handle('load-data', () => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error("Failed to load JSON data:", error);
    }
    // Default state if file doesn't exist
    return { sessions: [], globalCookies: '' };
});

ipcMain.handle('save-data', (event, data) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        return { success: true };
    } catch (error) {
        console.error("Failed to save JSON data:", error);
        return { success: false, error: error.message };
    }
});
ipcMain.handle('set-global-cookies', async (event, { url, cookieString }) => {
    try {
        // Split standard raw cookie string into individual key/value pairs
        const cookies = cookieString.split(';').map(c => c.trim());

        for (const cookie of cookies) {
            if (!cookie) continue;
            const [name, ...rest] = cookie.split('=');
            const value = rest.join('=');

            if (name && value) {
                await session.defaultSession.cookies.set({
                    url: url, // Electron requires a valid URL to associate the cookie with a domain
                    name: name,
                    value: value
                });
            }
        }
        console.log(`[Cookies] Successfully set cookies for ${url}`);
        return { success: true };
    } catch (error) {
        console.error('[Cookies] Failed to set cookies:', error);
        return { success: false, error: error.message };
    }
});

// --- Advanced Timer & Execution Engine ---
const activeSchedules = new Map();

function clearSchedule(sessionId, webContents) {
  const schedule = activeSchedules.get(sessionId);
  if (schedule) {
    if (schedule.startTimeout) clearTimeout(schedule.startTimeout);
    if (schedule.interval) clearInterval(schedule.interval);
    if (schedule.endTimeout) clearTimeout(schedule.endTimeout);
    activeSchedules.delete(sessionId);
    
    const msg = `Session ${sessionId} stopped.`;
    logger.info(msg);
    if (webContents) webContents.send('backend-log', { type: 'info', message: msg, timestamp: Date.now(), sessionId });
  }
}

// NOTE: We now use 'event.sender' to pipe logs back to the window
ipcMain.handle('start-session', (event, sessionConfig) => {
  clearSchedule(sessionConfig.id, event.sender);

  const now = Date.now();
  const startTime = sessionConfig.startTime ? new Date(sessionConfig.startTime).getTime() : now;
  const endTime = sessionConfig.endTime ? new Date(sessionConfig.endTime).getTime() : null;
  const intervalMs = parseInt(sessionConfig.intervalMs, 10) || 5000;

  if (endTime && endTime <= now) {
    logger.warn(`Rejected: End time for ${sessionConfig.name} is in the past.`);
    return { success: false, message: 'End time passed' };
  }

  const scheduleState = { startTimeout: null, interval: null, endTimeout: null };

  const executeRequest = () => {
    const timeStr = new Date().toLocaleTimeString();
    logger.start(`[${sessionConfig.name}] Requesting ${sessionConfig.url}`);
    
    const request = net.request({ method: sessionConfig.method, url: sessionConfig.url });
    
    if (sessionConfig.headers) {
      sessionConfig.headers.forEach(h => {
        if (h.key && h.value) request.setHeader(h.key, h.value);
      });
    }

    request.on('response', (response) => {
      const isError = response.statusCode >= 400;
      const isSuccess = response.statusCode >= 200 && response.statusCode < 300;
      const logMsg = `[${sessionConfig.name}] Status: ${response.statusCode}`;
      
      if (isError) logger.error(logMsg);
      else if (isSuccess) logger.success(logMsg);
      else logger.info(logMsg); // For 1xx and 3xx

      // Pipe standard response to frontend
      event.sender.send('backend-log', {
        type: isError ? 'error' : (isSuccess ? 'success' : 'warn'),
        message: `${sessionConfig.method} ${sessionConfig.url} - Status: ${response.statusCode}`,
        timestamp: Date.now(),
        sessionId: sessionConfig.id
      });

      // NEW: Stop on HTTP Error Logic
      if (sessionConfig.stopOnError && isError) {
        logger.error(`[${sessionConfig.name}] Auto-halting due to HTTP ${response.statusCode}.`);
        event.sender.send('backend-log', {
          type: 'error',
          message: `🛑 Session Auto-Halted (HTTP ${response.statusCode} Trigger)`,
          timestamp: Date.now(),
          sessionId: sessionConfig.id
        });
        clearSchedule(sessionConfig.id, event.sender);
      }

      response.on('data', () => {}); // Consume stream
    });
    
    request.on('error', (error) => {
      logger.error(`[${sessionConfig.name}] Network Error:`, error.message);
      event.sender.send('backend-log', {
        type: 'error',
        message: `Network Error: ${error.message}`,
        timestamp: Date.now(),
        sessionId: sessionConfig.id
      });

      // NEW: Stop on raw network/DNS errors as well
      if (sessionConfig.stopOnError) {
        logger.error(`[${sessionConfig.name}] Auto-halting due to Network Error.`);
        event.sender.send('backend-log', {
          type: 'error',
          message: `🛑 Session Auto-Halted (Network Error Trigger)`,
          timestamp: Date.now(),
          sessionId: sessionConfig.id
        });
        clearSchedule(sessionConfig.id, event.sender);
      }
    });
    
    if (sessionConfig.body && ['POST', 'PUT', 'PATCH'].includes(sessionConfig.method)) {
      request.write(sessionConfig.body);
    }
    request.end();
  };

  const beginInterval = () => {
    logger.info(`Starting interval for ${sessionConfig.name}`);
    executeRequest();
    scheduleState.interval = setInterval(executeRequest, intervalMs);
  };

  const timeUntilStart = startTime - now;
  if (timeUntilStart <= 0) {
    beginInterval();
  } else {
    const delaySecs = Math.round(timeUntilStart / 1000);
    logger.info(`Armed: ${sessionConfig.name} starts in ${delaySecs}s`);
    event.sender.send('backend-log', { type: 'info', message: `Armed: Will start in ${delaySecs}s`, timestamp: Date.now(), sessionId: sessionConfig.id });
    scheduleState.startTimeout = setTimeout(beginInterval, timeUntilStart);
  }

  if (endTime) {
    scheduleState.endTimeout = setTimeout(() => {
      logger.success(`End time reached for ${sessionConfig.name}`);
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