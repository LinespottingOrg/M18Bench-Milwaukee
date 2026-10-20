const { app, BrowserWindow, session } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const port = 39218;
let child = null;

function startServer() {
  child = spawn(process.execPath, [path.join(__dirname, "serve.mjs")], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", PORT: String(port), NODE_ENV: "production" },
    stdio: "ignore",
    windowsHide: true,
  });
}

function waitForBench() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const req = http.get({ host: "127.0.0.1", port, path: "/" }, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) resolve();
        else if (Date.now() - started > 20000) reject(new Error("The bench page did not open."));
        else setTimeout(tick, 200);
      });
      req.on("error", () => {
        if (Date.now() - started > 20000) reject(new Error("The bench did not start."));
        else setTimeout(tick, 200);
      });
    };
    tick();
  });
}

function stopServer() {
  if (child && !child.killed) child.kill();
  child = null;
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === "serial" || permission === "usb" || permission === "media");
  });
  if (typeof session.defaultSession.setDevicePermissionHandler === "function") {
    session.defaultSession.setDevicePermissionHandler(() => true);
  }
  startServer();
  await waitForBench();
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#141210",
    autoHideMenuBar: true,
    title: "M18 Bench",
  });
  window.removeMenu();
  await window.loadURL(`http://127.0.0.1:${port}/`);
});

app.on("before-quit", stopServer);
app.on("window-all-closed", () => {
  stopServer();
  app.quit();
});
