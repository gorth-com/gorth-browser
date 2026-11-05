import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile } from "node:fs/promises";
import type { BatteryState } from "@/lib/browser/system";
const run = promisify(execFile);
const options = { timeout: 4000, maxBuffer: 64 * 1024, windowsHide: true };

export function parseBatteryPercent(value: string): number | null {
  const match = value.match(/\b(\d{1,3})%/);
  const percent = match ? Number(match[1]) : NaN;
  return Number.isFinite(percent) && percent <= 100 ? percent : null;
}
export async function readBattery(): Promise<BatteryState> {
  try {
    if (process.platform === "darwin") {
      const { stdout } = await run("/usr/bin/pmset", ["-g", "batt"], options);
      return {
        onBattery: stdout.includes("'Battery Power'")
          ? true
          : stdout.includes("'AC Power'")
            ? false
            : null,
        percent: parseBatteryPercent(stdout),
      };
    }
    if (process.platform === "win32") {
      const { stdout } = await run(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "Get-CimInstance Win32_Battery | Select-Object EstimatedChargeRemaining,BatteryStatus | ConvertTo-Json -Compress",
        ],
        options,
      );
      const parsed: unknown = JSON.parse(stdout || "null");
      const rows = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
      const batteries = rows.filter(
        (
          row,
        ): row is { EstimatedChargeRemaining: number; BatteryStatus: number } =>
          typeof row?.EstimatedChargeRemaining === "number" &&
          typeof row?.BatteryStatus === "number",
      );
      return {
        onBattery: batteries.length
          ? batteries.some((row) => row.BatteryStatus === 1)
          : false,
        percent: batteries.length
          ? Math.min(
              ...batteries.map((row) =>
                Math.max(0, Math.min(100, row.EstimatedChargeRemaining)),
              ),
            )
          : null,
      };
    }
    const root = "/sys/class/power_supply";
    const batteries: { percent: number; discharging: boolean }[] = [];
    for (const entry of await readdir(root)) {
      const dir = `${root}/${entry}`;
      if ((await readFile(`${dir}/type`, "utf8")).trim() !== "Battery")
        continue;
      const percent = Number(
        (await readFile(`${dir}/capacity`, "utf8")).trim(),
      );
      const status = (await readFile(`${dir}/status`, "utf8")).trim();
      if (Number.isFinite(percent) && percent >= 0 && percent <= 100)
        batteries.push({ percent, discharging: status === "Discharging" });
    }
    return {
      onBattery: batteries.some((row) => row.discharging),
      percent: batteries.length
        ? Math.min(...batteries.map((row) => row.percent))
        : null,
    };
  } catch {
    return { onBattery: null, percent: null };
  }
}
