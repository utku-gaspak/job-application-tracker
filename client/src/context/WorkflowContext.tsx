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

export type WorkflowSection = "tracker" | "scrape" | "review" | "apply";

interface WorkflowContextType {
  activeSection: WorkflowSection;
  setActiveSection: (section: WorkflowSection) => void;
  scoutTourView: "upload" | "review" | "apply" | null;
  setScoutTourView: (view: "upload" | "review" | "apply" | null) => void;
  isMissionLoopOpen: boolean;
  openMissionLoop: () => void;
  closeMissionLoop: () => void;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(
  undefined,
);

const WORKFLOW_SECTION_HASH = {
  tracker: "#board",
  scrape: "#scrape",
  review: "#review",
  apply: "#apply",
} as const;

const MISSION_TOUR_SEEN_KEY_PREFIX = "traxr:mission-tour-seen:v1";

const HASH_TO_SECTION: Record<string, WorkflowSection> = {
  "#scrape": "scrape",
  "#review": "review",
  "#saved": "apply",
  "#apply": "apply",
  "#board": "tracker",
  "#scout": "review",
  "#tracker": "tracker",
};

const getSectionFromHash = (hash: string): WorkflowSection =>
  HASH_TO_SECTION[hash.toLowerCase()] ?? "tracker";

export const WorkflowProvider = ({ children }: { children: ReactNode }) => {
  const { username } = useAuth();
  const [activeSection, setActiveSectionState] = useState<WorkflowSection>(() =>
    typeof window === "undefined"
      ? "tracker"
      : getSectionFromHash(window.location.hash),
  );
  const [isMissionLoopOpen, setIsMissionLoopOpen] = useState(false);
  const lastSessionUsernameRef = useRef<string | null>(null);
  const [scoutTourView, setScoutTourView] = useState<
    "upload" | "review" | "apply" | null
  >(null);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      const section = getSectionFromHash(hash);
      setActiveSectionState(section);

      if (hash === "#saved") {
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${WORKFLOW_SECTION_HASH.apply}`,
        );
      }
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
    setIsMissionLoopOpen(true);
  }, []);

  const closeMissionLoop = useCallback(() => {
    setIsMissionLoopOpen(false);
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
    }),
    [
      activeSection,
      setActiveSection,
      isMissionLoopOpen,
      openMissionLoop,
      closeMissionLoop,
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
