import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";

export type WorkflowSection = "tracker" | "scout";
export type MissionPhase = "triage" | "action" | "summary";

interface WorkflowContextType {
  activeSection: WorkflowSection;
  setActiveSection: (section: WorkflowSection) => void;
  scoutTourView: "upload" | "evaluate" | "to-apply" | null;
  setScoutTourView: (view: "upload" | "evaluate" | "to-apply" | null) => void;
  isMissionLoopOpen: boolean;
  openMissionLoop: () => void;
  closeMissionLoop: () => void;
  missionPhase: MissionPhase;
  setMissionPhase: (phase: MissionPhase) => void;
  advanceMissionPhase: () => void;
  missionStepIndex: number;
  setMissionStepIndex: (index: number) => void;
  advanceMissionStep: () => void;
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

const MISSION_TOUR_SEEN_KEY_PREFIX = "traxr:mission-tour-seen:v1";

const getSectionFromHash = (hash: string): WorkflowSection =>
  hash.toLowerCase() === WORKFLOW_SECTION_HASH.scout ? "scout" : "tracker";

export const WorkflowProvider = ({ children }: { children: ReactNode }) => {
  const { username } = useAuth();
  const [activeSection, setActiveSectionState] = useState<WorkflowSection>(() =>
    typeof window === "undefined"
      ? "tracker"
      : getSectionFromHash(window.location.hash),
  );
  const [isMissionLoopOpen, setIsMissionLoopOpen] = useState(false);
  const [missionPhase, setMissionPhase] = useState<MissionPhase>("triage");
  const [missionStepIndex, setMissionStepIndex] = useState(0);
  const [missionSavedCount, setMissionSavedCount] = useState(0);
  const [missionDiscardedCount, setMissionDiscardedCount] = useState(0);
  const [missionAppliedCount, setMissionAppliedCount] = useState(0);
  const lastSessionUsernameRef = useRef<string | null>(null);
  const [scoutTourView, setScoutTourView] = useState<
    "upload" | "evaluate" | "to-apply" | null
  >(null);

  useEffect(() => {
    const handleHashChange = () => {
      setActiveSectionState(getSectionFromHash(window.location.hash));
    };

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  const setActiveSection = useCallback((section: WorkflowSection) => {
    setActiveSectionState(section);
    const nextHash = WORKFLOW_SECTION_HASH[section];

    if (window.location.hash !== nextHash) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${nextHash}`,
      );
    }
  }, []);

  const openMissionLoop = useCallback(() => {
    setMissionPhase("triage");
    setMissionStepIndex(0);
    setMissionSavedCount(0);
    setMissionDiscardedCount(0);
    setMissionAppliedCount(0);
    setIsMissionLoopOpen(true);
  }, []);

  const closeMissionLoop = useCallback(() => {
    setIsMissionLoopOpen(false);
  }, []);

  const incrementMissionSavedCount = useCallback(() => {
    setMissionSavedCount((current) => current + 1);
  }, []);

  const incrementMissionDiscardedCount = useCallback(() => {
    setMissionDiscardedCount((current) => current + 1);
  }, []);

  const incrementMissionAppliedCount = useCallback(() => {
    setMissionAppliedCount((current) => current + 1);
  }, []);

  const advanceMissionPhase = useCallback(() => {
    setMissionPhase((current) =>
      current === "triage" ? "action" : "summary",
    );
  }, []);

  const advanceMissionStep = useCallback(() => {
    setMissionStepIndex((current) => current + 1);
  }, []);

  const resetMissionProgress = useCallback(() => {
    setMissionPhase("triage");
    setMissionSavedCount(0);
    setMissionDiscardedCount(0);
    setMissionAppliedCount(0);
  }, []);

  useEffect(() => {
    if (!username) {
      lastSessionUsernameRef.current = null;
      return;
    }

    const normalizedUsername = username.toLowerCase();
    const previousUsername =
      lastSessionUsernameRef.current?.toLowerCase() ?? null;

    if (previousUsername === normalizedUsername) {
      return;
    }

    lastSessionUsernameRef.current = username;

    if (normalizedUsername === "demo") {
      openMissionLoop();
      return;
    }

    const seenKey = `${MISSION_TOUR_SEEN_KEY_PREFIX}:${normalizedUsername}`;
    const hasSeenTour = window.localStorage.getItem(seenKey) === "true";

    if (!hasSeenTour) {
      window.localStorage.setItem(seenKey, "true");
      openMissionLoop();
    }
  }, [openMissionLoop, username]);

  const value = useMemo(
    () => ({
      activeSection,
      setActiveSection,
      scoutTourView,
      setScoutTourView,
      isMissionLoopOpen,
      openMissionLoop,
      closeMissionLoop,
      missionPhase,
      setMissionPhase,
      advanceMissionPhase,
      missionStepIndex,
      setMissionStepIndex,
      advanceMissionStep,
      missionSavedCount,
      missionDiscardedCount,
      missionAppliedCount,
      incrementMissionSavedCount,
      incrementMissionDiscardedCount,
      incrementMissionAppliedCount,
      resetMissionProgress,
    }),
    [
      activeSection,
      setActiveSection,
      isMissionLoopOpen,
      openMissionLoop,
      closeMissionLoop,
      missionPhase,
      setMissionPhase,
      advanceMissionPhase,
      missionStepIndex,
      setMissionStepIndex,
      advanceMissionStep,
      missionSavedCount,
      missionDiscardedCount,
      missionAppliedCount,
      incrementMissionSavedCount,
      incrementMissionDiscardedCount,
      incrementMissionAppliedCount,
      resetMissionProgress,
      scoutTourView,
    ],
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
