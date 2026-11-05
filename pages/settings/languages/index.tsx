import { Languages } from "@gorth-io/primitive/cores/lucide";
import { PageShell } from "@/pages/shared";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@gorth-io/primitive/default/card";
export function SettingsSectionPage() {
  return (
    <PageShell icon={Languages} title="Languages">
      <Card>
        <CardHeader>
          <CardTitle>Languages</CardTitle>
          <CardDescription>
            These preferences are not available yet.
          </CardDescription>
        </CardHeader>
      </Card>
    </PageShell>
  );
}
