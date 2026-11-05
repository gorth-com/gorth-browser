import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { settingsPagesFirst } from "@/utils/constant";
import { parseInternalPage } from "@/lib/browser/internal-pages";

it("registers Shortcuts after Content in the settings sidebar", () => {
  const pages = settingsPagesFirst.map((item) => item.id);
  const content = pages.indexOf("settings/content");
  expect(pages[content - 1]).toBe("settings/appearance");
  expect(pages[content + 1]).toBe("settings/shortcuts");
  expect(parseInternalPage("gorth://settings/shortcuts")).toBe("settings/shortcuts");
});
it("hides rather than removes the feature-block shortcut button", () => {
  const source = readFileSync(new URL("../../layouts/feature-block.tsx", import.meta.url), "utf8");
  expect(source).toContain('className={page === "shortcuts" ? "hidden" : undefined}');
});
