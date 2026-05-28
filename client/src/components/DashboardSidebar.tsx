import { useNavigate } from "react-router-dom";
import {
  BadgePlus,
  Binoculars,
  LayoutDashboard,
  Search,
  User,
} from "lucide-react";
import { useWorkflow, type WorkflowSection } from "../context/WorkflowContext";
import { Button } from "./ui/button";

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
  themeButtonVariant: "default" | "outline";
  onOpenCreate: () => void;
}

export const DashboardSidebar = ({
  username,
  applicationCount,
  interviewRate,
  offerRate,
  scoutSummary,
  themeButtonVariant,
  onOpenCreate,
}: DashboardSidebarProps) => {
  const { activeSection, setActiveSection } = useWorkflow();
  const navigate = useNavigate();

  const switchSection = (section: WorkflowSection) => {
    setActiveSection(section);
  };

  return (
    <aside className="deco-frame flex h-auto min-h-0 w-full flex-col items-stretch overflow-visible border-border-gold bg-deco-surface-soft p-5 shadow-deco-panel md:h-full md:overflow-hidden md:p-6">
      <section className="deco-frame border-border-gold bg-deco-surface p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-gold">
          Profile
        </p>
        <div className="mt-2 flex items-center gap-2 text-sm text-deco-foreground">
          <User className="h-4 w-4 text-primary-gold" />
          <span className="truncate font-medium">{username ?? "User"}</span>
        </div>
      </section>

      <section className="deco-frame mt-4 border-border-gold bg-deco-surface p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-gold">
          {activeSection === "scout" ? "Scout Summary" : "Summary"}
        </p>
        {activeSection === "scout" ? (
          <div className="mt-2 grid gap-2 text-xs uppercase tracking-[0.12em] text-deco-muted">
            <div>
              <span className="font-heading text-3xl leading-none text-deco-foreground">
                {scoutSummary.total}
              </span>
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-deco-muted">
                Total Scout Jobs
              </p>
            </div>
            <p>{scoutSummary.toEvaluate} to evaluate</p>
            <p>{scoutSummary.toApply} to apply</p>
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
          <Button
            aria-label="Open Scrape"
            className="h-10 px-2 text-xs uppercase tracking-[0.12em]"
            onClick={() => navigate("/scrape")}
            type="button"
            variant={themeButtonVariant}
          >
            <span className="flex w-full items-center justify-center gap-2">
              <Search className="h-4 w-4 shrink-0" />
              <span>Scrape</span>
            </span>
          </Button>
          <Button
            aria-label="Open Tracker"
            className="h-10 px-2 text-xs uppercase tracking-[0.12em]"
            onClick={() => switchSection("tracker")}
            type="button"
            variant={activeSection === "tracker" ? "default" : themeButtonVariant}
          >
            <span className="flex w-full items-center justify-center gap-2">
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              <span>Tracker</span>
            </span>
          </Button>
          <Button
            aria-label="Open Scout"
            className="h-10 px-2 text-xs uppercase tracking-[0.12em]"
            onClick={() => switchSection("scout")}
            type="button"
            variant={activeSection === "scout" ? "default" : themeButtonVariant}
            data-tour-id="scout-nav"
          >
            <span className="flex w-full items-center justify-center gap-2">
              <Binoculars className="h-4 w-4 shrink-0" />
              <span>Scout</span>
            </span>
          </Button>
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
