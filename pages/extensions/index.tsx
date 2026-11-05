import { Puzzle } from "@gorth-io/primitive/cores/lucide";
import { PageShell, EmptyState } from "@/pages/shared";
export function ExtensionsPage() {
  return (
    <PageShell icon={Puzzle} title="Extensions">
      <EmptyState icon={Puzzle} title="No extensions installed">
        Extension installation and management will be available here.
      </EmptyState>
    </PageShell>
  );
}
