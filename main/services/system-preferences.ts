import {
  readBrowserSetting,
  writeBrowserSetting,
} from "@/services/browser-database";
import {
  defaultSystemPreferences,
  systemPreferencesSchema,
} from "@/lib/browser/system";

export function getSystemPreferences() {
  const result = systemPreferencesSchema.safeParse(
    readBrowserSetting("systemPreferences", defaultSystemPreferences),
  );
  return result.success
    ? result.data
    : { ...defaultSystemPreferences, activeSites: [] };
}
export function saveSystemPreferences(input: unknown) {
  const preferences = systemPreferencesSchema.parse(input);
  preferences.activeSites = [...new Set(preferences.activeSites)];
  writeBrowserSetting("systemPreferences", preferences);
  return preferences;
}
