import { useEffect } from "react";
import {
  useQuery,
  useQueryClient,
  useMutation,
} from "@gorth-io/primitive/cores/tanstack/query";
import type { SystemPreferences } from "@/lib/browser/system";
import { toast } from "@/providers/toaster";

export function useSystemSettings() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["system-settings"],
    queryFn: () => window.electronAPI.system.get(),
    retry: false,
  });
  useEffect(
    () =>
      window.electronAPI.system.onChanged((snapshot) => {
        client.setQueryData(["system-settings"], snapshot);
      }),
    [client],
  );
  const mutation = useMutation({
    mutationFn: (preferences: SystemPreferences) =>
      window.electronAPI.system.update(preferences),
    onSuccess: (snapshot) => client.setQueryData(["system-settings"], snapshot),
    onError: () =>
      toast.add({ title: "Could not save System settings.", type: "error" }),
  });
  return { ...query, update: mutation.mutate, saving: mutation.isPending };
}
export function useSystemEffects() {
  useEffect(() => {
    const apply = (active: boolean) => {
      document.documentElement.toggleAttribute("data-energy-saver", active);
    };
    let disposed = false;
    void window.electronAPI.system
      .get()
      .then((snapshot) => {
        if (!disposed) apply(snapshot.energyActive);
      })
      .catch(() =>
        toast.add({ title: "Could not load System settings.", type: "error" }),
      );
    const unsubscribe = window.electronAPI.system.onChanged((snapshot) =>
      apply(snapshot.energyActive),
    );
    const reminder = window.electronAPI.system.onFullscreenReminder(() => {
      toast.add({
        title: "Full screen",
        description:
          "Press Esc to exit website full screen. For window full screen, use the full-screen shortcut.",
      });
    });
    return () => {
      disposed = true;
      unsubscribe();
      reminder();
      document.documentElement.removeAttribute("data-energy-saver");
    };
  }, []);
}
