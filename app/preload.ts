import { contextBridge } from "electron";
import { systemApi } from "@/preload/api/system";
import { foldersApi } from "@/preload/api/folders";
import { networkProxyApi } from "@/preload/api/proxy";
import { confirmationApi } from "@/preload/api/confirmation";
import { setupApi } from "@/preload/api/setup";
import { updateApi } from "@/preload/api/updates";
import { rpcApi } from "@/preload/api/rpc";
import { shortcutsApi } from "@/preload/api/shortcuts";
import { authApi } from "@/preload/api/auth";
import { portalApi, menuPortalApi } from "@/preload/api/portal";
import { persistenceApi } from "@/preload/api/database";
import {
  appActionsApi,
  findInPageApi,
  siteInfoApi,
  clipboardApi,
  addressBarMenuApi,
  tabsApi,
  browserMenuApi,
  pageMenuApi,
  titlebarMenuApi,
} from "@/preload/api/browser";
import { windowStateApi } from "@/preload/api/window";
import { downloadsApi } from "@/preload/api/downloads";
import { lifecycleApi } from "@/preload/api/lifecycle";
import { shieldsApi } from "@/preload/api/shields";

const electronAPI = {
  system: systemApi,
  folders: foldersApi,
  networkProxy: networkProxyApi,
  confirmation: confirmationApi,
  setup: setupApi,
  updates: updateApi,
  rpc: rpcApi,
  lifecycle: lifecycleApi,
  shields: shieldsApi,
  shortcuts: shortcutsApi,
  downloads: downloadsApi,
  auth: authApi,
  portal: portalApi,
  menuPortal: menuPortalApi,
  persistence: persistenceApi,
  appActions: appActionsApi,
  findInPage: findInPageApi,
  siteInfo: siteInfoApi,
  clipboard: clipboardApi,
  addressBarMenu: addressBarMenuApi,
  tabs: tabsApi,
  browserMenu: browserMenuApi,
  pageMenu: pageMenuApi,
  titlebarMenu: titlebarMenuApi,
  windowState: windowStateApi,
};
contextBridge.exposeInMainWorld("electronAPI", electronAPI);
