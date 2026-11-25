// Routing metadata only; SDK PKCE/state verification is not duplicated.
export function parseDesktopLoginPage(value: string) {
  try {
    if (value.length > 4096) return null;
    const page = new URL(value);
    if ([...page.searchParams.keys()].some((name) =>
      !["client_id", "state", "code_challenge"].includes(name))) return null;
    const route = new URL("com.gorth.browser://auth/open");
    for (const [name, entry] of page.searchParams) route.searchParams.append(name, entry);
    page.search = "";
    route.searchParams.set("url", page.href);
    // Reuse the same client, origin, path, duplicate and PKCE-shape validation.
    return parseLoginNavigation(route.href);
  } catch {
    return null;
  }
}

export function parseLoginNavigation(value: string) {
  try {
    if (value.length > 4096) return null;
    const route = new URL(value);
    if (
      route.protocol !== "com.gorth.browser:" ||
      route.hostname !== "auth" ||
      route.pathname !== "/open" ||
      route.port ||
      route.username ||
      route.password ||
      route.hash
    )
      return null;
    const names = ["url", "client_id", "state", "code_challenge"];
    if (
      Array.from(route.searchParams.keys()).some(
        (key) => !names.includes(key),
      ) ||
      names.some((key) => route.searchParams.getAll(key).length !== 1)
    )
      return null;
    const client = route.searchParams.get("client_id")!;
    if (client !== "gorth-browser" && client !== "gorth-launcher") return null;
    if (
      !/^[A-Za-z0-9_-]{1,256}$/.test(route.searchParams.get("state")!) ||
      !/^[A-Za-z0-9_-]{43}$/.test(route.searchParams.get("code_challenge")!)
    )
      return null;
    const url = new URL(route.searchParams.get("url")!);
    if (
      url.username ||
      url.password ||
      url.hash ||
      url.search ||
      url.pathname !== "/auth/desktop" ||
      !(
        url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
      )
    )
      return null;
    for (const key of names.slice(1))
      url.searchParams.set(key, route.searchParams.get(key)!);
    return {
      url: url.href,
      origin: url.origin,
      callbackScheme:
        client === "gorth-browser"
          ? "com.gorth.browser:"
          : "com.gorth.launcher:",
    };
  } catch {
    return null;
  }
}
