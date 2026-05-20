import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Binoculars,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  BarChart3,
  FileUp,
  Filter,
  LayoutGrid,
  Plus,
  Eye,
  ListChecks,
  X,
} from "lucide-react";
import { useWorkflow } from "../context/WorkflowContext";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

interface MissionLoopProps {
  open: boolean;
  onGoScout: () => void;
  onGoTracker: () => void;
  onGoDiagram: () => void;
  onAdvancePhase: () => void;
}

type MissionStep = {
  id: string;
  anchorId: string | null;
  section: "tracker" | "scout";
  scoutView?: "upload" | "evaluate" | "to-apply";
  title: string;
  icon: typeof CircleHelp;
  body: string;
};

const missionSteps: readonly MissionStep[] = [
  {
    id: "mission-intro",
    anchorId: null,
    section: "tracker" as const,
    title: "Welcome to Traxr",
    icon: CircleHelp,
    body: "Quick tour of the main tracker and scout actions.",
  },
  {
    id: "tracker-add-new",
    anchorId: "tracker-add-new",
    section: "tracker" as const,
    title: "Add new applications",
    icon: Plus,
    body: "Add a role straight into the tracker.",
  },
  {
    id: "tracker-filters",
    anchorId: "tracker-filters",
    section: "tracker" as const,
    title: "Filter the board",
    icon: Filter,
    body: "Search, status, interest, and skills are here.",
  },
  {
    id: "tracker-board",
    anchorId: "tracker-board",
    section: "tracker" as const,
    title: "Move cards through the board",
    icon: LayoutGrid,
    body: "Drag applications between board columns.",
  },
  {
    id: "tracker-diagram",
    anchorId: "tracker-diagram",
    section: "tracker" as const,
    title: "Switch to the diagram",
    icon: BarChart3,
    body: "Use the diagram to review your board status.",
  },
  {
    id: "scout-header",
    anchorId: "scout-header",
    section: "scout" as const,
    title: "Open Scout",
    icon: Binoculars,
    body: "Scout holds jobs before they reach the tracker.",
  },
  {
    id: "scout-upload-panel",
    anchorId: "scout-upload-panel",
    section: "scout" as const,
    scoutView: "upload" as const,
    title: "Upload jobs",
    icon: FileUp,
    body: "Import jobs.json or add one manually.",
  },
  {
    id: "scout-evaluate-panel",
    anchorId: "scout-evaluate-panel",
    section: "scout" as const,
    scoutView: "evaluate" as const,
    title: "Evaluate jobs",
    icon: Eye,
    body: "Save jobs for later or discard them.",
  },
  {
    id: "scout-to-apply-panel",
    anchorId: "scout-to-apply-panel",
    section: "scout" as const,
    scoutView: "to-apply" as const,
    title: "To Apply list",
    icon: ListChecks,
    body: "Saved jobs stay here until applied.",
  },
] as const;

const TOUR_WIDTH = 620;
const TOUR_GAP = 14;
const MOBILE_BREAKPOINT = 768;
type AnchorStyle = {
  top: number;
  left: number;
  width: number;
};

const restoreTargetStyle = (target: HTMLElement | null) => {
  if (!target) {
    return;
  }

  target.style.boxShadow = "";
  target.style.position = "";
  target.style.zIndex = "";
  target.style.borderRadius = "";
};

