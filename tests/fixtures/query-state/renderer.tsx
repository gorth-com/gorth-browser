import * as React from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
} from "@gorth-com/primitive/cores/tanstack/query";
import { useAuthController } from "@/hooks/use-auth-controller";
import type { AuthAction, AuthSnapshot } from "@/lib/auth/types";

const fixture = window as unknown as Window & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
  queryStateTest: Promise<unknown>;
};
fixture.IS_REACT_ACT_ENVIRONMENT = true;
const pause = () => new Promise((resolve) => setTimeout(resolve, 15));
async function settle() {
  await React.act(async () => {
    await pause();
  });
}
function check(value: unknown, message: string) {
  if (!value) throw new Error(message);
}
fixture.queryStateTest = (async () => {
  let listener: (snapshot: AuthSnapshot) => void = () => {};
  const user = {
    id: "dummy",
    verifiedAt: Date.now(),
    expiresAt: Date.now() + 600000,
    canRefresh: true,
  };
  let snapshot = {
    user: null,
    locked: true,
    configured: true,
    busy: false,
  } as AuthSnapshot;
  const calls: AuthAction[] = [];
  Object.assign(window, {
    electronAPI: {
      auth: {
        snapshot: async () => ({ snapshot }),
        onChanged: (callback: typeof listener) => {
          listener = callback;
          return () => {
            listener = () => {};
          };
        },
        command: async (action: AuthAction) => {
          calls.push(action);
          snapshot = { ...snapshot, locked: false, user } as AuthSnapshot;
          return { snapshot };
        },
      },
    },
  });
  const client = new QueryClient();
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element);
  let controller!: ReturnType<typeof useAuthController>;
  function Harness() {
    controller = useAuthController();
    return null;
  }
  await React.act(async () => {
    root.render(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(
          React.StrictMode,
          null,
          React.createElement(Harness),
        ),
      ),
    );
  });
  await settle();
  check(
    calls.length === 1 && calls[0] === "unlock",
    "browser restore duplicated or missing",
  );
  check(
    controller.ready && !controller.busy && controller.authenticated,
    "browser restore failed",
  );
  React.act(() => listener({ ...snapshot, user: null, locked: true }));
  await settle();
  check(
    controller.locked && !controller.authenticated,
    "browser auth revocation IPC ignored",
  );
  await React.act(async () => {
    root.unmount();
  });
  client.clear();
  return { browserAuth: true };
})();
