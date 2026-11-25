import { whatsNewFeatures } from "@/utils/constant";
import { Sparkles } from "@gorth-com/primitive/cores/lucide";
import { Button } from "@gorth-com/primitive/custom/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@gorth-com/primitive/default/card";
import { PageShell, type SpecialPageProps } from "@/pages/shared";

function WhatsNewPage({
  onOpenInternal,
}: Pick<SpecialPageProps, "onOpenInternal">) {
  return (
    <PageShell icon={Sparkles} title="What's new in Gorth">
      <div className="grid gap-4 sm:grid-cols-2">
        {whatsNewFeatures.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="size-4 shrink-0" />
                {title}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={() => onOpenInternal("settings")}>
          Explore settings
        </Button>
        <Button variant="outline" onClick={() => onOpenInternal("welcome")}>
          Welcome
        </Button>
        <Button variant="ghost" onClick={() => onOpenInternal("help")}>
          Help
        </Button>
      </div>
    </PageShell>
  );
}

export { WhatsNewPage };
