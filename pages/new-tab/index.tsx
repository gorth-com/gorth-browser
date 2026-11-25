import { quickLinks } from "@/utils/constant";
import { useBrowserSetup } from "@/hooks/use-browser-setup";
import {
  ArrowRight,
  Globe2,
  ShieldCheck,
  Zap,
} from "@gorth-com/primitive/cores/lucide";

import { ThemeToggle } from "@/components/element/theme-toggle";
import { Badge } from "@gorth-com/primitive/custom/badge";
import { Button } from "@gorth-com/primitive/custom/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@gorth-com/primitive/default/card";
import { Separator } from "@gorth-com/primitive/default/separator";
import type { Theme } from "@/lib/theme";
import { Wrapper } from "@/layouts/wrapper";
import { SearchForm } from "@/components/form/search-form";

interface NewTabPageProps {
  onNavigate: (value: string) => void;
  onThemeChange: (theme: Theme) => void;
  theme: Theme;
}

function NewTabPage({ onNavigate, onThemeChange, theme }: NewTabPageProps) {
  const setup = useBrowserSetup();
  if (!setup.data || setup.data.newTab === "blank")
    return <div className="min-h-full bg-background" aria-label="New tab" />;
  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_color-mix(in_oklch,var(--primary)_10%,transparent),_transparent_38%)]" />
      <Wrapper>
        <div className="relative flex min-h-full min-w-0 flex-col">
          <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Globe2 className="size-5" />
              </div>
              <div>
                <p className="font-heading text-base font-semibold">
                  Gorth Browser
                </p>
                <p className="text-xs text-muted-foreground">
                  Fast, focused, and private
                </p>
              </div>
            </div>
            <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
          </header>

          <section className="flex flex-1 flex-col justify-center py-16">
            <div className="mx-auto w-full max-w-3xl text-center">
              <Badge variant="outline" className="mb-5">
                <ShieldCheck data-icon="inline-start" /> Browse your way
              </Badge>
              <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
                What do you want to explore?
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Enter a website address or search query to get started.
              </p>
              <SearchForm onSubmit={onNavigate} />
            </div>

            <Separator className="my-10" />
            <div className="grid gap-4 sm:grid-cols-3">
              {quickLinks.map(({ description, icon: Icon, label, url }) => (
                <Card
                  key={url}
                  size="sm"
                  className="transition-shadow hover:shadow-md"
                >
                  <CardHeader>
                    <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-muted">
                      <Icon className="size-4" />
                    </div>
                    <CardTitle>{label}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full justify-between"
                      variant="outline"
                      onClick={() => onNavigate(url)}
                    >
                      Visit <ArrowRight data-icon="inline-end" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <footer className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Zap className="size-3.5" /> Powered by Electron, Vite, React and
            Shadcn
          </footer>
        </div>
      </Wrapper>
    </div>
  );
}

export { NewTabPage };
