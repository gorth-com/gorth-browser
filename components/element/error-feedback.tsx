import { useEffect, useId } from "react";
import { toast } from "@/providers/toaster";

/** Report operation failures without adding inline page content. */
export function ErrorFeedback({ message }: { message?: string | null }) {
  const id = useId();
  useEffect(() => {
    if (message) toast.add({ id, title: message, type: "error" });
  }, [id, message]);
  return null;
}
