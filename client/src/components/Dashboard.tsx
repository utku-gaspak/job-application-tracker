import axios from "axios";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  BadgePlus,
  ArrowUpDown,
  Binoculars,
  ChevronDown,
  BarChart3,
  Diamond,
  CircleHelp,
  ExternalLink,
  Download,
  FileText,
  FileDigit,
  Filter,
  LayoutDashboard,
  LogOut,
  Moon,
  Search,
  SunMedium,
  Trash2,
  User,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { useWorkflow, type WorkflowSection } from "../context/WorkflowContext";
import Footer from "./Footer";
import MissionLoop from "./MissionLoop";
import TrackerStatusSankey from "./TrackerStatusSankey";
import {
  createJobApplication,
  deleteJobApplication,
  listJobApplications,
  updateJobApplication,
} from "../api/jobApplicationsApi";
import JobApplicationForm from "./JobApplicationForm";
import ScoutSection from "./ScoutSection";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import {
  JobApplicationStatus,
  jobApplicationStatusLabels,
  jobApplicationStatusOrder,
  type JobApplication,
  type JobApplicationCreateInput,
  type JobApplicationUpdateInput,
} from "../types";
import { useTheme } from "../context/ThemeContext";

const formatAppliedDate = (isoDate: string) =>
  new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(isoDate));

const getApplicationSortTime = (application: JobApplication) =>
  new Date(application.dateApplied).getTime();

const splitTechnicalStack = (value?: string | null) =>
  value
    ?.split(",")
    .map((skill) => skill.trim())
    .filter(Boolean) ?? [];

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

const escapeCsvField = (value?: string | number | null) => {
  const safeValue = value ?? "";
  return `"${String(safeValue).replace(/"/g, '""')}"`;
};

const getUniqueTechnicalSkills = (applications: JobApplication[]) =>
  Array.from(
    new Set(
      applications.flatMap((application) =>
        splitTechnicalStack(application.technicalStack),
      ),
    ),
  ).sort((left, right) => left.localeCompare(right));

const buildTrackerExportJson = (applications: JobApplication[]) =>
  JSON.stringify(
    {
      results: applications.map((application) => ({
        id: application.id,
        company_name: application.companyName,
        position: application.position,
        job_url: application.jobUrl,
        location: application.location,
        salary_range: application.salaryRange,
        job_description: application.jobDescription,
        notes: application.notes,
        interest_level: application.interestLevel,
        technical_stack: application.technicalStack,
        status: jobApplicationStatusLabels[application.status],
        date_applied: application.dateApplied,
        user_id: application.userId,
      })),
    },
    null,
    2,
  );

const buildTrackerExportCsv = (applications: JobApplication[]) => {
  const rows = [
    [
      "id",
      "company_name",
      "position",
      "job_url",
      "location",
      "salary_range",
      "job_description",
      "notes",
      "interest_level",
      "technical_stack",
      "status",
      "date_applied",
      "user_id",
    ].join(","),
    ...applications.map((application) =>
      [
        escapeCsvField(application.id),
        escapeCsvField(application.companyName),
        escapeCsvField(application.position),
        escapeCsvField(application.jobUrl),
        escapeCsvField(application.location),
        escapeCsvField(application.salaryRange),
        escapeCsvField(application.jobDescription),
        escapeCsvField(application.notes),
        escapeCsvField(application.interestLevel),
        escapeCsvField(application.technicalStack),
        escapeCsvField(jobApplicationStatusLabels[application.status]),
        escapeCsvField(application.dateApplied),
        escapeCsvField(application.userId),
      ].join(","),
    ),
  ];

  return rows.join("\n");
};

const matchesFilters = (
  application: JobApplication,
  filters: {
    searchTerm: string;
    statusFilter: JobApplicationStatus | "all";
    interestRange: {
      lower: number;
      upper: number;
    };
    selectedSkills: string[];
  },
) => {
  const normalizedSearchTerm = filters.searchTerm.trim().toLowerCase();
  const normalizedCompany = application.companyName.toLowerCase();
  const normalizedPosition = application.position.toLowerCase();
  const applicationSkills = splitTechnicalStack(application.technicalStack);

  if (
    normalizedSearchTerm &&
    !`${normalizedCompany} ${normalizedPosition}`.includes(normalizedSearchTerm)
  ) {
    return false;
  }

  if (
    filters.statusFilter !== "all" &&
    application.status !== filters.statusFilter
  ) {
    return false;
  }

  const isDefaultInterestRange =
    filters.interestRange.lower === 1 && filters.interestRange.upper === 5;

  if (!isDefaultInterestRange) {
    if (
      application.interestLevel == null ||
      application.interestLevel < filters.interestRange.lower ||
      application.interestLevel > filters.interestRange.upper
    ) {
      return false;
    }
  }

  return filters.selectedSkills.every((skill) =>
    applicationSkills.some(
      (applicationSkill) =>
        applicationSkill.toLowerCase() === skill.toLowerCase(),
    ),
  );
};

const INTEREST_MIN = 1;
const INTEREST_MAX = 5;

const formatInterestRangeLabel = (lower: number, upper: number) =>
  lower === INTEREST_MIN && upper === INTEREST_MAX
    ? "All"
    : `${lower}/5 - ${upper}/5`;

const getLoadApplicationsErrorMessage = (error: unknown) => {
  // Keep server-side failures and connectivity failures distinct so the UI can suggest the right next step.
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return "Could not reach the server. Check your connection and try again.";
    }

    if (error.response.status >= 500) {
      return "Something went wrong. Please try again.";
    }
  }

  return "Could not load job applications.";
};

