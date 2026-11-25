import { Search } from "@gorth-com/primitive/cores/lucide";
import { PageShell } from "@/pages/shared";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@gorth-com/primitive/default/card";
export function SettingsSectionPage() {
  return (
    <PageShell icon={Search} title="Search engine">
      <Card>
        <CardHeader>
          <CardTitle>Default search engine</CardTitle>
          <CardDescription>
            Address bar searches currently use Google.
          </CardDescription>
        </CardHeader>
      </Card>
    </PageShell>
  );
}
