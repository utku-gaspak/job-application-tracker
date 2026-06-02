import { useEffect, useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Save,
  Trash2,
} from "lucide-react";
import type { ScoutJob } from "../types";
import { formatDateDe, splitTechStack } from "../lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface ScoutEvaluatePanelProps {
  isLoading: boolean;
  currentJob: ScoutJob | null;
  currentIndex: number;
  evaluateCount: number;
  isActing: boolean;
  jobsLength: number;
  onDiscard: () => void;
  onSkip: () => void;
  onSaveForLater: () => void;
  onDeleteAll: () => void;
  isActive: boolean;
  savedCount: number;
  onGoToSaved: () => void;
}

export const ScoutEvaluatePanel = ({
  isLoading,
  currentJob,
  currentIndex,
  evaluateCount,
  isActing,
  jobsLength,
  onDiscard,
  onSkip,
  onSaveForLater,
  onDeleteAll,
  isActive,
  savedCount,
  onGoToSaved,
}: ScoutEvaluatePanelProps) => {
  const currentTools = useMemo(
    () => splitTechStack(currentJob?.technicalTools),
    [currentJob],
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable === true;

      if (isEditableTarget) {
        return;
      }

      if (event.key === "ArrowRight" || event.key.toLowerCase() === "l") {
        event.preventDefault();
        onSaveForLater();
      }

      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "h") {
        event.preventDefault();
        onDiscard();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onSkip();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onDiscard, onSaveForLater, onSkip, isActive]);

  return (
    <Card className="min-h-0 flex-1 overflow-hidden" data-tour-id="scout-evaluate-panel">
      <CardHeader className="flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <CardTitle>Review</CardTitle>
          <p className="mt-1 text-sm text-deco-muted">
            {currentJob
              ? `${Math.min(currentIndex + 1, evaluateCount)} of ${evaluateCount} remaining`
              : "No jobs waiting."}
          </p>
        </div>
        <Button
          disabled={isActing || jobsLength === 0}
          className="w-full sm:w-auto"
          onClick={() => void onDeleteAll()}
          type="button"
          variant="ghost"
        >
          <Trash2 className="h-4 w-4" />
          Clear All Jobs
        </Button>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <p className="text-sm text-deco-muted">Loading jobs...</p>
        ) : null}

        {!isLoading && currentJob ? (
          <article className="deco-frame border-border-gold bg-deco-surface-soft p-4 shadow-deco-panel">
            <div
              className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
              data-tour-id="scout-evaluate-card"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-gold">
                  {currentJob.company}
                </p>
                <h3 className="mt-2 font-heading text-2xl text-deco-foreground sm:text-3xl">
                  {currentJob.title}
                </h3>
              </div>
              <Badge>{formatDateDe(currentJob.postedAt)}</Badge>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="deco-frame border-border-gold-muted bg-deco-surface px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-gold">
                  Location
                </p>
                <p className="mt-1 text-sm text-deco-foreground">
                  {currentJob.location ?? "Not provided"}
                </p>
              </div>
              <div className="deco-frame border-border-gold-muted bg-deco-surface px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-gold">
                  Workplace
                </p>
                <p className="mt-1 text-sm text-deco-foreground">
                  {currentJob.workplaceType ?? "Not provided"}
                </p>
              </div>
              <div className="deco-frame border-border-gold-muted bg-deco-surface px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-gold">
                  Commitment
                </p>
                <p className="mt-1 text-sm text-deco-foreground">
                  {currentJob.commitment ?? "Not provided"}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-gold">
                Skills
              </p>
              {currentTools.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {currentTools.map((tool) => (
                    <span
                      className="deco-frame border-border-gold-muted bg-deco-card px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-deco-foreground"
                      key={tool}
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-deco-muted">Not provided</p>
              )}
            </div>

            <div className="mt-5 grid gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-gold">
                Requirements Summary
              </p>
              <div className="deco-frame max-h-48 overflow-y-auto border-border-gold-muted bg-deco-surface p-3">
                <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-deco-foreground">
                  {currentJob.requirementsSummary?.trim() ||
                    "No requirements summary provided."}
                </pre>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {currentJob.jobUrl ? (
                <a
                  className="inline-flex items-center gap-2 text-sm text-deco-foreground underline decoration-primary-gold underline-offset-4 hover:text-primary-gold"
                  href={currentJob.jobUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink className="h-4 w-4" />
                  Job page
                </a>
              ) : null}
              {currentJob.applyUrl ? (
                <a
                  className="inline-flex items-center gap-2 text-sm text-deco-foreground underline decoration-primary-gold underline-offset-4 hover:text-primary-gold"
                  href={currentJob.applyUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink className="h-4 w-4" />
                  Apply page
                </a>
              ) : null}
            </div>

            <div className="mt-6 grid gap-3 border-t border-primary-gold-muted pt-4 sm:grid-cols-3">
              <Button
                disabled={isActing}
                className="w-full justify-center"
                onClick={() => void onDiscard()}
                type="button"
                variant="outline"
              >
                <ArrowLeft className="h-4 w-4" />
                Discard
              </Button>
              <Button
                disabled={isActing}
                className="w-full justify-center"
                onClick={onSkip}
                type="button"
                variant="ghost"
              >
                Skip for now
              </Button>
              <Button
                disabled={isActing}
                className="w-full justify-center"
                onClick={() => void onSaveForLater()}
                type="button"
              >
                <Save className="h-4 w-4" />
                Save for later
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <p className="mt-4 hidden text-xs uppercase tracking-[0.12em] text-deco-muted md:block">
              Shortcuts: H or Left = discard, L or Right = save for later, Escape = skip
            </p>
          </article>
        ) : null}

        {!isLoading && !currentJob ? (
          <div className="deco-frame border-border-gold-muted bg-deco-surface-soft px-5 py-10 text-center">
            <p className="font-heading text-2xl text-deco-foreground">
              No jobs in this pass.
            </p>
            <p className="mt-3 text-sm text-deco-muted">
              Upload a new jobs.json file or refresh the queue.
            </p>
            {savedCount > 0 ? (
              <Button className="mt-6" onClick={onGoToSaved} type="button">
                Go to saved jobs
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
