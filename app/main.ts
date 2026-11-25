import path from "node:path";
import {
  initializeSystemStartup,
  quitBrowserForShutdown,
  registerSystemIpc,
  startSystemPowerMonitor,
} from "@/main/services/system";
import { registerFolderIpc } from "@/main/services/folders";
import { initializeNetworkProxy } from "@/main/services/proxy";
import { getSetupPreferences } from "@/main/services/browser-setup";
import { MAIN_WINDOW_ID } from "@/utils/constant";
import { installBrowserLinks } from "@/main/services/browser-links";
import { registerSetupIpc } from "@/main/ipc/setup";
import { registerUpdateIpc } from "@/main/services/updates";
import {
  authScheme,
  installGorthAuth,
  receiveGorthDeepLink,
} from "@/lib/auth/gorth";
import { prepareAuthProtocol } from "@/main/services/auth-protocol";
import {
  registerLoginNavigation,
  receiveLoginNavigation,
} from "@/main/services/login-navigation";
import { installDevelopmentLifecycle } from "@/main/services/development-lifecycle";
import {
  startDesktopServer,
  stopDesktopServer,
} from "@/services/desktop-server";
import { registerContextMenuIpc } from "@/main/ipc/context-menu";
import { registerBrowserIpc } from "@/main/ipc/browser";
import { registerWindowIpc } from "@/main/ipc/window";
import { registerDatabaseIpc } from "@/main/ipc/database";
import { registerRpcIpc } from "@/main/ipc/rpc";
import { configureDataDirectory } from "@/services/data-directory";
import { app, BrowserWindow, protocol, session, dialog } from "electron";
import { registerDownloadIpc } from "@/main/ipc/downloads";
import {
  installDownloadManager,
  shutdownDownloadManager,
} from "@/main/services/downloads";
import started from "electron-squirrel-startup";
import { rawCloseDatabase, rawInitializeDatabase } from "@/services/database"
import { rawLoadBrowserSnapshot } from "@/models/tab"
import { rawGetRestoredWindowIds } from "@/models/window"
import { rawReadBrowserSetting } from "@/models/setting"
import {
  initializeContentBlocker,
  stopContentBlocker,
} from "@/main/services/content-blocker";
import { registerTabLifecycleIpc } from "@/main/ipc/tab-lifecycle";
import {
  registerAuthIpc,
  cancelAuth,
  getAuthenticatedUserId,
} from "@/lib/auth/service";
import {
  APP_ID,
  APP_NAME,
  getRuntimeAppIconPath,
  createWindow,
} from "@/main/windows/capital";
import { installApplicationMenu } from "@/main/ipc/application-menu";
import { registerShortcutsIpc } from "@/main/ipc/shortcuts";
import { sendAppAction } from "@/main/ipc/native-menu";

protocol.registerSchemesAsPrivileged([
  { scheme: authScheme, privileges: { secure: true } },
  {
    scheme: "gorth",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: false,
      corsEnabled: false,
      codeCache: true,
    },
  },
]);

installDevelopmentLifecycle(
  MAIN_WINDOW_VITE_DEV_SERVER_URL,
  quitBrowserForShutdown,
);

if (started) {
  app.quit();
}

app.setName(APP_NAME);

configureDataDirectory();
async function receiveBrowserLink(url: string) {
  return receiveLoginNavigation(url) || (await receiveGorthDeepLink(url));
}
registerLoginNavigation(receiveGorthDeepLink);
// Electron permits privileged scheme registration only once, before ready.
installGorthAuth({ registerScheme: false, onDeepLink: receiveBrowserLink });
for (const argument of process.argv) {
  if (argument.startsWith(authScheme + "://auth/open?"))
    void receiveBrowserLink(argument);
}
const ownsDataDirectory = app.requestSingleInstanceLock();
if (ownsDataDirectory) installBrowserLinks();
if (!ownsDataDirectory) app.quit();
app.on("second-instance", () => {
  const window = BrowserWindow.getAllWindows().find(
    (candidate) => candidate.webContents.getURL() !== "about:blank",
  );
  if (window) {
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  }
});
// Chromium feature switches must be selected before app readiness.
if (ownsDataDirectory) {
  rawInitializeDatabase(app.getPath("userData"));
  initializeSystemStartup();
  if (
    !rawReadBrowserSetting(
      "smoothScrolling",
      rawLoadBrowserSnapshot().preferences.flags.smoothScrolling,
    )
  )
    app.commandLine.appendSwitch("disable-features", "SmoothScrolling");
}

app.setAppUserModelId(APP_ID);

app.setAboutPanelOptions({
  applicationName: APP_NAME,
  applicationVersion: app.getVersion(),
  version: app.getVersion(),
});

registerContextMenuIpc();
registerBrowserIpc();
registerWindowIpc();
registerSetupIpc();
registerDatabaseIpc();
registerRpcIpc();
registerDownloadIpc();
registerFolderIpc();
registerSystemIpc();
registerTabLifecycleIpc();

app
  .whenReady()
  .then(async () => {
    if (!ownsDataDirectory) return;
    startSystemPowerMonitor();
    await initializeNetworkProxy();
    await startDesktopServer(
      !!MAIN_WINDOW_VITE_DEV_SERVER_URL,
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`),
      getAuthenticatedUserId,
    );
    registerAuthIpc();
    registerUpdateIpc();
    installDownloadManager(session.defaultSession);
    await initializeContentBlocker();
    if (process.platform === "darwin") {
      try {
        await app.dock?.setIcon(getRuntimeAppIconPath());
      } catch (error) {
        console.warn("Unable to set the macOS Dock icon.", error);
      }
    }

    protocol.handle(
      "gorth",
      () =>
        new Response("Gorth internal page not found.", {
          status: 404,
          headers: { "content-type": "text/plain; charset=utf-8" },
        }),
    );
    registerShortcutsIpc(installApplicationMenu, (id) => {
      if (id === "new-window") createWindow();
      else sendAppAction(id);
    });
    installApplicationMenu();
    const windowIds =
      getSetupPreferences().startup === "restore"
        ? rawGetRestoredWindowIds()
        : [MAIN_WINDOW_ID];
    for (const id of windowIds) createWindow(id);
    try {
      await prepareAuthProtocol(authScheme, receiveBrowserLink);
    } catch {
      console.warn("Could not register Gorth Browser login navigation.");
    }
  })
  .catch((error: unknown) => {
    dialog.showErrorBox(
      "Gorth Browser",
      error instanceof Error
        ? error.message
        : "Không khởi động được desktop server hoặc dữ liệu ứng dụng.",
    );
    app.quit();
  });

app.on("will-quit", cancelAuth);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("will-quit", () => {
  shutdownDownloadManager();
  stopContentBlocker();
  rawCloseDatabase();
});

app.on("will-quit", stopDesktopServer);
