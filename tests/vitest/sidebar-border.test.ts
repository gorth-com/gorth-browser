import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("application sidebar border contract", () => {
  it("places the sidebar toggle in the Appearance card instead of the Settings corner", async () => {
    const settings = await readFile(
      new URL("../../pages/settings/index.tsx", import.meta.url),
      "utf8",
    );
    const appearance = await readFile(
      new URL("../../pages/settings/appearance/index.tsx", import.meta.url),
      "utf8",
    );
    expect(settings).not.toContain('aria-label="Toggle settings sidebar"');
    expect(appearance).toMatch(
      /<CardContent[^>]*>[\s\S]*aria-label="Toggle settings sidebar"[\s\S]*<\/CardContent>/,
    );
    expect(appearance).toContain("onClick={toggleSidebar}");
  });
  it("composes published Sidebar primitives with an SSO-sized header and account footer", async () => {
    const source = await readFile(
      new URL("../../layouts/dashboard.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain('"@gorth-io/primitive/custom/sidebar"');
    expect(source).not.toContain("@/components/dashboard/app-sidebar");
    expect(source).toContain("<SidebarHeader");
    expect(source).toContain('size="lg"');
    expect(source).toContain("h-14");
    expect(source).toContain("size-9");
    expect(source).toContain("text-2xl font-bold");
    expect(source).toMatch(
      /<SidebarFooter[\s\S]*<NavUser[\s\S]*<\/SidebarFooter>/,
    );
    expect(source).toContain("onClick=");
    expect(source).not.toContain("next/link");
  });
  it("keeps identity rendering in Primitive and menu rendering in the native portal", async () => {
    const nav = await readFile(
      new URL("../../components/dashboard/nav-user.tsx", import.meta.url),
      "utf8",
    );
    const menu = await readFile(
      new URL("../../components/dashboard/menu.tsx", import.meta.url),
      "utf8",
    );
    expect(nav).toContain('"@/components/dashboard/nav-identity"');
    expect(nav).not.toContain('"@gorth-io/primitive/dashboard/');
    expect(nav).toContain("<NavAccount");
    expect(nav).toContain("<NavIdentity");
    expect(nav).toContain("<DashboardMenu");
    expect(nav).not.toContain("AvatarFallback");
    expect(menu).toContain("<PortalPanel");
    expect(menu).toContain('"@gorth-io/primitive/default/button"');
  });
  it("renames the panel and keeps vertical/panel sidebar borders side-aware", async () => {
    for (const filename of ["vertical-tabs", "panel-bar"]) {
      const source = await readFile(
        new URL("../../layouts/" + filename + ".tsx", import.meta.url),
        "utf8",
      );
      expect(source).toContain("data-side=");
      expect(source).toContain("data-[side=left]:border-r");
      expect(source).toContain("data-[side=right]:border-l");
    }
    const source = await readFile(
      new URL("../../app/index.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain('import { PanelBar } from "@/layouts/panel-bar"');
    expect(source).not.toContain("@/layouts/side-bar");
  });
});
