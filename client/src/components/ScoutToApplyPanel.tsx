import { useState } from "react";
import { ExternalLink, Eye, ListChecks, Save, Trash2 } from "lucide-react";
import type { ScoutJob } from "../types";
import { formatDateDe, splitTechStack } from "../lib/utils";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface ScoutToApplyPanelProps {
  mode: "saved" | "apply";
  isLoading: boolean;
  toApplyJobs: ScoutJob[];
  isActing: boolean;
  jobsLength: number;
  onMarkAsApplied: (job: ScoutJob) => void;
  onRemove: (job: ScoutJob) => void;
  onDeleteAll: () => void;
  onStartApplying: () => void;
  onViewBoard: () => void;
}

const compactTools = (job: ScoutJob) => splitTechStack(job.technicalTools).slice(0, 2);

export const ScoutToApplyPanel = ({
  mode,
  isLoading,
  toApplyJobs,
  isActing,
  jobsLength,
  onMarkAsApplied,
  onRemove,
  onDeleteAll,
  onStartApplying,
  onViewBoard,
}: ScoutToApplyPanelProps) => {
  const [viewMode, setViewMode] = useState<"detailed" | "list">("list");
  const isApplyMode = mode === "apply";

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden" data-tour-id="scout-to-apply-panel">
      <CardHeader className="shrink-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>{isApplyMode ? "Apply" : "Saved"}</CardTitle>
          <p className="mt-1 text-sm text-deco-muted">
            {toApplyJobs.length > 0
              ? isApplyMode
                ? `${toApplyJobs.length} jobs ready to apply.`
                : `${toApplyJobs.length} jobs saved for later.`
              : "No saved jobs yet."}
          </p>
        </div>
        {!isApplyMode ? (
          <Button
            className="h-9 w-full justify-center px-3 sm:w-auto"
            disabled={toApplyJobs.length === 0}
            onClick={onStartApplying}
            type="button"
          >
            <ListChecks className="h-4 w-4" />
            Start applying
          </Button>
        ) : (
          <Button
            className="h-9 w-full justify-center px-3 sm:w-auto"
            onClick={onViewBoard}
            type="button"
            variant="outline"
          >
            <Eye className="h-4 w-4" />
            View board
          </Button>
        )}
        <Button
          aria-pressed={viewMode === "list"}
          className="h-9 w-full justify-center px-3 sm:w-auto"
          onClick={() =>
            setViewMode((current) =>
              current === "detailed" ? "list" : "detailed",
            )
          }
          type="button"
          variant="outline"
        >
          <span className="inline-flex items-center gap-2">
            {viewMode === "detailed" ? (
              <Eye className="h-4 w-4" />
            ) : (
              <ListChecks className="h-4 w-4" />
            )}
            {viewMode === "detailed" ? "List view" : "Detail view"}
          </span>
        </Button>
        <Button
          disabled={isActing || jobsLength === 0}
          className="w-full justify-center sm:w-auto"
          onClick={() => void onDeleteAll()}
          type="button"
          variant="ghost"
        >
          <Trash2 className="h-4 w-4" />
          Clear All Jobs
        </Button>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {isLoading ? (
          <p className="text-sm text-deco-muted">Loading jobs...</p>
        ) : null}

        {!isLoading && toApplyJobs.length > 0 ? (
          <div
            className={`mt-3 flex-1 overflow-y-auto pr-1 ${
              viewMode === "list" ? "space-y-2" : "space-y-3"
            }`}
          >
            {toApplyJobs.map((job) => {
              const jobTools = splitTechStack(job.technicalTools);
              const listTools = compactTools(job);
              const applyHref = job.applyUrl ?? null;

              return (
                <article
                  className={`deco-frame border-border-gold bg-deco-surface-soft shadow-deco-panel ${
                    viewMode === "list" ? "px-3 py-2" : "p-3"
                  }`}
                  key={job.id}
                >
                  <div className={viewMode === "list" ? "md:hidden" : "hidden"}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-col gap-1">
                          <p className="truncate text-xs font-semibold uppercase tracking-[0.2em] text-primary-gold">
                            {job.company}
                          </p>
                          <h3 className="truncate font-heading text-sm text-deco-foreground">
                            {job.title}
                          </h3>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {isApplyMode ? (
                          <Button
                            disabled={isActing}
                            className="h-9 w-9 shrink-0 p-0"
                            onClick={() => void onMarkAsApplied(job)}
                            type="button"
                            title="Mark applied"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button
                          disabled={isActing}
                          className="h-9 w-9 shrink-0 p-0"
                          onClick={() => void onRemove(job)}
                          type="button"
                          variant="outline"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {applyHref ? (
                          <Button
                            asChild
                            className="h-9 w-9 shrink-0 p-0"
                            size="sm"
                            variant="outline"
                            title="Open apply link"
                          >
                            <a href={applyHref} rel="noreferrer" target="_blank">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:block">
                    <div
                      className={`flex ${
                        viewMode === "list"
                          ? "flex-col gap-2 xl:flex-row xl:items-center xl:justify-between"
                          : "flex-col gap-2 lg:flex-row lg:items-start lg:justify-between"
                      }`}
                    >
                      <div className="min-w-0">
                        {viewMode === "list" ? (
                          <>
                            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-deco-muted">
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-gold">
                                {job.company}
                              </p>
                              <span className="text-deco-muted">—</span>
                              <h3 className="truncate font-heading text-sm text-deco-foreground">
                                {job.title}
                              </h3>
                              {listTools.length > 0 ? (
                                <>
                                  <span className="text-deco-muted">—</span>
                                  <span className="truncate">
                                    {listTools.join(", ")}
                                  </span>
                                </>
                              ) : null}
                              <span className="text-deco-muted">—</span>
                              <span>
                                {job.workplaceType ?? "Not provided"}
                                {job.location ? `, ${job.location}` : ""}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-gold">
                                {job.company}
                              </p>
                              <span className="text-sm text-deco-muted">—</span>
                              <h3 className="font-heading text-xl text-deco-foreground">
                                {job.title}
                              </h3>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-deco-muted">
                              <span>{job.location ?? "Not provided"}</span>
                              {job.workplaceType ? <span>• {job.workplaceType}</span> : null}
                              {job.commitment ? <span>• {job.commitment}</span> : null}
                              <span>• {formatDateDe(job.postedAt)}</span>
                            </div>
                          </>
                        )}
                      </div>

                      {viewMode === "list" ? (
                        <div className="flex shrink-0 items-center gap-2">
                          {isApplyMode ? (
                            <Button
                              disabled={isActing}
                              className="h-9 px-3"
                              onClick={() => void onMarkAsApplied(job)}
                              type="button"
                            >
                              <Save className="h-4 w-4" />
                              Mark applied
                            </Button>
                          ) : null}
                          <Button
                            disabled={isActing}
                            className="h-9 px-3"
                            onClick={() => void onRemove(job)}
                            type="button"
                            variant="outline"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {applyHref ? (
                            <Button
                              asChild
                              className="h-9 shrink-0"
                              size="sm"
                              variant="outline"
                            >
                              <a href={applyHref} rel="noreferrer" target="_blank">
                                <ExternalLink className="h-4 w-4" />
                                Open apply link
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      ) : applyHref ? (
                        <Button asChild className="h-9 shrink-0" size="sm" variant="outline">
                          <a href={applyHref} rel="noreferrer" target="_blank">
                            <ExternalLink className="h-4 w-4" />
                            Open apply link
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {viewMode === "detailed" && jobTools.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {jobTools.map((tool) => (
                        <span
                          className="deco-frame border-border-gold-muted bg-deco-card px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-deco-foreground"
                          key={tool}
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {viewMode === "detailed" ? (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {isApplyMode ? (
                        <Button
                          disabled={isActing}
                          className="h-9 w-full justify-center px-3 sm:w-auto"
                          onClick={() => void onMarkAsApplied(job)}
                          type="button"
                        >
                          <Save className="h-4 w-4" />
                          Mark applied
                        </Button>
                      ) : null}
                      <Button
                        disabled={isActing}
                        className="h-9 w-full justify-center px-3 sm:w-auto"
                        onClick={() => void onRemove(job)}
                        type="button"
                        variant="outline"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : null}

        {!isLoading && toApplyJobs.length === 0 ? (
          <div className="deco-frame border-border-gold-muted bg-deco-surface-soft px-5 py-10 text-center">
            <p className="font-heading text-2xl text-deco-foreground">
              No saved jobs yet.
            </p>
            <p className="mt-3 text-sm text-deco-muted">
              Save jobs from Review to build your saved list.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
