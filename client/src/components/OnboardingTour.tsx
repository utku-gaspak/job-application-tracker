import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "./ui/button";

interface OnboardingStep {
  screenshot: string;
  title: string;
  body: string;
}

const steps: OnboardingStep[] = [
  {
    screenshot: "/screenshots/onboarding-1-welcome.png",
    title: "Welcome to Traxr",
    body: "Job hunting is messy — tabs, spreadsheets, emails, notes scattered everywhere. Traxr brings it all into one clean pipeline. No more lost leads, no more forgotten follow-ups. Here's how it works:",
  },
  {
    screenshot: "/screenshots/onboarding-2-find-jobs.png",
    title: "Find Jobs",
    body: "Paste a hiring.cafe search URL and Traxr automatically scrapes matching job listings. No manual copy-paste, no spreadsheets. Every job lands in your review queue, ready to evaluate.",
  },
  {
    screenshot: "/screenshots/onboarding-3-review.png",
    title: "Review & Save",
    body: "Review each job one at a time — save the ones worth applying to, discard the rest. Focus on what matters: company, role, location, skills. Keyboard shortcuts make it fast.",
  },
  {
    screenshot: "/screenshots/onboarding-4-track.png",
    title: "Track Applications",
    body: "Drag applications across columns as they move through your pipeline: Applied → Interviewing → Offer. Filter by anything — skills, interest level, status. Always know where you stand.",
  },
  {
    screenshot: "/screenshots/onboarding-5-ready.png",
    title: "You're All Set",
    body: "Three connected steps: Find Jobs → Review & Save → Track Apps. The pipeline bar at the top keeps you oriented. Click any step to jump in.",
  },
];

interface OnboardingTourProps {
  open: boolean;
  onClose: () => void;
  variant: "inline" | "modal";
}

const OnboardingTour = ({ open, onClose, variant }: OnboardingTourProps) => {
  const [stepIndex, setStepIndex] = useState(0);
  const current = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const isFirst = stepIndex === 0;

  if (!open) return null;

  const goBack = () => {
    if (isFirst) return;
    setStepIndex((i) => i - 1);
  };

  const goNext = () => {
    if (isLast) {
      onClose();
      setStepIndex(0);
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const handleClose = () => {
    setStepIndex(0);
    onClose();
  };

  const content = (
    <div className="deco-frame-thick flex flex-col border-border-gold bg-deco-bg/95 shadow-deco-panel backdrop-blur-md">
      <div className="flex items-start justify-between gap-3 border-b border-primary-gold-muted p-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-gold">
            Step {stepIndex + 1} of {steps.length}
          </p>
          <h3 className="mt-1 font-heading text-xl text-deco-foreground">
            {current.title}
          </h3>
        </div>
        {variant === "modal" && (
          <Button
            aria-label="Close tour"
            className="h-8 w-8 p-0"
            onClick={handleClose}
            type="button"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="px-4 pt-4">
        <div
          className="flex w-full items-center justify-center rounded-lg border border-border-gold bg-deco-surface-soft text-xs text-deco-muted"
          style={{ aspectRatio: "16/10" }}
        >
          <img
            src={current.screenshot}
            alt={current.title}
            className="h-full w-full rounded-lg object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <span className="absolute">Screenshot: {current.title}</span>
        </div>
      </div>

      <div className="px-4 pb-2">
        <p className="text-sm leading-6 text-deco-muted">{current.body}</p>
      </div>

      <div className="grid items-center gap-3 border-t border-primary-gold-muted p-4" style={{ gridTemplateColumns: "auto 1fr auto" }}>
        <Button
          type="button"
          variant="outline"
          onClick={goBack}
          disabled={isFirst}
          className="justify-center"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="flex items-center justify-center gap-2">
          {steps.map((_, index) => (
            <span
              aria-hidden="true"
              key={index}
              className={`h-2.5 w-2.5 rounded-full border ${
                index === stepIndex
                  ? "border-primary-gold bg-primary-gold"
                  : "border-border-gold bg-transparent"
              }`}
            />
          ))}
        </div>

        <Button
          type="button"
          onClick={goNext}
          className="justify-center"
        >
          {isLast ? "Got it" : "Next"}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  if (variant === "inline") {
    return content;
  }

  return (
    <div className="fixed inset-0 z-70">
      <div
        aria-label="Close tour"
        className="absolute inset-0 bg-black/40"
        onClick={handleClose}
        role="button"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-[720px]">{content}</div>
      </div>
    </div>
  );
};

export default OnboardingTour;
