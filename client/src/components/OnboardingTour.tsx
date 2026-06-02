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
    title: "Scrape",
    body: "Paste a hiring.cafe search URL and Traxr automatically scrapes matching job listings. No manual copy-paste, no spreadsheets. Every job lands in your review queue, ready to evaluate.",
  },
  {
    screenshot: "/screenshots/onboarding-3-review.png",
    title: "Review",
    body: "Review each job one at a time — save the ones worth applying to, discard the rest. Focus on what matters: company, role, location, skills. Keyboard shortcuts make it fast.",
  },
  {
    screenshot: "/screenshots/onboarding-4-saved.png",
    title: "Saved",
    body: "Jobs you save appear here. Review your shortlist before moving into a focused apply pass.",
  },
  {
    screenshot: "/screenshots/onboarding-4-saved.png",
    title: "Apply",
    body: "Open each external apply link, work through the saved jobs, and mark applications as applied when you're done.",
  },
  {
    screenshot: "/screenshots/onboarding-5-track.png",
    title: "Board",
    body: "Every application lives on your board. Drag cards from Applied → Interviewing → Offer as you progress. Filter by anything. Good luck on your search!",
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
      <div className="flex items-start justify-between gap-3 border-b border-primary-gold-muted p-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-gold">
            Step {stepIndex + 1} of {steps.length}
          </p>
          <h3 className="mt-1 font-heading text-2xl text-deco-foreground">
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
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <div className="p-5">
        <div
          className="flex w-full items-center justify-center rounded-lg border border-border-gold bg-deco-surface-soft text-sm text-deco-muted"
          style={{ aspectRatio: "16/9" }}
        >
          <img
            src={current.screenshot}
            alt={current.title}
            className="h-full w-full rounded-lg object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      </div>

      <div className="px-5 pb-3">
        <p className="text-base leading-7 text-deco-muted">{current.body}</p>
      </div>

      <div className="grid items-center gap-3 border-t border-primary-gold-muted p-5" style={{ gridTemplateColumns: "auto 1fr auto" }}>
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
              className={`h-3 w-3 rounded-full border ${
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
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        role="button"
      />
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center p-6">
        <div className="pointer-events-auto w-full max-w-[840px]">{content}</div>
      </div>
    </div>
  );
};

export default OnboardingTour;
