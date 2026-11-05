// Isolate the window-factory smoke test from the database, network and tab timers.
// Electron, the actual capital window/portal host and application preload are real.
export function loadWindowState() {
  return null;
}
export function readBrowserSetting<Value>(
  _key: string,
  fallback: Value,
): Value {
  return fallback;
}
export function writeBrowserSetting() {}
export function saveWindowState() {}
export function setWindowOpen() {}
export function trackTabLifecycle() {}
export function captureTabNavigation() {}
export function registerBlockerContents() {}
export function dismissPortalMenuForParent() {}
export async function showPageContextMenu() {
  return null;
}