const boardColumns = [
  {
    status: JobApplicationStatus.Applied,
    title: "Applied",
    subtitle: "Fresh outreach",
    borderClass: "border-l-column-applied",
    accentClass: "text-column-applied",
    frameClass: "deco-frame border-border-gold",
  },
  {
    status: JobApplicationStatus.Interviewing,
    title: "Interviewing",
    subtitle: "Active conversations",
    borderClass: "border-l-column-interviewing",
    accentClass: "text-column-interviewing",
    frameClass: "deco-frame border-border-gold",
  },
  {
    status: JobApplicationStatus.Rejected,
    title: "Rejected",
    subtitle: "Closed loops",
    borderClass: "border-l-column-rejected",
    accentClass: "text-column-rejected",
    frameClass: "deco-frame border-border-gold",
  },
  {
    status: JobApplicationStatus.Offer,
    title: "Offer",
    subtitle: "Decision stage",
    borderClass: "border-l-column-offer",
    accentClass: "text-column-offer",
    frameClass: "deco-frame border-border-gold",
  },
] as const;

const buildColumns = (applications: JobApplication[]) =>
  jobApplicationStatusOrder.reduce<
    Record<JobApplicationStatus, JobApplication[]>
  >(
    (columns, status) => {
      columns[status] = applications.filter(
        (application) => application.status === status,
      );
      return columns;
    },
    {
      [JobApplicationStatus.Applied]: [],
      [JobApplicationStatus.Interviewing]: [],
      [JobApplicationStatus.Rejected]: [],
      [JobApplicationStatus.Offer]: [],
    },
  );

const flattenColumns = (
  columns: Record<JobApplicationStatus, JobApplication[]>,
) => jobApplicationStatusOrder.flatMap((status) => columns[status]);

const sortApplications = (
  applications: JobApplication[],
  sortOrder: "newest" | "oldest",
) =>
  [...applications].sort((left, right) =>
    sortOrder === "newest"
      ? getApplicationSortTime(right) - getApplicationSortTime(left)
      : getApplicationSortTime(left) - getApplicationSortTime(right),
  );

const reorderApplications = (
  applications: JobApplication[],
  sourceStatus: JobApplicationStatus,
  destinationStatus: JobApplicationStatus,
  sourceIndex: number,
  destinationIndex: number,
) => {
  const columns = buildColumns(applications);
  const sourceItems = [...columns[sourceStatus]];
  const [movedApplication] = sourceItems.splice(sourceIndex, 1);

  if (!movedApplication) {
    return null;
  }

  const destinationItems =
    sourceStatus === destinationStatus
      ? sourceItems
      : [...columns[destinationStatus]];
  const nextApplication =
    sourceStatus === destinationStatus
      ? movedApplication
      : { ...movedApplication, status: destinationStatus };

  destinationItems.splice(destinationIndex, 0, nextApplication);

  const nextColumns = {
    ...columns,
    [sourceStatus]: sourceItems,
    [destinationStatus]: destinationItems,
  };

  return {
    movedApplication: nextApplication,
    nextApplications: flattenColumns(nextColumns),
  };
};

const detailRows = (application: JobApplication) =>
  [
    { label: "Company", value: application.companyName },
    { label: "Position", value: application.position },
    { label: "Status", value: jobApplicationStatusLabels[application.status] },
    { label: "Date", value: formatAppliedDate(application.dateApplied) },
    { label: "Location", value: application.location ?? "Not provided" },
    { label: "Salary", value: application.salaryRange ?? "Not provided" },
  ] as const;

const interestLevelOptions = [1, 2, 3, 4, 5] as const;

const mobileAccordionDefaults: Record<JobApplicationStatus, boolean> = {
  [JobApplicationStatus.Applied]: true,
  [JobApplicationStatus.Interviewing]: false,
  [JobApplicationStatus.Rejected]: false,
  [JobApplicationStatus.Offer]: false,
};

