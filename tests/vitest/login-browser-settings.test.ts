import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
const fixture = vi.hoisted(() => ({
  browser: "default" as "default" | "gorth",
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    busy: false,
    state: { loginBrowser: fixture.browser },
    auth: { loginBrowser: fixture.browser },
  }),
}));
import { LoginBrowserSettings } from "@/components/element/login-browser-settings";
it("shows both browser choices and selects default unless explicitly changed", () => {
  let html = renderToStaticMarkup(createElement(LoginBrowserSettings));
  expect(html).toContain("Default browser");
  expect(html).toContain("Gorth Browser");
  expect(html).toMatch(/aria-pressed="true"[^>]*>Default browser/);
  fixture.browser = "gorth";
  html = renderToStaticMarkup(createElement(LoginBrowserSettings));
  expect(html).toMatch(/aria-pressed="true"[^>]*>Gorth Browser/);
});
