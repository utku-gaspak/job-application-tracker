import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type WorkflowSection = "tracker" | "scout";
export type MissionPhase = "triage" | "action" | "summary";

interface WorkflowContextType {
  activeSection: WorkflowSection;
  setActiveSection: (section: WorkflowSection) => void;
  isMissionLoopOpen: boolean;
  openMissionLoop: () => void;
  closeMissionLoop: () => void;
  missionPhase: MissionPhase;
  setMissionPhase: (phase: MissionPhase) => void;
  advanceMissionPhase: () => void;
  missionSavedCount: number;
  missionDiscardedCount: number;
  missionAppliedCount: number;
  incrementMissionSavedCount: () => void;
  incrementMissionDiscardedCount: () => void;
  incrementMissionAppliedCount: () => void;
  resetMissionProgress: () => void;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(
  undefined,
);

const WORKFLOW_SECTION_HASH = {
  tracker: "#tracker",
  scout: "#scout",
} as const;

const MISSION_LOOP_OPEN_EVENT = "traxr:workflow:mission-open";
const MISSION_LOOP_CLOSE_EVENT = "traxr:workflow:mission-close";
const MISSION_LOOP_RESET_EVENT = "traxr:workflow:mission-reset";

const getSectionFromHash = (hash: string): WorkflowSection =>
  hash.toLowerCase() === WORKFLOW_SECTION_HASH.scout ? "scout" : "tracker";

export const WorkflowProvider = ({ children }: { children: ReactNode }) => {
  const [activeSection, setActiveSectionState] = useState<WorkflowSection>(() =>
    typeof window === "undefined"
      ? "tracker"
      : getSectionFromHash(window.location.hash),
  );
  const [isMissionLoopOpen, setIsMissionLoopOpen] = useState(false);
  const [missionPhase, setMissionPhase] = useState<MissionPhase>("triage");
  const [missionSavedCount, setMissionSavedCount] = useState(0);
  const [missionDiscardedCount, setMissionDiscardedCount] = useState(0);
  const [missionAppliedCount, setMissionAppliedCount] = useState(0);

  useEffect(() => {
    const handleHashChange = () => {
      setActiveSectionState(getSectionFromHash(window.location.hash));
    };

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();

    const handleMissionOpen = () => setIsMissionLoopOpen(true);
    const handleMissionClose = () => setIsMissionLoopOpen(false);
    const handleMissionReset = () => {
      setMissionPhase("triage");
      setMissionSavedCount(0);
      setMissionDiscardedCount(0);
      setMissionAppliedCount(0);
    };

    window.addEventListener(MISSION_LOOP_OPEN_EVENT, handleMissionOpen);
    window.addEventListener(MISSION_LOOP_CLOSE_EVENT, handleMissionClose);
    window.addEventListener(MISSION_LOOP_RESET_EVENT, handleMissionReset);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener(MISSION_LOOP_OPEN_EVENT, handleMissionOpen);
      window.removeEventListener(MISSION_LOOP_CLOSE_EVENT, handleMissionClose);
      window.removeEventListener(MISSION_LOOP_RESET_EVENT, handleMissionReset);
    };
  }, []);

  const setActiveSection = (section: WorkflowSection) => {
    setActiveSectionState(section);
    const nextHash = WORKFLOW_SECTION_HASH[section];

    if (window.location.hash !== nextHash) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${nextHash}`,
      );
    }
  };

  const openMissionLoop = () => {
    setMissionPhase("triage");
    setMissionSavedCount(0);
    setMissionDiscardedCount(0);
    setMissionAppliedCount(0);
    setIsMissionLoopOpen(true);
  };

  const closeMissionLoop = () => {
    setIsMissionLoopOpen(false);
  };

  const incrementMissionSavedCount = () => {
    setMissionSavedCount((current) => current + 1);
  };

  const incrementMissionDiscardedCount = () => {
    setMissionDiscardedCount((current) => current + 1);
  };

  const incrementMissionAppliedCount = () => {
    setMissionAppliedCount((current) => current + 1);
  };

  const advanceMissionPhase = () => {
    setMissionPhase((current) =>
      current === "triage" ? "action" : "summary",
    );
  };

  const resetMissionProgress = () => {
    setMissionPhase("triage");
    setMissionSavedCount(0);
    setMissionDiscardedCount(0);
    setMissionAppliedCount(0);
  };

  const value = useMemo(
    () => ({
      activeSection,
      setActiveSection,
      isMissionLoopOpen,
      openMissionLoop,
      closeMissionLoop,
      missionPhase,
      setMissionPhase,
      advanceMissionPhase,
      missionSavedCount,
      missionDiscardedCount,
      missionAppliedCount,
      incrementMissionSavedCount,
      incrementMissionDiscardedCount,
      incrementMissionAppliedCount,
      resetMissionProgress,
    }),
    [activeSection, isMissionLoopOpen, missionPhase, missionSavedCount, missionDiscardedCount, missionAppliedCount],
  );

  return (
    <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>
  );
};

export const useWorkflow = () => {
  const context = useContext(WorkflowContext);

  if (context === undefined) {
    throw new Error("useWorkflow must be used within a WorkflowProvider");
  }

  return context;
};

export const workflowSectionHash = WORKFLOW_SECTION_HASH;
