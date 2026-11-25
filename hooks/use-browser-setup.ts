import { useEffect } from "react";
import {
  useQuery,
  useQueryClient,
} from "@gorth-com/primitive/cores/tanstack/query";

export function useBrowserSetup() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["browser-setup"],
    queryFn: () => window.electronAPI.setup.load(),
    retry: false,
  });
  useEffect(
    () =>
      window.electronAPI.setup.onChanged((value) => {
        client.setQueryData(["browser-setup"], value);
      }),
    [client],
  );
  return {
    ...query,
    accept: (
      value: Awaited<ReturnType<typeof window.electronAPI.setup.load>>,
    ) => client.setQueryData(["browser-setup"], value),
  };
}
