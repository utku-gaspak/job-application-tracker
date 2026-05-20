import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  BadgePlus,
  Binoculars,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Filter,
  LayoutDashboard,
  MoonStar,
  Search,
  Sparkles,
  SunMedium,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export const WELCOME_WIZARD_SEEN_KEY = "traxr:welcome-wizard-seen:v1";
export const WELCOME_WIZARD_SNOOZE_KEY = "traxr:welcome-wizard-snoozed:v1";

const steps = [
  {
    title: "Tracker board",
    icon: LayoutDashboard,
    body: "Move cards through Applied, Interviewing, Rejected, and Offer with drag and drop.",
  },
  {
    title: "Add new work",
    icon: BadgePlus,
    body: "Create applications directly from the tracker with the full form.",
  },
  {
    title: "Filter quickly",
    icon: Search,
    body: "Search by company or role, then narrow by status, interest, and skills.",
  },
  {
    title: "Sort and stack",
    icon: ArrowUpDown,
    body: "Switch between newest and oldest applications without changing the board layout.",
  },
  {
    title: "Open details",
    icon: Sparkles,
    body: "Click a card to open the detail sheet, edit fields, or delete the application.",
  },
  {
    title: "Scout queue",
    icon: Binoculars,
    body: "Scout keeps imported jobs separate while you review them.",
  },
  {
    title: "Scout evaluation",
    icon: Filter,
    body: "Use the Scout evaluate flow to save, discard, or move a job to To Apply.",
  },
  {
    title: "Theme controls",
    icon: MoonStar,
    body: "Toggle light and dark mode from the header, and reopen this guide anytime.",
  },
  {
    title: "Search filters",
    icon: SunMedium,
    body: "Use the filter bar to keep the board compact while you work through entries.",
  },
] as const;

interface WelcomeWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSnoozeLater: () => void;
  onFinish: () => void;
}

const WelcomeWizard = ({
  open,
  onOpenChange,
  onSnoozeLater,
  onFinish,
}: WelcomeWizardProps) => {
  const [stepIndex, setStepIndex] = useState(0);

  const currentStep = useMemo(() => steps[stepIndex], [stepIndex]);
  const CurrentIcon = currentStep.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="deco-frame max-h-[90vh] w-[min(94vw,44rem)] border-border-gold bg-deco-bg p-0">
        <DialogHeader className="border-b border-primary-gold-muted bg-primary-gold-muted px-5 py-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-primary-gold">
            Welcome
          </p>
          <DialogTitle className="mt-1 flex items-center gap-2 font-heading text-2xl text-deco-foreground">
            <CircleHelp className="h-5 w-5 text-primary-gold" />
            Quick start guide
          </DialogTitle>
        </DialogHeader>

        <Card className="m-5 border-border-gold-muted bg-deco-surface-soft">
          <CardContent className="grid gap-5 p-5">
            <div className="grid gap-3">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-deco-muted">
                Step {stepIndex + 1} of {steps.length}
              </p>
              <div className="flex items-start gap-3">
                <div className="deco-frame flex h-10 w-10 shrink-0 items-center justify-center border-border-gold-muted bg-deco-card text-primary-gold">
                  <CurrentIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-heading text-2xl text-deco-foreground">
                    {currentStep.title}
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-deco-muted">
                    {currentStep.body}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-primary-gold-muted pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (stepIndex === 0) {
                    onSnoozeLater();
                    return;
                  }

                  setStepIndex((current) => current - 1);
                }}
              >
                <ChevronLeft className="h-4 w-4" />
                {stepIndex === 0 ? "Show later" : "Back"}
              </Button>

              <div className="flex items-center gap-2">
                {steps.map((step, index) => (
                  <span
                    aria-hidden="true"
                    key={step.title}
                    className={`h-2.5 w-2.5 rounded-full border ${
                      index === stepIndex
                        ? "border-primary-gold bg-primary-gold"
                        : "border-border-gold bg-transparent"
                    }`}
                  />
                ))}
              </div>

              {stepIndex === steps.length - 1 ? (
                <Button type="button" onClick={onFinish}>
                  Finish
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => setStepIndex((current) => current + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeWizard;
