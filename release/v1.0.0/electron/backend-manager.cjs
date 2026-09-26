/**
 * Ambika Trading — Electron Backend Manager
 *
 * Spawns and manages the Python FastAPI backend process.
 * Monitors health and gracefully shuts down the process on exit.
 */

const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

let backendProcess = null;
const BACKEND_PORT = 8741;
const HEALTH_URL = `http://127.0.0.1:${BACKEND_PORT}/api/health`;

/**
 * Checks if the backend health endpoint responds with HTTP 200.
 */
function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => {
      resolve(false);
    });
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Wait until backend is healthy or timeout occurs.
 */
async function waitForBackend(maxRetries = 25, delayMs = 600) {
  for (let i = 0; i < maxRetries; i++) {
    const healthy = await checkHealth();
    if (healthy) {
      console.log('[Backend] Health check passed.');
      return true;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

/**
 * Starts the Python backend if not already running.
 */
async function startBackend(isDev) {
  // First verify if backend is already running (e.g. started by dev script)
  const alreadyRunning = await checkHealth();
  if (alreadyRunning) {
    console.log('[Backend] Backend already running on port', BACKEND_PORT);
    return true;
  }

  const backendDir = path.resolve(__dirname, '..', 'backend');
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

  console.log(`[Backend] Starting FastAPI from ${backendDir}...`);
  backendProcess = spawn(pythonCmd, ['main.py'], {
    cwd: backendDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    windowsHide: true,
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`[FastAPI stdout] ${data.toString().trim()}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`[FastAPI stderr] ${data.toString().trim()}`);
  });

  backendProcess.on('exit', (code, signal) => {
    console.log(`[Backend] Process exited with code ${code}, signal ${signal}`);
    backendProcess = null;
  });

  const healthy = await waitForBackend();
  if (!healthy) {
    console.warn('[Backend] Backend did not respond within timeout, proceeding anyway.');
  }
  return healthy;
}

/**
 * Stops the backend process cleanly on Windows.
 */
function stopBackend() {
  if (!backendProcess || !backendProcess.pid) return;

  const pid = backendProcess.pid;
  console.log(`[Backend] Stopping process tree for PID ${pid}...`);

  try {
    if (process.platform === 'win32') {
      // Force kill child process tree on Windows
      spawn('taskkill', ['/pid', pid.toString(), '/T', '/F'], {
        windowsHide: true,
      });
    } else {
      process.kill(-pid, 'SIGTERM');
    }
  } catch (err) {
    console.error('[Backend] Error terminating backend process:', err);
  }
  backendProcess = null;
}

module.exports = {
  startBackend,
  stopBackend,
  checkHealth,
  BACKEND_PORT,
};
