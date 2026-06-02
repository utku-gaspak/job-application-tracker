import { ChevronRight } from "lucide-react";
import { useWorkflow, type WorkflowSection } from "../context/WorkflowContext";

interface PipelineBarProps {
  applicationCount: number;
  scoutSummary: {
    toEvaluate: number;
    toApply: number;
  };
}

interface StepDef {
  step: number;
  label: string;
  count: number;
  countLabel: string;
  section: WorkflowSection;
}

const PipelineBar = ({ applicationCount, scoutSummary }: PipelineBarProps) => {
  const { activeSection, setActiveSection } = useWorkflow();

  const steps: StepDef[] = [
    { step: 1, label: "Scrape", count: 0, countLabel: "", section: "scrape" },
    { step: 2, label: "Review", count: scoutSummary.toEvaluate, countLabel: "to review", section: "review" },
    { step: 3, label: "Saved", count: scoutSummary.toApply, countLabel: "saved", section: "saved" },
    { step: 4, label: "Apply", count: scoutSummary.toApply, countLabel: "ready", section: "apply" },
    { step: 5, label: "Board", count: applicationCount, countLabel: "tracking", section: "tracker" },
  ];

  return (
    <div className="deco-frame flex items-stretch gap-0 border-border-gold bg-deco-surface p-0.5 shadow-sm">
      {steps.map((step, index) => {
        const active = activeSection === step.section;
        const hasItems = step.count > 0;

        return (
          <div key={step.section} className="flex min-w-0 flex-1 items-stretch">
            {index > 0 && (
              <div className="flex shrink-0 items-center px-0.5 text-primary-gold/30 sm:px-1" aria-hidden="true">
                <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
              </div>
            )}
            <button
              type="button"
              onClick={() => setActiveSection(step.section)}
              aria-label={`${step.label}${hasItems ? ` — ${step.count} ${step.countLabel}` : ""}`}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-base transition-all hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-gold sm:gap-2 sm:px-4 ${
                active
                  ? "border border-primary-gold bg-primary-gold/15 text-deco-foreground font-semibold shadow-inner"
                  : "border border-transparent bg-deco-surface-soft text-deco-muted hover:text-deco-foreground hover:bg-deco-surface"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  active
                    ? "bg-primary-gold text-deco-surface"
                    : hasItems
                      ? "border-2 border-primary-gold text-primary-gold"
                      : "border-2 border-deco-muted text-deco-muted"
                }`}
                aria-hidden="true"
              >
                {step.step}
              </span>
              <span className="truncate hidden sm:inline">{step.label}</span>
              <span className="truncate sm:hidden text-sm">{step.label.split(" ")[0]}</span>
              {hasItems && (
                <span className={`hidden sm:inline text-sm ${active ? "text-deco-muted" : "text-deco-muted/60"}`}>
                  {step.count} {step.countLabel}
                </span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default PipelineBar;
