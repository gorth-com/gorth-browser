import { rawReadBrowserSetting, rawWriteBrowserSetting } from "@/models/setting"
import {
  defaultSystemPreferences,
  systemPreferencesSchema,
} from "@/lib/browser/system";

export function getSystemPreferences() {
  const result = systemPreferencesSchema.safeParse(
    rawReadBrowserSetting("systemPreferences", defaultSystemPreferences),
  );
  return result.success
    ? result.data
    : { ...defaultSystemPreferences, activeSites: [] };
}
export function saveSystemPreferences(input: unknown) {
  const preferences = systemPreferencesSchema.parse(input);
  preferences.activeSites = [...new Set(preferences.activeSites)];
  rawWriteBrowserSetting("systemPreferences", preferences);
  return preferences;
}
