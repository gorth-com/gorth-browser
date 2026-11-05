import { Wallet } from "@gorth-io/primitive/cores/lucide";
import { PageShell } from "@/pages/shared";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@gorth-io/primitive/default/card";
export function SettingsSectionPage() {
  return (
    <PageShell icon={Wallet} title="Web3">
      <Card>
        <CardHeader>
          <CardTitle>Web3</CardTitle>
          <CardDescription>
            These preferences are not available yet.
          </CardDescription>
        </CardHeader>
      </Card>
    </PageShell>
  );
}
