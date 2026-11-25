import { expect, it } from "vitest";
import { parseDesktopLoginPage, parseLoginNavigation } from "@/lib/auth/login-navigation";
function link(changes: Record<string, string> = {}) {
  const url = new URL("com.gorth.browser://auth/open");
  for (const [key, value] of Object.entries({
    url: "https://launcher.example.test/auth/desktop",
    client_id: "gorth-launcher",
    state: "a".repeat(16),
    code_challenge: "b".repeat(43),
    ...changes,
  }))
    url.searchParams.set(key, value);
  return url.href;
}
it("preserves the exact SDK parameters and selects the originating app callback scheme", () => {
  const result = parseLoginNavigation(link())!;
  const target = new URL(result.url);
  expect(target.origin).toBe("https://launcher.example.test");
  expect(target.pathname).toBe("/auth/desktop");
  expect(target.searchParams.get("state")).toBe("a".repeat(16));
  expect(target.searchParams.get("code_challenge")).toBe("b".repeat(43));
  expect(result.callbackScheme).toBe("com.gorth.launcher:");
  expect(
    parseLoginNavigation(link({ client_id: "gorth-browser" }))?.callbackScheme,
  ).toBe("com.gorth.browser:");
});
const invalidRoutes: Array<Record<string, string>> = [
  { url: "javascript:alert(1)" },
  { url: "file:///auth/desktop" },
  { url: "gorth://settings" },
  { url: "http://remote.example.test/auth/desktop" },
  { url: "https://user:password@website.example.test/auth/desktop" },
  { url: "https://website.example.test/arbitrary-page" },
  { url: "https://website.example.test/auth/desktop?redirect=evil" },
  { client_id: "foreign-client" },
  { state: "bad state" },
  { code_challenge: "invalid" },
  { access_token: "never-allowed" },
];
it("validates ordinary HTTP entry with the same rules as explicit Gorth navigation", () => {
  const page = parseLoginNavigation(link())!.url;
  expect(parseDesktopLoginPage(page)).toEqual(parseLoginNavigation(link()));
  for (const suffix of [
    "&url=https://evil.test/auth/desktop",
    "&state=duplicate",
    "&access_token=secret",
    "#fragment",
  ]) expect(parseDesktopLoginPage(page + suffix)).toBeNull();
  expect(parseDesktopLoginPage(page.replace("https:", "http:"))).toBeNull();
  expect(parseDesktopLoginPage(page.replace("/auth/desktop?", "/auth/desktop/complete?"))).toBeNull();
});
it.each(invalidRoutes)("rejects untrusted navigation input %j", (changes) => {
  expect(parseLoginNavigation(link(changes))).toBeNull();
});
it("rejects duplicate parameters, unknown routes and oversized payloads", () => {
  expect(parseLoginNavigation(link() + "&state=another")).toBeNull();
  expect(
    parseLoginNavigation(link().replace("/open?", "/callback?")),
  ).toBeNull();
  expect(parseLoginNavigation(link({ state: "a".repeat(5000) }))).toBeNull();
});
