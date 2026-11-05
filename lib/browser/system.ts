import { z } from "@gorth-io/structure/cores/zod";

export function normalizeActiveSite(input: string): string {
  const url = new URL(input.includes("://") ? input : `https://${input}`);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.port
  )
    throw new Error("Enter a website hostname, for example example.com.");
  return url.hostname.toLowerCase();
}
export const systemPreferencesSchema = z
  .object({
    hardwareAcceleration: z.boolean(),
    closeLastTab: z.boolean(),
    warnMultipleTabs: z.boolean(),
    warnQuit: z.boolean(),
    fullscreenReminder: z.boolean(),
    activeSites: z
      .array(
        z
          .string()
          .max(253)
          .refine((value) => {
            try {
              normalizeActiveSite(value);
              return true;
            } catch {
              return false;
            }
          }, "Enter a website hostname.")
          .transform(normalizeActiveSite),
      )
      .max(200),
    energySaver: z.boolean(),
    energyMode: z.enum(["low-battery", "unplugged"]),
  })
  .strict();
export type SystemPreferences = z.infer<typeof systemPreferencesSchema>;
export const defaultSystemPreferences: SystemPreferences = {
  hardwareAcceleration: true,
  closeLastTab: true,
  warnMultipleTabs: true,
  warnQuit: false,
  fullscreenReminder: true,
  activeSites: [],
  energySaver: true,
  energyMode: "low-battery",
};
export interface BatteryState {
  onBattery: boolean | null;
  percent: number | null;
}
export interface SystemSnapshot {
  preferences: SystemPreferences;
  battery: BatteryState;
  energyActive: boolean;
  restartRequired: boolean;
}
export function isAlwaysActive(url: string, sites: string[]): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return sites.some((site) => host === site || host.endsWith(`.${site}`));
  } catch {
    return false;
  }
}
export function energySaverActive(
  preferences: SystemPreferences,
  battery: BatteryState,
): boolean {
  return (
    preferences.energySaver &&
    battery.onBattery === true &&
    (preferences.energyMode === "unplugged" ||
      (battery.percent !== null && battery.percent <= 20))
  );
}
export function effectiveSleepPreferences(
  preferences: { sleepAfterMinutes: number; flags: Record<string, boolean> },
  energyActive: boolean,
) {
  return {
    memorySaver: preferences.flags.memorySaver || energyActive,
    sleepAfterMinutes: energyActive
      ? Math.min(preferences.sleepAfterMinutes, 5)
      : preferences.sleepAfterMinutes,
  };
}
export const memoryModes = [
  {
    value: "moderate",
    minutes: 60,
    title: "Moderate",
    description: "Save memory after tabs have been inactive for 60 minutes.",
  },
  {
    value: "balanced",
    minutes: 15,
    title: "Balanced (recommended)",
    description: "Balance memory savings by unloading tabs after 15 minutes.",
  },
  {
    value: "maximum",
    minutes: 5,
    title: "Maximum",
    description: "Save more memory by unloading inactive tabs after 5 minutes.",
  },
] as const;
