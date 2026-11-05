import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const files = [
  "pages/settings/get-started/index.tsx",
  "pages/settings/appearance/index.tsx",
  "components/element/sidebar-settings.tsx",
  "components/element/toast-settings.tsx",
];
it("keeps switch labels adjacent and uses radio layouts without obsolete collapse controls", () => {
  const appearance = readFileSync(
    new URL("../../pages/settings/appearance/index.tsx", import.meta.url),
    "utf8",
  );
  const sidebar = readFileSync(
    new URL("../../components/element/sidebar-settings.tsx", import.meta.url),
    "utf8",
  );
  expect(appearance).not.toContain("<Select");
  expect(sidebar).not.toContain("<Select");
  expect(appearance).not.toContain("toggleSidebar");
  expect(appearance.indexOf("<CardTitle>Sidebar position")).toBeLessThan(
    appearance.indexOf("<SidebarSettings"),
  );
  expect(sidebar).not.toContain("disabled={!enabled}");
  expect(appearance).toContain("onCheckedChange={onSidebarVisibilityChange}");
  for (const source of [appearance, sidebar]) {
    const standaloneSwitches = source === appearance ? 2 : 0;
    expect((source.match(/<Switch\b/g)?.length ?? 0) - standaloneSwitches).toBe(
      source.match(/className="flex items-center gap-2"/g)?.length,
    );
  }
});
it.each(files)("uses flex gaps and default card typography in %s", (file) => {
  const source = readFileSync(
    new URL("../../" + file, import.meta.url),
    "utf8",
  );
  expect(source).not.toMatch(/space-[xy]-/);
  expect(source).not.toMatch(/<CardTitle\b[^>]*className=/);
  expect(source).not.toMatch(/<CardDescription\b[^>]*className=/);
  expect(source).not.toContain("pl-10");
  expect(source).not.toMatch(/<p\b/);
});
it.each(files.slice(0, 3))(
  "aligns radio rows with the card content in %s",
  (file) => {
    const source = readFileSync(
      new URL("../../" + file, import.meta.url),
      "utf8",
    );
    expect(source).toContain('className="flex flex-col gap-6"');
    expect(source).toContain('className="flex items-center gap-3 text-sm"');
  },
);
