import { LockKeyhole } from "@gorth-com/primitive/cores/lucide";
import { PageShell } from "@/pages/shared";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@gorth-com/primitive/default/card";
export function SettingsSectionPage() {
  return (
    <PageShell icon={LockKeyhole} title="Privacy and security">
      <Card>
        <CardHeader>
          <CardTitle>Privacy and security</CardTitle>
          <CardDescription>
            These preferences are not available yet.
          </CardDescription>
        </CardHeader>
      </Card>
    </PageShell>
  );
}
