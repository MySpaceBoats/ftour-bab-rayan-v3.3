import { useCallback, useState, type ReactNode } from "react";
import { Menu, RefreshCw, RotateCcw, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { regenerateDemoDataset, resetDemoDataset } from "../data/store";
import { DemoBadge } from "./DemoBadge";
import { DemoSidebar } from "./DemoSidebar";
import { DemoOnboarding } from "./DemoOnboarding";

interface DemoLayoutProps {
  title: string;
  subtitle?: string;
  tooltip?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function DemoLayout({
  title,
  subtitle,
  tooltip,
  actions,
  children,
}: DemoLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  const handleRegenerate = useCallback(() => {
    regenerateDemoDataset();
    toast.success("Aperçu rafraîchi", {
      description: "Un nouvel échantillon d'activité vient d'être chargé.",
    });
  }, []);

  const handleReset = useCallback(() => {
    resetDemoDataset();
    toast.success("Aperçu remis à zéro", {
      description: "Vos modifications locales ont été effacées.",
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <DemoOnboarding
        forceOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
      />

      <div className="lg:grid lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-slate-200 bg-white lg:block">
          <div className="sticky top-0 h-screen overflow-y-auto">
            <DemoSidebar />
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
            <div className="flex items-center gap-3 px-4 py-3 lg:px-8">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    aria-label="Ouvrir le menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <DemoSidebar onNavigate={() => setMobileOpen(false)} />
                </SheetContent>
              </Sheet>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-lg font-semibold text-slate-900 sm:text-xl">
                    {title}
                  </h1>
                  {tooltip && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-slate-400 hover:text-slate-600"
                          aria-label={`Infos sur ${title}`}
                        >
                          <HelpCircle className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        {tooltip}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {subtitle && (
                  <p className="truncate text-xs text-slate-500 sm:text-sm">{subtitle}</p>
                )}
              </div>

              <div className="hidden items-center gap-2 sm:flex">
                <DemoBadge />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2 lg:px-8">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                data-testid="btn-regenerate"
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Rafraîchir l'aperçu
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                data-testid="btn-reset"
              >
                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                Remettre à zéro
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOnboardingOpen(true)}
              >
                <HelpCircle className="mr-2 h-3.5 w-3.5" />
                Guide rapide
              </Button>
              <div className="ml-auto sm:hidden">
                <DemoBadge />
              </div>
              {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
            </div>
          </header>

          <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>

          <footer className="border-t border-slate-200 bg-white px-4 py-4 text-xs text-slate-500 lg:px-8">
            <div className="flex flex-col items-start justify-between gap-1 sm:flex-row sm:items-center">
              <span>
                Espace d'aperçu accessible librement — pensé pour explorer les
                fonctionnalités de la plateforme.
              </span>
              <span className="font-medium text-slate-600">
                Ftour Bab Rayan · Plateforme associative
              </span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
