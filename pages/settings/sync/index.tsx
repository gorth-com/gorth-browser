import { RefreshCw } from "@gorth-io/primitive/cores/lucide";
import { PageShell } from "@/pages/shared";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@gorth-io/primitive/default/card";
export function SettingsSectionPage() {
  return (
    <PageShell icon={RefreshCw} title="Sync">
      <Card>
        <CardHeader>
          <CardTitle>Sync</CardTitle>
          <CardDescription>
            These preferences are not available yet.
          </CardDescription>
        </CardHeader>
      </Card>
    </PageShell>
  );
}
