import { Sparkles } from "@gorth-com/primitive/cores/lucide";
import { PageShell } from "@/pages/shared";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@gorth-com/primitive/default/card";
export function SettingsSectionPage() {
  return (
    <PageShell icon={Sparkles} title="Leo">
      <Card>
        <CardHeader>
          <CardTitle>Leo</CardTitle>
          <CardDescription>
            These preferences are not available yet.
          </CardDescription>
        </CardHeader>
      </Card>
    </PageShell>
  );
}
