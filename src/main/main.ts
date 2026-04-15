import { app, BrowserWindow, session } from "electron";
import path from "path";
import { registerIpcHandlers } from "./ipc-handlers";

let mainWindow: BrowserWindow | null = null;
const rendererUrl = process.env.ELECTRON_RENDERER_URL;
const shouldOpenDevTools = process.env.AJCANNON_OPEN_DEVTOOLS === "1";

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
    },
  });

  if (rendererUrl) {
    await mainWindow.loadURL(rendererUrl);
    if (shouldOpenDevTools) {
      mainWindow.webContents.openDevTools();
    }
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.maximize();
  mainWindow.show();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();

  // Strip headers that block embedding SQL Monitor in <webview>/<iframe>
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ["http://sqlmonitor.bank.lan:8080/*"] },
    (details, callback) => {
      const headers = { ...details.responseHeaders };
      // Remove X-Frame-Options and CSP frame-ancestors that block embedding
      for (const key of Object.keys(headers)) {
        const lower = key.toLowerCase();
        if (lower === "x-frame-options") {
          delete headers[key];
        }
      }
      callback({ responseHeaders: headers });
    },
  );

  void createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});
