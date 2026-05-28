import {
  BadgePlus,
  CircleHelp,
  Diamond,
  Download,
  ExternalLink,
  FileDigit,
  FileText,
  LogOut,
  Moon,
  SunMedium,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useAsync } from "../hooks/useAsync";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { useWorkflow, type WorkflowSection } from "../context/WorkflowContext";
import { FilterBar } from "./FilterBar";
import type { DropResult } from "@hello-pangea/dnd";
import { KanbanBoard } from "./KanbanBoard";
import { DashboardSidebar } from "./DashboardSidebar";
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
import { downloadBlob, escapeCsvField, formatDateDe, splitTechStack } from "../lib/utils";

const getApplicationSortTime = (application: JobApplication) =>
  new Date(application.dateApplied).getTime();

const getUniqueTechnicalSkills = (applications: JobApplication[]) =>
  Array.from(
    new Set(
      applications.flatMap((application) =>
        splitTechStack(application.technicalStack),
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
  const applicationSkills = splitTechStack(application.technicalStack);

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
    { label: "Date", value: formatDateDe(application.dateApplied) },
    { label: "Location", value: application.location ?? "Not provided" },
    { label: "Salary", value: application.salaryRange ?? "Not provided" },
  ] as const;

const interestLevelOptions = [1, 2, 3, 4, 5] as const;

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
  const { isLoading, error: errorMessage } = useAsync(
    () => listJobApplications().then((items) => { setApplications(items); return items; }),
    [],
    {
      mapError: (err) => {
        if (
          err &&
          typeof err === "object" &&
          "isAxiosError" in err &&
          (err as { isAxiosError: boolean }).isAxiosError
        ) {
          const axiosErr = err as { response?: { status: number } };
          if (!axiosErr.response) {
            return "Could not reach the server. Check your connection and try again.";
          }
          if (axiosErr.response.status >= 500) {
            return "Something went wrong. Please try again.";
          }
        }
        return "Could not load job applications.";
      },
    },
  );
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
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
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
      toast.error("Could not delete the application.");
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
      toast.error("Could not update the application status.");
      toast.error("Could not update the application status.");
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100dvh/var(--ui-scale))] w-full max-w-[1600px] flex-col overflow-x-hidden px-3 py-3 lg:px-5">
      <header className="deco-frame-thick mb-4 flex w-full flex-col gap-3 px-4 py-4 shadow-deco-panel bg-deco-surface-soft sm:px-6 md:flex-row md:items-center md:justify-between">
        {" "}
        <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center md:gap-4">
          <div className="min-w-0">
            <h1 className="font-heading text-3xl tracking-tight text-deco-foreground md:text-4xl">
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
              <span className="flex-1 text-center text-xs uppercase tracking-[0.2em]">
                Log Out
              </span>
              <div className="w-4" />
            </div>
          </Button>
        </div>
      </header>
      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-stretch md:min-h-0 md:flex-1">
        <DashboardSidebar
          username={username}
          applicationCount={applications.length}
          interviewRate={profileStats.interviewRate}
          offerRate={profileStats.offerRate}
          scoutSummary={scoutSummary}
          themeButtonVariant={themeButtonVariant}
          onOpenCreate={openCreateDialog}
        />

        <section className="flex min-h-0 flex-col gap-3 md:flex-1">
          <div className={activeSection === "tracker" ? "contents" : "hidden"}>
          <FilterBar
            sortOrder={sortOrder}
            onSortToggle={() => {
              const nextSortOrder =
                sortOrder === "newest" ? "oldest" : "newest";
              setSortOrder(nextSortOrder);
              setApplications((current) =>
                sortApplications(current, nextSortOrder),
              );
            }}
            isFilterOpen={isFilterOpen}
            onToggleFilter={() => setIsFilterOpen((current) => !current)}
            showStatusSankey={showStatusSankey}
            onToggleDiagram={() => setShowStatusSankey((current) => !current)}
            onOpenExport={() => setIsExportDialogOpen(true)}
            themeButtonVariant={themeButtonVariant}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            interestRange={interestRange}
            onInterestLowerChange={(value) =>
              setInterestRange((current) => ({
                lower: value,
                upper: current.upper,
              }))
            }
            onInterestUpperChange={(value) =>
              setInterestRange((current) => ({
                lower: current.lower,
                upper: value,
              }))
            }
            selectedSkills={selectedSkills}
            availableSkills={visibleAvailableSkills}
            onAddSkill={addSkillFilter}
            onRemoveSkill={removeSkillFilter}
            onClearAll={clearAllFilters}
          />

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
              <KanbanBoard
                columns={columns}
                onCardClick={openDetails}
                onDragEnd={(result) => void handleDragEnd(result)}
              />
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
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-gold">
                                Application Record
                              </p>
                              <h3 className="mt-1 truncate text-lg text-deco-foreground">
                                {selectedApplication.companyName}
                              </h3>
                              <p className="mt-1 truncate text-xs uppercase tracking-[0.12em] text-deco-muted">
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
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-gold">
                                  {row.label}
                                </p>
                                <p className="mt-0.5 truncate text-xs leading-4 text-deco-foreground">
                                  {row.value}
                                </p>
                              </div>
                            ))}
                            <div className="deco-frame min-w-0 border-border-gold-muted bg-deco-surface-soft px-2 py-1.5 sm:col-span-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-gold">
                                Technical Stack
                              </p>
                              {splitTechStack(
                                selectedApplication.technicalStack,
                              ).length > 0 ? (
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {splitTechStack(
                                    selectedApplication.technicalStack,
                                  ).map((skill) => (
                                    <span
                                      className="deco-frame max-w-full break-words border-border-gold-muted bg-deco-card px-1.5 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-deco-foreground"
                                      key={skill}
                                    >
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-1 text-xs leading-4 text-deco-foreground">
                                  Not provided
                                </p>
                              )}
                            </div>
                            <div className="deco-frame border-border-gold-muted bg-deco-surface-soft px-2 py-1.5">
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-gold">
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
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-gold">
                                Job URL
                              </p>
                              {selectedApplication.jobUrl ? (
                                <a
                                  className="inline-flex items-center gap-1.5 text-xs text-deco-foreground underline decoration-primary-gold underline-offset-4 transition-colors hover:text-primary-gold"
                                  href={selectedApplication.jobUrl}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  <span className="truncate">Open posting</span>
                                </a>
                              ) : (
                                <p className="mt-1 text-xs leading-4 text-deco-foreground">
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
                            <h4 className="text-sm text-deco-foreground">
                              Job Description
                            </h4>
                          </div>
                          <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
                            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-deco-foreground">
                              {selectedApplication.jobDescription?.trim()
                                ? selectedApplication.jobDescription
                                : "No job description saved."}
                            </pre>
                          </div>
                          <div className="mt-3 border-t border-primary-gold-muted pt-3">
                            <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-gold">
                              Notes
                            </h4>
                            <div className="deco-frame mt-2 min-h-[7rem] border-border-gold-muted bg-deco-surface-soft p-3">
                              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-deco-foreground">
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
