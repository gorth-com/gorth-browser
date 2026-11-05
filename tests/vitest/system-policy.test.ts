import { describe, expect, it } from "vitest";
import {
  defaultSystemPreferences,
  systemPreferencesSchema,
  normalizeActiveSite,
  isAlwaysActive,
  energySaverActive,
  effectiveSleepPreferences,
  memoryModes,
} from "@/lib/browser/system";
import { parseBatteryPercent } from "@/main/services/battery";
import { shouldSleepTab } from "@/lib/browser/lifecycle";

describe("System settings contracts and policies", () => {
  it("normalizes website exceptions and rejects paths, credentials and privileged protocols", () => {
    expect(normalizeActiveSite("https://EXAMPLE.com/")).toBe("example.com");
    expect(normalizeActiveSite("example.com")).toBe("example.com");
    for (const input of [
      "file:///tmp",
      "https://user:pass@example.com",
      "example.com/path",
      "example.com?token=x",
      "example.com:8080",
    ])
      expect(
        systemPreferencesSchema.safeParse({
          ...defaultSystemPreferences,
          activeSites: [input],
        }).success,
      ).toBe(false);
    expect(
      systemPreferencesSchema.safeParse({
        ...defaultSystemPreferences,
        execute: "anything",
      }).success,
    ).toBe(false);
    expect(isAlwaysActive("https://sub.example.com/a", ["example.com"])).toBe(
      true,
    );
    expect(isAlwaysActive("https://notexample.com", ["example.com"])).toBe(
      false,
    );
    expect(
      isAlwaysActive("https://example.com.evil.test", ["example.com"]),
    ).toBe(false);
  });
  it("activates low-battery saver only with known battery power and at most 20 percent", () => {
    for (const percent of [0, 19, 20])
      expect(
        energySaverActive(defaultSystemPreferences, {
          onBattery: true,
          percent,
        }),
      ).toBe(true);
    for (const battery of [
      { onBattery: true, percent: 21 },
      { onBattery: false, percent: 5 },
      { onBattery: null, percent: 5 },
      { onBattery: true, percent: null },
    ])
      expect(energySaverActive(defaultSystemPreferences, battery)).toBe(false);
    expect(
      energySaverActive(
        { ...defaultSystemPreferences, energyMode: "unplugged" },
        { onBattery: true, percent: null },
      ),
    ).toBe(true);
    expect(
      energySaverActive(
        { ...defaultSystemPreferences, energySaver: false },
        { onBattery: true, percent: 5 },
      ),
    ).toBe(false);
  });
  it("uses all three memory timeouts and never discards a protected tab", () => {
    for (const mode of memoryModes) {
      const preferences = {
        memorySaver: true,
        sleepAfterMinutes: mode.minutes,
        archiveAfterDays: 0,
      };
      const input = {
        active: false,
        pinned: false,
        grouped: false,
        internal: false,
        busy: false,
        lastActiveAt: 0,
        now: mode.minutes * 60_000,
        preferences,
      };
      expect(shouldSleepTab({ ...input, now: input.now - 1 })).toBe(false);
      expect(shouldSleepTab(input)).toBe(true);
      for (const key of ["active", "pinned", "grouped", "internal", "busy"])
        expect(shouldSleepTab({ ...input, [key]: true })).toBe(false);
    }
    const preferences = {
      flags: { memorySaver: false },
      sleepAfterMinutes: 60,
    };
    expect(effectiveSleepPreferences(preferences, true)).toEqual({
      memorySaver: true,
      sleepAfterMinutes: 5,
    });
    expect(effectiveSleepPreferences(preferences, false)).toEqual({
      memorySaver: false,
      sleepAfterMinutes: 60,
    });
    expect(
      effectiveSleepPreferences({ ...preferences, sleepAfterMinutes: 2 }, true)
        .sleepAfterMinutes,
    ).toBe(2);
  });
  it("parses native percentage without inventing a battery", () => {
    expect(parseBatteryPercent("InternalBattery-0 19%; discharging")).toBe(19);
    expect(parseBatteryPercent("InternalBattery-0 100%; charged")).toBe(100);
    expect(parseBatteryPercent("Now drawing from 'AC Power'")).toBeNull();
    expect(parseBatteryPercent("Battery 150%")).toBeNull();
  });
});
