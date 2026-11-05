import { internalPageDefinitions } from "@/utils/constant";
import { FoldersCard } from "@/components/element/folders-card";
import {
  ExternalLink,
  Info,
  Rocket,
  Sparkles,
} from "@gorth-io/primitive/cores/lucide";
import { Button } from "@gorth-io/primitive/custom/button";
import { AppUpdateCard } from "@/components/element/app-update-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@gorth-io/primitive/default/card";
import { type BrowserInternalPage } from "@/lib/browser/internal-pages";
import { type SpecialPageProps, PageShell } from "@/pages/shared";
function AboutPage({
  onOpenInternal,
}: {
  onOpenInternal: SpecialPageProps["onOpenInternal"];
}) {
  return (
    <PageShell icon={Info} title="Gorth Browser">
      <div className="mb-6">
        <AppUpdateCard />
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Welcome to Gorth</CardTitle>
            <CardDescription>
              Get started and make the browser your own.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => onOpenInternal("welcome")} variant="outline">
              <Rocket className="size-4" /> Open welcome
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>What's new</CardTitle>
            <CardDescription>
              Explore the features available in Gorth Browser.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => onOpenInternal("whats-new")}
              variant="outline"
            >
              <Sparkles className="size-4" /> See what's new
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Gorth URLs</CardTitle>
          <CardDescription>
            Like chrome://, each hostname maps to an approved internal page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(internalPageDefinitions).map(([page, definition]) => (
            <Button
              className="w-full justify-between"
              key={definition.url}
              onClick={() =>
                onOpenInternal(page as Exclude<BrowserInternalPage, "new-tab">)
              }
              variant="secondary"
            >
              <code className="text-sm">{definition.url}</code>
              <ExternalLink className="size-4 text-muted-foreground" />
            </Button>
          ))}
        </CardContent>
      </Card>
      <section className="mt-6 flex flex-col gap-4" aria-label="Folders">
        <CardTitle>Folders</CardTitle>
        <FoldersCard />
      </section>
    </PageShell>
  );
}
export { AboutPage };