const MissionLoop = ({
  open,
  onGoScout,
  onGoTracker,
  onGoDiagram,
  onAdvancePhase,
}: MissionLoopProps) => {
  const {
    activeSection,
    closeMissionLoop,
    missionStepIndex,
    setMissionStepIndex,
    advanceMissionStep,
    scoutTourView,
    setScoutTourView,
  } =
    useWorkflow();
  const [anchorStyle, setAnchorStyle] = useState<AnchorStyle | null>(null);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const currentTargetRef = useRef<HTMLElement | null>(null);
  const currentStep = useMemo(
    () => missionSteps[missionStepIndex],
    [missionStepIndex],
  );
  const CurrentIcon = currentStep.icon;

  useEffect(() => {
    if (!open) {
      setMissionStepIndex(0);
      setAnchorStyle(null);
      setIsMobileLayout(false);
      restoreTargetStyle(currentTargetRef.current);
      currentTargetRef.current = null;
    }
  }, [open, setMissionStepIndex]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (currentStep.section === "tracker") {
      onGoTracker();
      if (currentStep.id === "tracker-diagram") {
        onGoDiagram();
      }
      return;
    }

    onGoScout();

    if ("scoutView" in currentStep && currentStep.scoutView && scoutTourView !== currentStep.scoutView) {
      setScoutTourView(currentStep.scoutView);
    }
  }, [currentStep, open, onGoDiagram, onGoScout, onGoTracker, scoutTourView, setScoutTourView]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const mobileMode = window.innerWidth < MOBILE_BREAKPOINT;
    setIsMobileLayout(mobileMode);

    if (mobileMode) {
      setAnchorStyle({
        top: Math.max(12, window.innerHeight - 252),
        left: 6,
        width: window.innerWidth - 12,
      });
      return;
    }

    let animationFrame = 0;
    let cancelled = false;
    let activeTarget: HTMLElement | null = null;
    let cleanupTarget: (() => void) | null = null;

    const updatePlacementForTarget = (target: HTMLElement) => {
      if (currentTargetRef.current && currentTargetRef.current !== target) {
        restoreTargetStyle(currentTargetRef.current);
      }

      currentTargetRef.current = target;
      target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });

      const originalBoxShadow = target.style.boxShadow;
      const originalPosition = target.style.position;
      const originalZIndex = target.style.zIndex;
      const originalBorderRadius = target.style.borderRadius;

      target.style.position = "relative";
      target.style.zIndex = "61";
      target.style.boxShadow =
        "0 0 0 2px rgba(212, 175, 55, 0.95), 0 0 0 8px rgba(212, 175, 55, 0.2)";
      target.style.borderRadius = "0.35rem";

      const updatePlacement = () => {
        const rect = target.getBoundingClientRect();
        const width = Math.min(TOUR_WIDTH, window.innerWidth - 24);
        const isWideTarget = rect.width >= 320 || rect.width >= width * 0.7;
        const fitsBelow = rect.bottom + TOUR_GAP + 180 <= window.innerHeight - 12;
        const fitsLeft = rect.left - TOUR_GAP - width >= 12;

        let left = rect.left + rect.width / 2 - width / 2;
        let top = rect.bottom + TOUR_GAP;

        if (isWideTarget && fitsLeft) {
          left = rect.left - TOUR_GAP - width;
          top = rect.top + rect.height / 2 - 90;
        } else if (!fitsBelow) {
          if (fitsLeft) {
            left = rect.left - TOUR_GAP - width;
            top = rect.top + rect.height / 2 - 90;
          } else {
            top = rect.top - TOUR_GAP - 180;
          }
        }

        if (top < 12) {
          top = 12;
        }

        const maxTop = window.innerHeight - 210;
        if (top > maxTop) {
          top = maxTop;
        }

        setAnchorStyle({
          top,
          left: Math.max(12, Math.min(left, window.innerWidth - width - 12)),
          width,
        });
      };

      updatePlacement();
      window.addEventListener("scroll", updatePlacement, true);
      window.addEventListener("resize", updatePlacement);

      return () => {
        window.removeEventListener("scroll", updatePlacement, true);
        window.removeEventListener("resize", updatePlacement);
        target.style.boxShadow = originalBoxShadow;
        target.style.position = originalPosition;
        target.style.zIndex = originalZIndex;
        target.style.borderRadius = originalBorderRadius;
      };
    };

    const scheduleTargetCheck = () => {
      if (cancelled) {
        return;
      }

      if (currentStep.anchorId === null) {
        const width = Math.min(TOUR_WIDTH, window.innerWidth - 24);
        setAnchorStyle({
          top: Math.max(24, window.innerHeight / 2 - 170),
          left: Math.max(12, (window.innerWidth - width) / 2),
          width,
        });
        return;
      }

      const target = document.querySelector(
        `[data-tour-id="${currentStep.anchorId}"]`,
      ) as HTMLElement | null;

      if (!target) {
        animationFrame = window.requestAnimationFrame(scheduleTargetCheck);
        return;
      }

      activeTarget = target;
      cleanupTarget = updatePlacementForTarget(target);
    };

    animationFrame = window.requestAnimationFrame(scheduleTargetCheck);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
      cleanupTarget?.();
      restoreTargetStyle(activeTarget ?? currentTargetRef.current);
      cleanupTarget = null;
      activeTarget = null;
    };
  }, [currentStep, open, activeSection, scoutTourView]);

  const goBack = () => {
    if (missionStepIndex === 0) {
      closeMissionLoop();
      return;
    }

    setMissionStepIndex(missionStepIndex - 1);
  };

  const goNext = () => {
    if (missionStepIndex === missionSteps.length - 1) {
      onGoTracker();
      closeMissionLoop();
      return;
    }

    advanceMissionStep();
    onAdvancePhase();
  };

  if (!open || !anchorStyle) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        aria-label="Close mission tour"
        className="absolute inset-0 cursor-default bg-black/18"
        onClick={() => closeMissionLoop()}
        type="button"
      />

      <Card
        className={cn(
          "deco-frame-thick fixed z-[71] border-border-gold bg-deco-bg/78 shadow-deco-panel backdrop-blur-md",
          isMobileLayout && "rounded-none bg-deco-bg/95 backdrop-blur-sm",
        )}
        style={{
          top: anchorStyle.top,
          left: anchorStyle.left,
          width: anchorStyle.width,
          maxHeight: isMobileLayout ? "calc(100dvh - 24px)" : undefined,
        }}
      >
        <CardContent
          className={cn(
            "grid gap-3 p-4",
            isMobileLayout && "max-h-[calc(100dvh-24px)] overflow-y-auto p-3",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-primary-gold">
                Step {missionStepIndex + 1} of {missionSteps.length}
              </p>
              <h3 className="mt-1 flex items-center gap-2 font-heading text-xl text-deco-foreground">
                <CurrentIcon className="h-5 w-5 shrink-0 text-primary-gold" />
                {currentStep.title}
              </h3>
            </div>
            <Button
              aria-label="Close mission tour"
              className="h-8 w-8 p-0"
              onClick={() => closeMissionLoop()}
              type="button"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <p
            className={cn(
              "text-sm leading-6 text-deco-muted",
              isMobileLayout && "text-[0.8rem] leading-5",
            )}
          >
            {currentStep.body}
          </p>

          <div
            className={cn(
              "grid items-center gap-3 border-t border-primary-gold-muted pt-3",
              isMobileLayout
                ? "grid-cols-1"
                : "grid-cols-[auto_1fr_auto]",
            )}
          >
            <Button
              className={cn("justify-center", isMobileLayout ? "w-full" : "ml-2")}
              type="button"
              variant="outline"
              onClick={goBack}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>

            <div className="flex items-center justify-center gap-2">
              {missionSteps.map((step, index) => (
                <span
                  aria-hidden="true"
                  key={step.id}
                  className={cn(
                    "h-2.5 w-2.5 rounded-full border",
                    index === missionStepIndex
                      ? "border-primary-gold bg-primary-gold"
                      : "border-border-gold bg-transparent",
                  )}
                />
              ))}
            </div>

            <Button
              className={cn("justify-center", isMobileLayout ? "w-full" : "mr-2")}
              type="button"
              onClick={goNext}
            >
              {missionStepIndex === missionSteps.length - 1 ? "Finish" : "Next"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MissionLoop;
