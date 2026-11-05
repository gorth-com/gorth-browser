import { contextBridge } from "electron";
import { systemApi } from "@/preload/api/system";
import { confirmationApi } from "@/preload/api/confirmation";
import { portalApi } from "@/preload/api/portal";
contextBridge.exposeInMainWorld("electronAPI", {
  system: systemApi,
  confirmation: confirmationApi,
  portal: portalApi,
  windowState: { isMacOS: process.platform === "darwin" },
});
