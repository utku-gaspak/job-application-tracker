import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type WorkflowSection = "tracker" | "scout";

interface WorkflowContextType {
  activeSection: WorkflowSection;
  setActiveSection: (section: WorkflowSection) => void;
  isWelcomeWizardOpen: boolean;
  openWelcomeWizard: () => void;
  closeWelcomeWizard: () => void;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(
  undefined,
);

const WORKFLOW_SECTION_HASH = {
  tracker: "#tracker",
  scout: "#scout",
} as const;

const WELCOME_WIZARD_OPEN_EVENT = "traxr:workflow:wizard-open";
const WELCOME_WIZARD_CLOSE_EVENT = "traxr:workflow:wizard-close";

const getSectionFromHash = (hash: string): WorkflowSection =>
  hash.toLowerCase() === WORKFLOW_SECTION_HASH.scout ? "scout" : "tracker";

export const WorkflowProvider = ({ children }: { children: ReactNode }) => {
  const [activeSection, setActiveSectionState] = useState<WorkflowSection>(() =>
    typeof window === "undefined"
      ? "tracker"
      : getSectionFromHash(window.location.hash),
  );
  const [isWelcomeWizardOpen, setIsWelcomeWizardOpen] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      setActiveSectionState(getSectionFromHash(window.location.hash));
    };

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();

    const handleWizardOpen = () => setIsWelcomeWizardOpen(true);
    const handleWizardClose = () => setIsWelcomeWizardOpen(false);

    window.addEventListener(WELCOME_WIZARD_OPEN_EVENT, handleWizardOpen);
    window.addEventListener(WELCOME_WIZARD_CLOSE_EVENT, handleWizardClose);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener(WELCOME_WIZARD_OPEN_EVENT, handleWizardOpen);
      window.removeEventListener(WELCOME_WIZARD_CLOSE_EVENT, handleWizardClose);
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

  const openWelcomeWizard = () => {
    setIsWelcomeWizardOpen(true);
  };

  const closeWelcomeWizard = () => {
    setIsWelcomeWizardOpen(false);
  };

  const value = useMemo(
    () => ({
      activeSection,
      setActiveSection,
      isWelcomeWizardOpen,
      openWelcomeWizard,
      closeWelcomeWizard,
    }),
    [activeSection, isWelcomeWizardOpen],
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
