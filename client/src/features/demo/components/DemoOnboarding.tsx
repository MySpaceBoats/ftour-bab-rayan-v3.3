import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart3, HandCoins, UtensilsCrossed } from "lucide-react";

const STORAGE_KEY = "ftour_demo_onboarding_done_v1";

const STEPS = [
  {
    icon: BarChart3,
    title: "Explorez le tableau de bord",
    body: "Des KPI simulés et des graphiques dynamiques vous donnent une vision globale de l'activité de l'association.",
  },
  {
    icon: HandCoins,
    title: "Testez les dons et partenaires",
    body: "Ajoutez de faux dons, consultez l'historique et parcourez les entreprises partenaires avec leurs contributions.",
  },
  {
    icon: UtensilsCrossed,
    title: "Jouez avec les données",
    body: "Utilisez « Générer de nouvelles données » ou « Reset » à tout moment : rien n'est connecté à un vrai système.",
  },
];

interface DemoOnboardingProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export function DemoOnboarding({ forceOpen = false, onClose }: DemoOnboardingProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setStep(0);
      setOpen(true);
      return;
    }
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem(STORAGE_KEY)) {
      setOpen(true);
    }
  }, [forceOpen]);

  const finish = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "1");
    }
    setOpen(false);
    onClose?.();
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) finish();
    else setOpen(true);
  };

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
          <DialogTitle className="text-left text-xl">{current.title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600">{current.body}</p>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1.5" aria-label="Progression onboarding">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-6 rounded-full ${
                  i === step ? "bg-orange-500" : "bg-slate-200"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
                Précédent
              </Button>
            )}
            {!isLast ? (
              <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                Suivant
              </Button>
            ) : (
              <Button size="sm" onClick={finish}>
                Commencer
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
