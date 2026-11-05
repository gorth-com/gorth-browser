import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-full-screen", () => ({ useFullScreen: () => false }));
vi.mock("@/components/element/browser-tabs", () => ({
  BrowserTabs: () => null,
}));
vi.mock("@/layouts/feature-block", () => ({
  AddressBarInput: () => null,
  FeatureLeftBlock: () => null,
  FeatureRightBlock: () => null,
}));
import { Titlebar } from "@/layouts/title-bar";
import { VerticalTabs } from "@/layouts/vertical-tabs";

afterEach(() => vi.unstubAllGlobals());

it("uses tooltip triggers instead of native titles for horizontal tab actions", () => {
  vi.stubGlobal("window", { electronAPI: { windowState: { isMacOS: false } } });
  const noop = () => {};
  const props: ComponentProps<typeof Titlebar> = {
    groups: [],
    activeTabId: "",
    showLogo: false,
    tabs: [],
    onActivateTab: noop,
    onCloseTab: noop,
    onCloseOtherTabs: noop,
    onCreateTab: noop,
    onReloadTab: noop,
    onToggleMuteTab: noop,
    onTogglePinTab: noop,
  };
  assertActions(renderToStaticMarkup(createElement(Titlebar, props)));
});

it("uses tooltip triggers instead of native titles for vertical tab actions", () => {
  assertActions(
    renderToStaticMarkup(
      createElement(VerticalTabs, {
        groups: [],
        activeTabId: "",
        tabs: [],
        onCreateTab() {},
        onActivate() {},
        onClose() {},
        onCloseOtherTabs() {},
        onReload() {},
        onToggleMute() {},
        onTogglePin() {},
      }),
    ),
  );
});

function assertActions(html: string) {
  for (const label of ["Open new tab", "Show all tabs"]) {
    const button = html.match(
      new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`),
    )?.[0];
    expect(button).toBeDefined();
    expect(button).toContain('data-slot="tooltip-trigger"');
    expect(button).not.toMatch(/\stitle=/);
  }
}
