import assert from "node:assert/strict";
import { app, BrowserWindow, protocol, shell } from "electron";
import { betterAuth } from "better-auth";
import { electron } from "@better-auth/electron";
import {
  loginGorth,
  receiveGorthDeepLink,
  restoreGorthSession,
  signOutGorth,
  gorthSnapshot,
  getGorthClient,
  authScheme,
  installGorthAuth,
} from "@/lib/auth/gorth";
app.setPath("userData", process.argv[2]);
app.setPath("sessionData", process.argv[2]);
// Match Browser startup's single privileged-scheme registration without
// replacing the user's operating-system default protocol association.
protocol.registerSchemesAsPrivileged([
  { scheme: "gorth", privileges: { standard: true, secure: true } },
  { scheme: authScheme, privileges: { secure: true } },
]);
let fixtureAuth: ReturnType<typeof betterAuth> | undefined;
// Better Fetch captures fetch when setupMain creates the client. Install this
// test-only transport before bootstrap, then attach the in-memory server.
globalThis.fetch = async (input, init) => {
  if (!fixtureAuth) throw new Error("The fixture auth server is not ready.");
  return fixtureAuth.handler(
    input instanceof Request ? input : new Request(input, init),
  );
};
const registerDefaultProtocol = app.setAsDefaultProtocolClient;
app.setAsDefaultProtocolClient = () => true;
installGorthAuth({ registerScheme: false });
app.setAsDefaultProtocolClient = registerDefaultProtocol;
async function run() {
  await app.whenReady();
  const window = new BrowserWindow({
    show: false,
    width: 640,
    height: 480,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  try {
    await window.loadURL(
      "data:text/html,<main>Isolated native auth fixture</main>",
    );
    const auth = betterAuth({
      baseURL: "http://localhost:5503",
      basePath: "/auth",
      secret: "isolated-native-fixture-secret-at-least-32-bytes",
      logger: { disabled: true },
      rateLimit: { enabled: false },
      trustedOrigins: ["http://localhost:5503", "com.gorth.browser:/"],
      emailAndPassword: { enabled: true },
      plugins: [
        electron({
          clientID: "gorth-browser",
          cookiePrefix: "gorth-browser-website",
        }),
      ],
      user: {
        additionalFields: {
          externalUserId: { type: "string", required: true },
        },
      },
      advanced: { cookiePrefix: "gorth-browser-website" },
    });
    await auth.$context;
    fixtureAuth = auth;
    let authorization = "";
    shell.openExternal = async (url) => {
      authorization = url;
    };
    const controller = new AbortController();
    const login = loginGorth(controller.signal);
    let loginError: unknown;
    async function consume() {
      try {
        await login;
      } catch (error) {
        loginError = error;
      }
    }
    const completed = consume();
    const deadline = Date.now() + 5000;
    while (!authorization) {
      assert(Date.now() < deadline, "SDK did not open its authorization page");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const query = new URL(authorization).search;
    const response = await auth.handler(
      new Request("http://localhost:5503/auth/sign-up/email" + query, {
        method: "POST",
        headers: {
          Origin: "http://localhost:5503",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Native Fixture",
          email: "fixture@example.test",
          password: "Test-only-password-123!",
          externalUserId: "fixture-sso-sub",
        }),
      }),
    );
    assert.equal(response.status, 200);
    const cookie = response.headers
      .getSetCookie()
      .find((value) =>
        value.startsWith("gorth-browser-website.gorth-browser="),
      );
    assert(
      cookie,
      "The official server plugin did not issue the transfer cookie",
    );
    const token = cookie
      .split(";")[0]
      .slice("gorth-browser-website.gorth-browser=".length);
    assert(
      await receiveGorthDeepLink(
        "com.gorth.browser://auth/callback#token=" + token,
      ),
    );
    await completed;
    assert.equal(loginError, undefined);
    assert.equal(gorthSnapshot().user?.id, "fixture-sso-sub");
    await restoreGorthSession();
    assert.equal(gorthSnapshot().user?.id, "fixture-sso-sub");
    const saved = getGorthClient().getCookie();
    await signOutGorth();
    assert.equal(gorthSnapshot().user, null);
    const oldSession = await auth.handler(
      new Request(
        "http://localhost:5503/auth/get-session?disableCookieCache=true",
        { headers: { Cookie: saved } },
      ),
    );
    assert.equal(await oldSession.json(), null);
    assert.equal(BrowserWindow.getAllWindows().length, 1);
    assert.equal(
      await window.webContents.executeJavaScript("typeof window.electronAPI"),
      "undefined",
    );
    console.info(
      "Native auth: official PKCE transfer, secure storage, restore, app-only logout and isolated renderer passed.",
    );
  } finally {
    window.destroy();
  }
}
async function main() {
  try {
    await run();
    app.quit();
  } catch (error) {
    console.error("Native auth fixture failed:", error);
    app.exit(1);
  }
}
void main();