const Dashboard = () => {
  const { logout, username } = useAuth();
  const {
    activeSection,
    setActiveSection: setWorkflowSection,
    isMissionLoopOpen,
    openMissionLoop,
    advanceMissionPhase,
  } = useWorkflow();
  const { theme, toggleTheme } = useTheme();
  const themeButtonVariant = theme === "dark" ? "outline" : "default";
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] =
    useState<JobApplication | null>(null);
  const [isDetailEditing, setIsDetailEditing] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [showStatusSankey, setShowStatusSankey] = useState(false);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    JobApplicationStatus | "all"
  >("all");
  const [interestRange, setInterestRange] = useState({
    lower: INTEREST_MIN,
    upper: INTEREST_MAX,
  });
  const [activeInterestHandle, setActiveInterestHandle] = useState<
    "lower" | "upper" | null
  >(null);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [mobileExpandedColumns, setMobileExpandedColumns] = useState<
    Record<JobApplicationStatus, boolean>
  >(mobileAccordionDefaults);
  const interestRangeRef = useRef<HTMLDivElement | null>(null);
  const [scoutSummary, setScoutSummary] = useState({
    total: 0,
    toEvaluate: 0,
    toApply: 0,
    discarded: 0,
  });

  const availableSkills = useMemo(
    () => getUniqueTechnicalSkills(applications),
    [applications],
  );

  const filteredApplications = useMemo(
    () =>
      applications.filter((application) =>
        matchesFilters(application, {
          searchTerm,
          statusFilter,
          interestRange,
          selectedSkills,
        }),
      ),
    [applications, interestRange, searchTerm, selectedSkills, statusFilter],
  );

  const columns = useMemo(
    () => buildColumns(filteredApplications),
    [filteredApplications],
  );

  const selectedSkillSet = new Set(
    selectedSkills.map((skill) => skill.toLowerCase()),
  );
  const visibleAvailableSkills = availableSkills.filter(
    (skill) => !selectedSkillSet.has(skill.toLowerCase()),
  );

  const toggleMobileColumn = (status: JobApplicationStatus) => {
    setMobileExpandedColumns((current) => ({
      ...current,
      [status]: !current[status],
    }));
  };

  const updateInterestLower = (nextLower: number) => {
    setInterestRange((current) => ({
      lower: Math.min(nextLower, current.upper),
      upper: current.upper,
    }));
  };

  const updateInterestUpper = (nextUpper: number) => {
    setInterestRange((current) => ({
      lower: current.lower,
      upper: Math.max(nextUpper, current.lower),
    }));
  };

  const setInterestValueFromClientX = useCallback(
    (clientX: number, handle: "lower" | "upper") => {
      const track = interestRangeRef.current;
      if (!track) {
        return;
      }

      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const nextValue =
        INTEREST_MIN + Math.round(ratio * (INTEREST_MAX - INTEREST_MIN));

      if (handle === "lower") {
        updateInterestLower(nextValue);
        return;
      }

      updateInterestUpper(nextValue);
    },
    [],
  );

  useEffect(() => {
    if (!activeInterestHandle) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      setInterestValueFromClientX(event.clientX, activeInterestHandle);
    };

    const handlePointerUp = () => {
      setActiveInterestHandle(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [activeInterestHandle, setInterestValueFromClientX]);

  const handleTrackerExport = (format: "json" | "csv") => {
    const content =
      format === "csv"
        ? buildTrackerExportCsv(applications)
        : buildTrackerExportJson(applications);
    const blob = new Blob([content], {
      type:
        format === "csv"
          ? "text/csv;charset=utf-8"
          : "application/json;charset=utf-8",
    });

    downloadBlob(blob, format === "csv" ? "applications.csv" : "applications.json");
    toast.success(`Tracker exported as ${format.toUpperCase()}.`);
  };

  const profileStats = useMemo(() => {
    const totalApplications = applications.length;
    const interviewCount = applications.filter(
      (application) => application.status === JobApplicationStatus.Interviewing,
    ).length;
    const offerCount = applications.filter(
      (application) => application.status === JobApplicationStatus.Offer,
    ).length;

    const formatRate = (count: number) =>
      totalApplications === 0
        ? 0
        : Math.round((count / totalApplications) * 100);

    return {
      interviewRate: formatRate(interviewCount),
      offerRate: formatRate(offerCount),
    };
  }, [applications]);

  const renderApplicationCardContent = (application: JobApplication) => (
    <div className="grid min-w-0 gap-1">
      <span className="truncate text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-deco-foreground">
        {application.companyName}
      </span>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <span className="truncate text-left text-[0.72rem] tracking-[0.02em] text-deco-muted">
          {application.position}
        </span>
        <span className="shrink-0 text-right text-[0.68rem] tabular-nums tracking-[0.04em] text-deco-muted">
          {formatAppliedDate(application.dateApplied)}
        </span>
      </div>
    </div>
  );

  useEffect(() => {
    const loadApplications = async () => {
      try {
        setErrorMessage(null);
        const items = await listJobApplications();
        setApplications(items);
      } catch (error) {
        console.error("Load job applications failed:", error);
        setErrorMessage(getLoadApplicationsErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    };

    void loadApplications();
  }, []);

  const switchSection = (section: WorkflowSection) => {
    setWorkflowSection(section);
    setIsCreateDialogOpen(false);
    setSelectedApplication(null);
    setIsDetailEditing(false);
  };

  const openCreateDialog = () => {
    switchSection("tracker");
    setIsCreateDialogOpen(true);
  };

  const closeCreateDialog = () => {
    setIsCreateDialogOpen(false);
  };

  const openDetails = (application: JobApplication) => {
    setSelectedApplication(application);
    setIsDetailEditing(false);
  };

  const closeDetails = () => {
    setSelectedApplication(null);
    setIsDetailEditing(false);
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setInterestRange({ lower: INTEREST_MIN, upper: INTEREST_MAX });
    setSelectedSkills([]);
  };

  const addSkillFilter = (skill: string) => {
    setSelectedSkills((current) => {
      if (
        current.some(
          (existing) => existing.toLowerCase() === skill.toLowerCase(),
        )
      ) {
        return current;
      }

      return [...current, skill];
    });
  };

  const removeSkillFilter = (skill: string) => {
    setSelectedSkills((current) =>
      current.filter(
        (existing) => existing.toLowerCase() !== skill.toLowerCase(),
      ),
    );
  };

  const handleCreate = async (input: JobApplicationCreateInput) => {
    const createdApplication = await createJobApplication(input);
    setApplications((current) => [createdApplication, ...current]);
    toast.success("Application added.");
    return createdApplication;
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteJobApplication(id);
      setApplications((current) =>
        current.filter((application) => application.id !== id),
      );
      setSelectedApplication((current) =>
        current?.id === id ? null : current,
      );
      setIsDetailEditing(false);
      toast.success("Application removed.");
    } catch (error) {
      console.error("Delete job application failed:", error);
      setErrorMessage("Could not delete the application.");
    }
  };

  const handleUpdate = async (id: string, input: JobApplicationUpdateInput) => {
    await updateJobApplication(id, input);

    let updatedApplication: JobApplication | null = null;

    setApplications((current) =>
      current.map((application) => {
        if (application.id !== id) {
          return application;
        }

        updatedApplication = {
          ...application,
          companyName: input.companyName,
          position: input.position,
          jobUrl: input.jobUrl ?? null,
          location: input.location ?? null,
          salaryRange: input.salaryRange ?? null,
          jobDescription: input.jobDescription ?? null,
          notes: input.notes ?? null,
          interestLevel: input.interestLevel ?? null,
          technicalStack: input.technicalStack ?? null,
          status: input.status,
          dateApplied: input.dateApplied,
        };

        return updatedApplication;
      }),
    );

    if (updatedApplication) {
      setSelectedApplication(updatedApplication);
    }

    setIsDetailEditing(false);
    toast.success("Application updated.");
  };

  const handleDragEnd = async (result: DropResult) => {
    const destination = result.destination;

    if (!destination) {
      return;
    }

    const sourceStatus = Number(
      result.source.droppableId,
    ) as JobApplicationStatus;
    const destinationStatus = Number(
      destination.droppableId,
    ) as JobApplicationStatus;

    if (
      sourceStatus === destinationStatus &&
      result.source.index === destination.index
    ) {
      return;
    }

    const reordered = reorderApplications(
      applications,
      sourceStatus,
      destinationStatus,
      result.source.index,
      destination.index,
    );

    if (!reordered) {
      return;
    }

    const previousApplications = applications;
    setApplications(reordered.nextApplications);

    if (selectedApplication?.id === reordered.movedApplication.id) {
      setSelectedApplication(reordered.movedApplication);
    }

    if (sourceStatus === destinationStatus) {
      return;
    }

    try {
      // The board responds immediately on drop, then rolls back if the persisted status update fails.
      await updateJobApplication(reordered.movedApplication.id, {
        companyName: reordered.movedApplication.companyName,
        position: reordered.movedApplication.position,
        jobUrl: reordered.movedApplication.jobUrl ?? undefined,
        location: reordered.movedApplication.location ?? undefined,
        salaryRange: reordered.movedApplication.salaryRange ?? undefined,
        jobDescription: reordered.movedApplication.jobDescription ?? undefined,
        notes: reordered.movedApplication.notes ?? undefined,
        interestLevel: reordered.movedApplication.interestLevel ?? undefined,
        technicalStack: reordered.movedApplication.technicalStack ?? undefined,
        status: reordered.movedApplication.status,
        dateApplied: reordered.movedApplication.dateApplied,
      });

      toast.success(
        `${reordered.movedApplication.companyName} moved to ${jobApplicationStatusLabels[destinationStatus]}.`,
      );
    } catch (error) {
      console.error("Move job application failed:", error);
      setApplications(previousApplications);
      if (selectedApplication?.id === reordered.movedApplication.id) {
        const previousSelected = previousApplications.find(
          (application) => application.id === reordered.movedApplication.id,
        );
        setSelectedApplication(previousSelected ?? null);
      }
      setErrorMessage("Could not update the application status.");
      toast.error("Could not update the application status.");
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100dvh/var(--ui-scale))] w-full max-w-[1600px] flex-col overflow-x-hidden px-3 py-3 lg:px-5">
      <header className="deco-frame-thick mb-4 flex w-full flex-col gap-3 px-4 py-4 shadow-deco-panel bg-deco-surface-soft sm:px-6 md:flex-row md:items-center md:justify-between">
        {" "}
        <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center md:gap-4">
          <div className="min-w-0">
            <h1 className="font-heading text-[1.75rem] tracking-tight text-deco-foreground md:text-[2.2rem]">
              Traxr - Job Application Tracker
            </h1>

            <div className="mt-2 flex items-center">
              <div className="h-[2px] w-24 bg-primary-gold"></div>
              <div className="h-px w-full max-w-[200px] bg-primary-gold opacity-20"></div>
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            aria-label="Open guided mission loop"
            className="h-11 w-11 p-0 transition-all"
            onClick={openMissionLoop}
            variant={themeButtonVariant}
          >
            <CircleHelp className="h-5 w-5" />
          </Button>
          <Button
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
            className="h-11 w-11 p-0 transition-all"
            onClick={toggleTheme}
            variant={themeButtonVariant}
          >
            {theme === "dark" ? (
              <SunMedium className="h-4 w-4 shrink-0" />
            ) : (
              <Moon className="h-4 w-4 shrink-0" />
            )}
          </Button>

          <Button
            aria-label="Log out"
            className="h-11 transition-all"
            variant={themeButtonVariant}
            onClick={logout}
          >
            <div className="flex w-full items-center px-4">
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-center text-[0.65rem] uppercase tracking-[0.25em]">
                Log Out
              </span>
              <div className="w-4" />
            </div>
          </Button>
        </div>
      </header>
      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-stretch md:min-h-0 md:flex-1">
        <aside className="deco-frame flex h-auto min-h-0 w-full flex-col items-stretch overflow-visible border-border-gold bg-deco-surface-soft p-5 shadow-deco-panel md:h-full md:overflow-hidden md:p-6">
          <section className="deco-frame border-border-gold bg-deco-surface p-4 shadow-sm">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary-gold">
              Profile
            </p>
            <div className="mt-2 flex items-center gap-2 text-sm text-deco-foreground">
              <User className="h-4 w-4 text-primary-gold" />
              <span className="truncate font-medium">{username ?? "User"}</span>
            </div>
          </section>

          <section className="deco-frame mt-4 border-border-gold bg-deco-surface p-4 shadow-sm">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary-gold">
              {activeSection === "scout" ? "Scout Summary" : "Summary"}
            </p>
            {activeSection === "scout" ? (
              <div className="mt-2 grid gap-2 text-[0.6rem] uppercase tracking-[0.15em] text-deco-muted">
                <div>
                  <span className="font-heading text-3xl leading-none text-deco-foreground">
                    {scoutSummary.total}
                  </span>
                  <p className="mt-1 text-[0.6rem] uppercase tracking-[0.15em] text-deco-muted">
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
                    {applications.length}
                  </span>
                  <p className="mt-1 text-[0.6rem] uppercase tracking-[0.15em] text-deco-muted">
                    Total Applications
                  </p>
                </div>
                <div className="mt-3 space-y-1 text-[0.6rem] uppercase tracking-[0.15em] text-deco-muted">
                  <p>{profileStats.interviewRate}% interview rate</p>
                  <p>{profileStats.offerRate}% offer rate</p>
                </div>
              </>
            )}
          </section>

          <div className="mt-4 flex w-full flex-col gap-3">
            <div className="grid grid-cols-1 gap-2">
              <Button
                aria-label="Open Tracker"
                className="h-10 px-2 text-[0.58rem] uppercase tracking-[0.16em]"
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
                className="h-10 px-2 text-[0.58rem] uppercase tracking-[0.16em]"
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
                  onClick={openCreateDialog}
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

            <p className="hidden items-center gap-2 px-1 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-deco-muted md:flex">
              <span className="h-1 w-1 rounded-full bg-primary-gold" />
              Drag to update status
            </p>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col gap-3 md:flex-1">
          <div className={activeSection === "tracker" ? "contents" : "hidden"}>
          <section
            className="deco-frame w-full border-border-gold bg-deco-surface-soft p-4 shadow-deco-panel"
            data-tour-id="tracker-filters"
          >
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-stretch gap-2">
                <Button
                  className="h-10 px-4 text-[0.65rem] uppercase tracking-[0.18em]"
                  onClick={() => {
                    const nextSortOrder =
                      sortOrder === "newest" ? "oldest" : "newest";
                    setSortOrder(nextSortOrder);
                    setApplications((current) =>
                      sortApplications(current, nextSortOrder),
                    );
                  }}
                  type="button"
                  variant={themeButtonVariant}
                  >
                    <ArrowUpDown className="mr-2 h-4 w-4" />
                    {sortOrder === "newest" ? "Newest first" : "Oldest first"}
                  </Button>
              </div>

              <div className="flex flex-wrap items-stretch gap-2">
                <Button
                  aria-expanded={isFilterOpen}
                  aria-controls="tracker-filter-accordion"
                  className="h-10 px-4 text-[0.65rem] uppercase tracking-[0.18em]"
                  onClick={() => setIsFilterOpen((current) => !current)}
                  type="button"
                  variant={themeButtonVariant}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Filters
                  <ChevronDown
                    className={`ml-2 h-4 w-4 transition-transform ${
                      isFilterOpen ? "rotate-180" : ""
                    }`}
                  />
                </Button>
                <Button
                  aria-pressed={showStatusSankey}
                  className="h-10 px-4 text-[0.65rem] uppercase tracking-[0.18em]"
                  onClick={() => setShowStatusSankey((current) => !current)}
                  type="button"
                  variant={themeButtonVariant}
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    {showStatusSankey ? "Board" : "Diagram"}
                  </Button>
                <Button
                  className="h-10 px-4 text-[0.65rem] uppercase tracking-[0.18em]"
                  onClick={() => setIsExportDialogOpen(true)}
                  type="button"
                  variant={themeButtonVariant}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>

            {isFilterOpen ? (
              <div
                className="mt-4 grid gap-4 border-t border-border-gold-muted pt-4"
                id="tracker-filter-accordion"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="grid gap-1">
                    <span className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-deco-muted">
                      Filters
                    </span>
                    <span className="text-[0.6rem] uppercase tracking-[0.15em] text-deco-muted">
                      Search, status, interest, and skill transfer
                    </span>
                  </div>
                  <Button
                    className="h-9 px-4 text-[0.6rem] uppercase tracking-[0.18em]"
                    onClick={clearAllFilters}
                    type="button"
                    variant={themeButtonVariant}
                  >
                    Clear All
                  </Button>
                </div>

                <div className="grid gap-3 xl:grid-cols-[minmax(0,2.2fr)_repeat(2,minmax(0,1fr))]">
                  <label className="grid gap-2">
                    <span className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-deco-muted">
                      Search
                    </span>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-deco-muted" />
                      <Input
                        aria-label="Search applications"
                        className="h-10 border-border-gold-muted bg-deco-surface pl-9"
                        placeholder="Company or position"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                      />
                    </div>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-deco-muted">
                      Status
                    </span>
                    <select
                      aria-label="Filter status"
                      className="deco-frame h-10 border-border-gold-muted bg-deco-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary-gold focus:ring-2 focus:ring-primary-gold-muted"
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(
                          event.target.value === "all"
                            ? "all"
                            : (Number(
                                event.target.value,
                              ) as JobApplicationStatus),
                        )
                      }
                    >
                      <option value="all">All statuses</option>
                      {jobApplicationStatusOrder.map((status) => (
                        <option key={status} value={status}>
                          {jobApplicationStatusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="flex items-center justify-between gap-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-deco-muted">
                      <span>Interest</span>
                      <span className="text-[0.58rem] tracking-[0.14em] text-primary-gold">
                        {formatInterestRangeLabel(
                          interestRange.lower,
                          interestRange.upper,
                        )}
                      </span>
                    </span>
                    <div className="deco-frame h-10 border-border-gold-muted bg-deco-surface px-3 py-2">
                      <div
                        ref={interestRangeRef}
                        className="relative h-6 select-none"
                        onPointerDown={(event) => {
                          const rect =
                            interestRangeRef.current?.getBoundingClientRect();
                          if (!rect) {
                            return;
                          }

                          const ratio = Math.min(
                            1,
                            Math.max(0, (event.clientX - rect.left) / rect.width),
                          );
                          const nextValue =
                            INTEREST_MIN +
                            Math.round(ratio * (INTEREST_MAX - INTEREST_MIN));
                          const lowerDistance = Math.abs(
                            nextValue - interestRange.lower,
                          );
                          const upperDistance = Math.abs(
                            nextValue - interestRange.upper,
                          );
                          const nextHandle =
                            lowerDistance <= upperDistance ? "lower" : "upper";

                          setActiveInterestHandle(nextHandle);
                          setInterestValueFromClientX(event.clientX, nextHandle);
                        }}
                      >
                        <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-deco-card" />
                        <div
                          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-primary-gold"
                          style={{
                            left: `${((interestRange.lower - INTEREST_MIN) /
                              (INTEREST_MAX - INTEREST_MIN)) *
                              100}%`,
                            right: `${((INTEREST_MAX - interestRange.upper) /
                              (INTEREST_MAX - INTEREST_MIN)) *
                              100}%`,
                          }}
                        />
                        <button
                          aria-label="Interest lower limit"
                          className={`absolute top-1/2 z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-deco-bg bg-primary-gold shadow-sm transition-transform ${
                            activeInterestHandle === "lower" ? "scale-110" : ""
                          }`}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            setActiveInterestHandle("lower");
                          }}
                          style={{
                            left: `${
                              ((interestRange.lower - INTEREST_MIN) /
                                (INTEREST_MAX - INTEREST_MIN)) *
                              100
                            }%`,
                          }}
                          type="button"
                        />
                        <button
                          aria-label="Interest upper limit"
                          className={`absolute top-1/2 z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-deco-bg bg-primary-gold shadow-sm transition-transform ${
                            activeInterestHandle === "upper" ? "scale-110" : ""
                          }`}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            setActiveInterestHandle("upper");
                          }}
                          style={{
                            left: `${
                              ((interestRange.upper - INTEREST_MIN) /
                                (INTEREST_MAX - INTEREST_MIN)) *
                              100
                            }%`,
                          }}
                          type="button"
                        />
                      </div>
                    </div>
                  </label>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="deco-frame border-border-gold-muted bg-deco-surface-soft p-3">
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-primary-gold">
                      Selected
                    </p>
                    {selectedSkills.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedSkills.map((skill) => (
                          <button
                            className="deco-frame inline-flex items-center gap-2 border-border-gold-muted bg-deco-card px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-deco-foreground"
                            aria-label={`Remove ${skill}`}
                            key={skill}
                            onClick={() => removeSkillFilter(skill)}
                            type="button"
                          >
                            {skill}
                            <X className="h-3 w-3 text-deco-muted" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-deco-muted">
                        No active skills.
                      </p>
                    )}
                  </div>

                  <div className="deco-frame border-border-gold-muted bg-deco-surface-soft p-3">
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-primary-gold">
                      Available
                    </p>
                    {visibleAvailableSkills.length > 0 ? (
                      <div className="mt-2 flex max-h-28 flex-wrap gap-2 overflow-y-auto">
                        {visibleAvailableSkills.map((skill) => (
                          <button
                            className="deco-frame inline-flex items-center border-border-gold-muted bg-deco-card px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-deco-foreground transition-colors hover:bg-primary-gold-muted"
                            aria-label={`Add ${skill}`}
                            key={skill}
                            onClick={() => addSkillFilter(skill)}
                            type="button"
                          >
                            {skill}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-deco-muted">
                        No more skills available.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          {errorMessage ? (
            <p className="deco-frame border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
              {errorMessage}
            </p>
          ) : null}

          {isLoading ? (
            <p className="deco-frame border-border-gold-muted bg-deco-surface-soft px-4 py-3 text-sm text-deco-muted">
              Loading applications...
            </p>
          ) : null}

          {!isLoading && applications.length === 0 ? (
            <div className="deco-frame border-border-gold-muted bg-deco-surface-soft px-5 py-10 text-center shadow-deco-panel">
              <p className="font-heading text-2xl text-deco-foreground">
                No applications yet.
              </p>
              <p className="mt-3 text-sm text-deco-muted">
                No applications yet. Add your first one and it will appear here
                immediately.
              </p>
              <Button className="mt-6" onClick={openCreateDialog}>
                <BadgePlus className="h-4 w-4" />
                Add Application
              </Button>
            </div>
          ) : null}

          {!isLoading &&
          applications.length > 0 &&
          filteredApplications.length === 0 ? (
            <div className="deco-frame border-border-gold-muted bg-deco-surface-soft px-5 py-10 text-center shadow-deco-panel">
              <p className="font-heading text-2xl text-deco-foreground">
                No applications match the current filters.
              </p>
              <p className="mt-3 text-sm text-deco-muted">
                Adjust the search, status, interest, or selected skills to show
                results again.
              </p>
              <Button className="mt-6" onClick={clearAllFilters} type="button">
                Clear Filters
              </Button>
            </div>
          ) : null}

          {!isLoading && filteredApplications.length > 0 ? (
            showStatusSankey ? (
              <div data-tour-id="tracker-diagram">
                <TrackerStatusSankey applications={filteredApplications} />
              </div>
            ) : (
              <>
                <div className="w-full space-y-4 md:hidden">
                  {boardColumns.map((column) => {
                    const isExpanded = mobileExpandedColumns[column.status];

                    return (
                      <section
                        className={`kanban-column w-full ${column.frameClass} bg-deco-surface-soft p-4`}
                        id={`column-${column.title.toLowerCase()}`}
                        key={column.status}
                      >
                        <button
                          aria-expanded={isExpanded}
                          className="flex w-full items-start justify-between gap-3 text-left"
                          onClick={() => toggleMobileColumn(column.status)}
                          type="button"
                        >
                          <div>
                            <h3 className="text-2xl text-deco-foreground">
                              {column.title}
                            </h3>
                            <p className="mt-1 text-sm text-deco-muted">
                              {column.subtitle}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={column.accentClass}>
                              {columns[column.status].length}
                            </span>
                            <ChevronDown
                              className={`h-4 w-4 text-deco-muted transition-transform ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </div>
                        </button>

                        {isExpanded ? (
                          <div className="mt-4 flex flex-col gap-2">
                            {columns[column.status].map((application) => (
                              <article
                                className={`application-card ${column.borderClass} deco-frame cursor-default select-none border-border-gold-muted bg-deco-card px-3 py-2 font-sans text-deco-foreground shadow-sm transition-shadow hover:shadow-deco-glow`}
                                key={application.id}
                                onClick={() => openDetails(application)}
                              >
                                {renderApplicationCardContent(application)}
                              </article>
                            ))}
                          </div>
                        ) : null}
                      </section>
                    );
                  })}
                </div>

                <div className="hidden md:block" data-tour-id="tracker-board">
                  <DragDropContext
                    onDragEnd={(result) => void handleDragEnd(result)}
                  >
                    <div className="grid min-h-0 flex-1 gap-5 md:grid-cols-4">
                      {boardColumns.map((column) => (
                        <section
                          className={`kanban-column w-full ${column.frameClass} bg-deco-surface-soft p-4`}
                          id={`column-${column.title.toLowerCase()}`}
                          key={column.status}
                        >
                          <div className="border-b border-primary-gold pb-3">
                            <div className="flex items-end justify-between gap-3">
                              <div>
                                <h3 className="text-2xl text-deco-foreground">
                                  {column.title}
                                </h3>
                                <p className="mt-1 text-sm text-deco-muted">
                                  {column.subtitle}
                                </p>
                              </div>
                              <span className={column.accentClass}>
                                {columns[column.status].length}
                              </span>
                            </div>
                          </div>

                          <Droppable droppableId={String(column.status)}>
                            {(droppableProvided, droppableSnapshot) => (
                              <div
                                className={`mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-2 transition-colors ${
                                  droppableSnapshot.isDraggingOver
                                    ? "bg-primary-gold-muted"
                                    : ""
                                }`}
                                ref={droppableProvided.innerRef}
                                {...droppableProvided.droppableProps}
                              >
                                {columns[column.status].map(
                                  (application, index) => (
                                    <Draggable
                                      draggableId={application.id}
                                      index={index}
                                      key={application.id}
                                    >
                                      {(draggableProvided, draggableSnapshot) => {
                                        const { style, ...draggableProps } =
                                          draggableProvided.draggableProps;
                                        const draggableCard = (
                                          <article
                                            className={`application-card ${column.borderClass} deco-frame cursor-grab select-none border-border-gold-muted bg-deco-card px-3 py-2 font-sans text-deco-foreground shadow-sm transition-shadow hover:shadow-deco-glow active:cursor-grabbing ${
                                              draggableSnapshot.isDragging
                                                ? "shadow-deco-glow"
                                                : ""
                                            }`}
                                            key={application.id}
                                            ref={draggableProvided.innerRef}
                                            {...draggableProps}
                                            {...draggableProvided.dragHandleProps}
                                            style={style}
                                            onClick={() => openDetails(application)}
                                          >
                                            {renderApplicationCardContent(
                                              application,
                                            )}
                                          </article>
                                        );

                                        if (
                                          draggableSnapshot.isDragging &&
                                          typeof document !== "undefined"
                                        ) {
                                          return createPortal(
                                            draggableCard,
                                            document.body,
                                          );
                                        }

                                        return draggableCard;
                                      }}
                                    </Draggable>
                                  ),
                                )}
                                {droppableProvided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </section>
                      ))}
                    </div>
                  </DragDropContext>
                </div>
              </>
            )
          ) : null}

          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={(open) => {
              setIsCreateDialogOpen(open);
            }}
          >
            <DialogContent className="max-h-[92vh] w-[min(96vw,65rem)] overflow-y-auto lg:overflow-hidden p-0">
              <DialogHeader>
                <DialogTitle>Add Application</DialogTitle>
                <DialogDescription>
                  Capture the company, role, and current status in the board.
                </DialogDescription>
              </DialogHeader>
              <JobApplicationForm
                editingApplication={null}
                onCancelEdit={closeCreateDialog}
                onCreate={handleCreate}
                onSuccess={closeCreateDialog}
                onUpdate={handleUpdate}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
            <DialogContent className="deco-frame-thick w-[min(96vw,30rem)] border-border-gold bg-deco-bg shadow-deco-panel">
              <DialogHeader>
                <DialogTitle className="font-heading text-2xl text-deco-foreground">
                  Export tracker data
                </DialogTitle>
                <DialogDescription className="text-sm text-deco-muted">
                  Choose JSON for backup or CSV for Excel.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 pt-2 sm:grid-cols-2">
                <Button
                  className="justify-start"
                  onClick={() => {
                    setIsExportDialogOpen(false);
                    handleTrackerExport("json");
                  }}
                  type="button"
                  variant="outline"
                >
                  <Download className="h-4 w-4" />
                  JSON
                </Button>
                <Button
                  className="justify-start"
                  onClick={() => {
                    setIsExportDialogOpen(false);
                    handleTrackerExport("csv");
                  }}
                  type="button"
                  variant="outline"
                >
                  <FileDigit className="h-4 w-4" />
                  CSV
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Sheet
            open={selectedApplication !== null}
            onOpenChange={(open) => {
              if (!open) {
                closeDetails();
              }
            }}
          >
            <SheetContent className="deco-frame flex flex-col border-border-gold bg-deco-bg">
              <SheetHeader>
                <SheetTitle>
                  {selectedApplication
                    ? `${selectedApplication.companyName} Details`
                    : "Job Details"}
                </SheetTitle>
                <SheetDescription>
                  {selectedApplication?.position ?? "Application details"}
                </SheetDescription>
              </SheetHeader>
              <div
                className={`min-h-0 flex-1 px-3 py-2.5 ${
                  isDetailEditing
                    ? "overflow-y-auto lg:overflow-hidden"
                    : "overflow-y-auto"
                }`}
              >
                {selectedApplication ? (
                  <div className="flex min-h-full flex-col pb-2">
                    {isDetailEditing ? (
                      <JobApplicationForm
                        editingApplication={selectedApplication}
                        onCancelEdit={() => setIsDetailEditing(false)}
                        onCreate={handleCreate}
                        onSuccess={() => setIsDetailEditing(false)}
                        onUpdate={handleUpdate}
                        submitLabel="Save Changes"
                        submittingLabel="Saving Changes..."
                        cancelLabel="Discard"
                      />
                    ) : (
                      <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                        <section className="deco-frame flex h-full min-h-0 flex-col border-border-gold-muted bg-deco-surface px-2.5 py-2.5 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-primary-gold">
                                Application Record
                              </p>
                              <h3 className="mt-1 truncate text-lg text-deco-foreground">
                                {selectedApplication.companyName}
                              </h3>
                              <p className="mt-1 truncate text-[0.65rem] uppercase tracking-[0.12em] text-deco-muted">
                                {selectedApplication.position}
                              </p>
                            </div>
                            <Badge className="shrink-0">
                              {
                                jobApplicationStatusLabels[
                                  selectedApplication.status
                                ]
                              }
                            </Badge>
                          </div>

                          <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                            {detailRows(selectedApplication).map((row) => (
                              <div
                                key={row.label}
                                className="deco-frame min-w-0 border-border-gold-muted bg-deco-surface-soft px-2 py-1.5"
                              >
                                <p className="text-[0.45rem] font-semibold uppercase tracking-[0.1em] text-primary-gold">
                                  {row.label}
                                </p>
                                <p className="mt-0.5 truncate text-[0.68rem] leading-4 text-deco-foreground">
                                  {row.value}
                                </p>
                              </div>
                            ))}
                            <div className="deco-frame min-w-0 border-border-gold-muted bg-deco-surface-soft px-2 py-1.5 sm:col-span-2">
                              <p className="text-[0.45rem] font-semibold uppercase tracking-[0.1em] text-primary-gold">
                                Technical Stack
                              </p>
                              {splitTechnicalStack(
                                selectedApplication.technicalStack,
                              ).length > 0 ? (
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {splitTechnicalStack(
                                    selectedApplication.technicalStack,
                                  ).map((skill) => (
                                    <span
                                      className="deco-frame max-w-full break-words border-border-gold-muted bg-deco-card px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.08em] text-deco-foreground"
                                      key={skill}
                                    >
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-1 text-[0.68rem] leading-4 text-deco-foreground">
                                  Not provided
                                </p>
                              )}
                            </div>
                            <div className="deco-frame border-border-gold-muted bg-deco-surface-soft px-2 py-1.5">
                              <p className="text-[0.45rem] font-semibold uppercase tracking-[0.1em] text-primary-gold">
                                Interest Level
                              </p>
                              <div className="mt-0.5 flex items-center gap-0.5 text-primary-gold">
                                {interestLevelOptions.map((level) => (
                                  <Diamond
                                    className={`h-3 w-3 ${
                                      selectedApplication.interestLevel &&
                                      level <= selectedApplication.interestLevel
                                        ? "fill-current"
                                        : "opacity-30"
                                    }`}
                                    key={level}
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="deco-frame min-w-0 border-border-gold-muted bg-deco-surface-soft px-2 py-1.5">
                              <p className="text-[0.45rem] font-semibold uppercase tracking-[0.1em] text-primary-gold">
                                Job URL
                              </p>
                              {selectedApplication.jobUrl ? (
                                <a
                                  className="inline-flex items-center gap-1.5 text-[0.68rem] text-deco-foreground underline decoration-primary-gold underline-offset-4 transition-colors hover:text-primary-gold"
                                  href={selectedApplication.jobUrl}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  <span className="truncate">Open posting</span>
                                </a>
                              ) : (
                                <p className="mt-1 text-[0.68rem] leading-4 text-deco-foreground">
                                  Not provided
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="mt-auto grid gap-1.5 border-t border-primary-gold-muted pt-2">
                            <Button
                              className="w-full justify-center"
                              size="sm"
                              onClick={() => setIsDetailEditing(true)}
                            >
                              Edit Application
                            </Button>
                            <Button
                              className="w-full justify-center text-danger hover:text-danger"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                void handleDelete(selectedApplication.id)
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete Application
                            </Button>
                          </div>
                        </section>

                        <section className="deco-frame flex h-full min-h-0 flex-col border-border-gold-muted bg-deco-surface-soft p-3 shadow-sm">
                          <div className="flex items-center gap-2 border-b border-primary-gold-muted pb-2">
                            <FileText className="h-3.5 w-3.5 text-primary-gold" />
                            <h4 className="text-[0.9rem] text-deco-foreground">
                              Job Description
                            </h4>
                          </div>
                          <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
                            <pre className="whitespace-pre-wrap break-words font-mono text-[0.68rem] leading-5 text-deco-foreground">
                              {selectedApplication.jobDescription?.trim()
                                ? selectedApplication.jobDescription
                                : "No job description saved."}
                            </pre>
                          </div>
                          <div className="mt-3 border-t border-primary-gold-muted pt-3">
                            <h4 className="text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-primary-gold">
                              Notes
                            </h4>
                            <div className="deco-frame mt-2 min-h-[7rem] border-border-gold-muted bg-deco-surface-soft p-3">
                              <pre className="whitespace-pre-wrap break-words font-mono text-[0.68rem] leading-5 text-deco-foreground">
                                {selectedApplication.notes?.trim()
                                  ? selectedApplication.notes
                                  : "No notes saved."}
                              </pre>
                            </div>
                          </div>
                        </section>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
              </SheetContent>
            </Sheet>
          </div>
          <div className={activeSection === "scout" ? "contents" : "hidden"}>
          <ScoutSection
            isActive={activeSection === "scout"}
            onSummaryChange={setScoutSummary}
            onApplicationCreated={(application) =>
              setApplications((current) => [application, ...current])
            }
          />
        </div>
        </section>
      </div>
      <div className="mt-auto pt-3">
        <Footer />
      </div>
      <MissionLoop
        open={isMissionLoopOpen}
        onGoScout={() => {
          switchSection("scout");
        }}
        onGoTracker={() => {
          switchSection("tracker");
          setShowStatusSankey(false);
        }}
        onGoDiagram={() => {
          switchSection("tracker");
          setShowStatusSankey(true);
        }}
        onAdvancePhase={() => {
          advanceMissionPhase();
          switchSection("tracker");
          setShowStatusSankey(false);
        }}
      />
    </main>
  );
};

export default Dashboard;
