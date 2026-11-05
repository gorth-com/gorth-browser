import { ListChecks } from "@gorth-io/primitive/cores/lucide";
import { PageShell } from "@/pages/shared";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@gorth-io/primitive/default/card";
export function SettingsSectionPage() {
  return (
    <PageShell icon={ListChecks} title="Autofill and passwords">
      <Card>
        <CardHeader>
          <CardTitle>Autofill and passwords</CardTitle>
          <CardDescription>
            These preferences are not available yet.
          </CardDescription>
        </CardHeader>
      </Card>
    </PageShell>
  );
}
