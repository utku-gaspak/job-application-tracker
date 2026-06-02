import {
  BadgePlus,
  User,
} from "lucide-react";
import { useWorkflow } from "../context/WorkflowContext";
import { Button } from "./ui/button";
import PipelineBar from "./PipelineBar";
import type { ScrapeHistorySummary } from "../types";

const fmt = (value?: number | null) =>
  value == null ? "—" : new Intl.NumberFormat("en-US").format(value);

const fmtTs = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
    : "—";

interface DashboardSidebarProps {
  username: string | null;
  applicationCount: number;
  interviewRate: number;
  offerRate: number;
  scoutSummary: {
    total: number;
    toEvaluate: number;
    toApply: number;
    discarded: number;
  };
  scrapeSummary: ScrapeHistorySummary | null;
  onOpenCreate: () => void;
}

export const DashboardSidebar = ({
  username,
  applicationCount,
  interviewRate,
  offerRate,
  scoutSummary,
  scrapeSummary,
  onOpenCreate,
}: DashboardSidebarProps) => {
  const { activeSection } = useWorkflow();

  return (
    <aside className="deco-frame flex h-auto min-h-0 w-full flex-col items-stretch overflow-visible border-border-gold bg-deco-surface-soft p-4 shadow-deco-panel md:h-full md:overflow-hidden md:p-6">
      <section className="deco-frame border-border-gold bg-deco-surface p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-gold">
          Profile
        </p>
        <div className="mt-2 flex items-center gap-2 text-sm text-deco-foreground">
          <User className="h-4 w-4 text-primary-gold" />
          <span className="truncate font-medium">{username ?? "User"}</span>
        </div>
      </section>

      <div className="mt-4 lg:hidden">
        <PipelineBar
          applicationCount={applicationCount}
          scoutSummary={{
            toEvaluate: scoutSummary.toEvaluate,
            toApply: scoutSummary.toApply,
          }}
        />
      </div>

      <section className="deco-frame mt-4 border-border-gold bg-deco-surface p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-gold">
          {activeSection === "scout" ? "Review Summary" : activeSection === "scrape" ? "Import History" : "Summary"}
        </p>
        {activeSection === "scrape" ? (
          scrapeSummary ? (
            <div className="mt-2 grid gap-2 text-xs uppercase tracking-[0.12em] text-deco-muted">
              <div className="grid gap-2">
                <div className="deco-frame border-border-gold-muted bg-deco-card p-2 text-center">
                  <p className="font-heading text-lg text-deco-foreground">{scrapeSummary.totalJobs}</p>
                  <p className="mt-0.5">Total Jobs</p>
                </div>
                <div className="deco-frame border-border-gold-muted bg-deco-card p-2 text-center">
                  <p className="font-heading text-lg text-deco-foreground">{scrapeSummary.completedJobs}</p>
                  <p className="mt-0.5">Completed</p>
                </div>
                <div className="deco-frame border-border-gold-muted bg-deco-card p-2 text-center">
                  <p className="font-heading text-lg text-deco-foreground">{fmt(scrapeSummary.lastSuccessfulResultCount)}</p>
                  <p className="mt-0.5">New Found</p>
                </div>
                <div className="deco-frame border-border-gold-muted bg-deco-card p-2 text-center">
                  <p className="font-heading text-lg text-deco-foreground">{fmt(scrapeSummary.totalImportedJobs)}</p>
                  <p className="mt-0.5">Imported</p>
                </div>
              </div>
              <div className="border-t border-border-gold-muted pt-2 text-deco-muted">
                <p>Last: {fmtTs(scrapeSummary.lastScrapedAt)}</p>
                <p>Last success: {fmtTs(scrapeSummary.lastSuccessfulScrapedAt)}</p>
              </div>
            </div>
          ) : (
            <div className="deco-frame mt-4 border-border-gold-muted bg-deco-card px-4 py-3 text-sm text-deco-muted">
              Import history will appear after a run completes.
            </div>
          )
        ) : activeSection === "scout" ? (
          <div className="mt-2 grid gap-2 text-xs uppercase tracking-[0.12em] text-deco-muted">
            <div>
              <span className="font-heading text-3xl leading-none text-deco-foreground">
                {scoutSummary.total}
              </span>
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-deco-muted">
                Total Jobs
              </p>
            </div>
            <p>{scoutSummary.toEvaluate} to review</p>
            <p>{scoutSummary.toApply} saved</p>
            <p>{scoutSummary.discarded} discarded</p>
          </div>
        ) : (
          <>
            <div className="mt-2">
              <span className="font-heading text-3xl leading-none">
                {applicationCount}
              </span>
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-deco-muted">
                Total Applications
              </p>
            </div>
            <div className="mt-3 space-y-1 text-xs uppercase tracking-[0.12em] text-deco-muted">
              <p>{interviewRate}% interview rate</p>
              <p>{offerRate}% offer rate</p>
            </div>
          </>
        )}
      </section>

      <div className="mt-4 flex w-full flex-col gap-3">
        <div className="grid grid-cols-1 gap-2">
          {activeSection === "tracker" ? (
            <Button
              aria-label="New Application"
              className="h-10 w-full transition-all hover:opacity-90"
              onClick={onOpenCreate}
              data-tour-id="tracker-add-new"
            >
              <span className="flex w-full items-center justify-center gap-2">
                <BadgePlus className="h-4 w-4 shrink-0" />
                <span>Add New</span>
              </span>
            </Button>
          ) : (
            <div aria-hidden="true" className="h-10" />
          )}
        </div>

        <p className="hidden items-center gap-2 px-1 text-xs font-medium uppercase tracking-[0.2em] text-deco-muted md:flex">
          <span className="h-1 w-1 rounded-full bg-primary-gold" />
          Drag to update status
        </p>
      </div>
    </aside>
  );
};
