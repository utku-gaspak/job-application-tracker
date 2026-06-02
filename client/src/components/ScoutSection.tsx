import { useCallback, useEffect, useMemo, useState } from "react";
import { useAsync } from "../hooks/useAsync";
import { Download, FileDigit, Plus, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import {
  deleteAllScoutJobs,
  deleteScoutJob,
  listScoutJobs,
  updateScoutJobState,
  uploadScoutJobs,
} from "../api/scoutJobsApi";
import { createJobApplication } from "../api/jobApplicationsApi";
import { useWorkflow } from "../context/WorkflowContext";
import { downloadBlob, escapeCsvField } from "../lib/utils";
import {
  JobApplicationStatus,
  type JobApplication,
  type ScoutJob,
  type ScoutUploadResult,
} from "../types";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { ScoutUploadPanel } from "./ScoutUploadPanel";
import { ScoutEvaluatePanel } from "./ScoutEvaluatePanel";
import { ScoutToApplyPanel } from "./ScoutToApplyPanel";
import { ScoutManualDialog } from "./ScoutManualDialog";

interface ScoutSectionProps {
  onApplicationCreated: (application: JobApplication) => void;
  onSummaryChange: (summary: {
    total: number;
    toEvaluate: number;
    toApply: number;
    discarded: number;
  }) => void;
  isActive: boolean;
}

const SCOUT_AUTH_TOKEN_KEY = "token";

const readScoutAuthSignature = () =>
  typeof window === "undefined"
    ? ""
    : window.localStorage.getItem(SCOUT_AUTH_TOKEN_KEY) ?? "";

const buildScoutNotes = (job: ScoutJob) =>
  [
    job.requirementsSummary?.trim()
      ? `Requirements summary:\n${job.requirementsSummary.trim()}`
      : null,
    job.applyUrl?.trim() ? `Apply URL: ${job.applyUrl.trim()}` : null,
    job.jobUrl?.trim() ? `Scout job URL: ${job.jobUrl.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

const buildExportJson = (jobs: ScoutJob[]) =>
  JSON.stringify(
    {
      results: jobs.map((job) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        location_display: job.location,
        workplace_type: job.workplaceType,
        commitment: job.commitment,
        posted_at: job.postedAt ? job.postedAt.slice(0, 10) : null,
        job_url: job.jobUrl,
        apply_url: job.applyUrl,
        technical_tools: job.technicalTools,
        requirements_summary: job.requirementsSummary,
        saved_for_apply: job.savedForApply,
        is_discarded: job.isDiscarded,
        created_at: job.createdAt,
      })),
    },
    null,
    2,
  );

const buildExportCsv = (jobs: ScoutJob[]) => {
  const rows = [
    [
      "id",
      "title",
      "company",
      "location_display",
      "workplace_type",
      "commitment",
      "posted_at",
      "job_url",
      "apply_url",
      "technical_tools",
      "requirements_summary",
      "saved_for_apply",
      "is_discarded",
      "created_at",
    ].join(","),
    ...jobs.map((job) =>
      [
        escapeCsvField(job.id),
        escapeCsvField(job.title),
        escapeCsvField(job.company),
        escapeCsvField(job.location),
        escapeCsvField(job.workplaceType),
        escapeCsvField(job.commitment),
        escapeCsvField(job.postedAt ? job.postedAt.slice(0, 10) : null),
        escapeCsvField(job.jobUrl),
        escapeCsvField(job.applyUrl),
        escapeCsvField(job.technicalTools),
        escapeCsvField(job.requirementsSummary),
        escapeCsvField(String(job.savedForApply)),
        escapeCsvField(String(job.isDiscarded)),
        escapeCsvField(job.createdAt),
      ].join(","),
    ),
  ];

  return rows.join("\n");
};

const ScoutSection = ({
  onApplicationCreated,
  onSummaryChange,
  isActive,
}: ScoutSectionProps) => {
  const [activeView, setActiveView] = useState<
    "upload" | "evaluate" | "to-apply"
  >("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<ScoutUploadResult | null>(null);
  const [jobs, setJobs] = useState<ScoutJob[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [authSignature, setAuthSignature] = useState(() => readScoutAuthSignature());
  const [isUploading, setIsUploading] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { isLoading, reload: reloadJobs } = useAsync(
    () => listScoutJobs().then((items) => { setJobs(items); setCurrentIndex(0); return items; }),
    [authSignature],
  );

  const {
    isMissionLoopOpen,
    missionPhase,
    scoutTourView,
    setMissionPhase,
  } = useWorkflow();

  useEffect(() => {
    if (scoutTourView) {
      setActiveView(scoutTourView);
    }
  }, [scoutTourView]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setAuthSignature((current) => {
        const next = readScoutAuthSignature();
        return current === next ? current : next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const evaluateJobs = useMemo(
    () => jobs.filter((job) => !job.savedForApply && !job.isDiscarded),
    [jobs],
  );
  const toApplyJobs = useMemo(
    () => jobs.filter((job) => job.savedForApply && !job.isDiscarded),
    [jobs],
  );
  const currentJob = evaluateJobs[currentIndex] ?? null;

  useEffect(() => {
    onSummaryChange({
      total: jobs.length,
      toEvaluate: evaluateJobs.length,
      toApply: toApplyJobs.length,
      discarded: jobs.filter((job) => job.isDiscarded).length,
    });
  }, [evaluateJobs.length, jobs, onSummaryChange, toApplyJobs.length]);

  const loadJobs = useCallback(() => {
    setErrorMessage(null);
    reloadJobs();
  }, [reloadJobs]);

  useEffect(() => {
    setSelectedFile(null);
    setUploadResult(null);
  }, [authSignature]);

  const handleExport = useCallback(async (format: "json" | "csv") => {
    try {
      const content =
        format === "csv" ? buildExportCsv(jobs) : buildExportJson(jobs);
      const blob = new Blob([content], {
        type: format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8",
      });
      downloadBlob(blob, format === "csv" ? "jobs.csv" : "jobs.json");
      toast.success(`Scout jobs exported as ${format.toUpperCase()}.`);
    } catch (error) {
      console.error("Export scout jobs failed:", error);
      setErrorMessage("Could not export scout jobs.");
    }
  }, [jobs]);

  useEffect(() => {
    if (evaluateJobs.length === 0) {
      if (currentIndex !== 0) {
        setCurrentIndex(0);
      }
      return;
    }

    if (currentIndex >= evaluateJobs.length) {
      setCurrentIndex(evaluateJobs.length - 1);
    }
  }, [currentIndex, evaluateJobs.length]);

  const removeJobFromQueue = (id: string) => {
    setJobs((current) => current.filter((job) => job.id !== id));
    setCurrentIndex((index) =>
      index > 0 && index >= jobs.length - 1 ? index - 1 : index,
    );
  };

  const updateJobInQueue = (updatedJob: ScoutJob) => {
    setJobs((current) =>
      current.map((job) => (job.id === updatedJob.id ? updatedJob : job)),
    );
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMessage("Choose a jobs.json file first.");
      return;
    }

    try {
      setIsUploading(true);
      setErrorMessage(null);
      const result = await uploadScoutJobs(selectedFile);
      setUploadResult(result);
      toast.success(`Scout upload complete: ${result.imported} imported.`);
      await loadJobs();
      setActiveView("evaluate");
    } catch (error) {
      console.error("Upload scout jobs failed:", error);
      setErrorMessage("Could not upload the scout file.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveForLater = useCallback(async () => {
    if (!currentJob || isActing) {
      return;
    }

    try {
      setIsActing(true);
      setErrorMessage(null);
      const updatedJob = await updateScoutJobState(currentJob.id, {
        savedForApply: true,
        isDiscarded: false,
      });
      updateJobInQueue(updatedJob);
      if (isMissionLoopOpen && missionPhase === "triage") {
        setMissionPhase("action");
      }
      toast.success("Scout job moved to To Apply.");
    } catch (error) {
      console.error("Save scout job for later failed:", error);
      setErrorMessage("Could not save the scout job for later.");
    } finally {
      setIsActing(false);
    }
  }, [currentJob, isActing, isMissionLoopOpen, missionPhase, setMissionPhase]);

  const handleDiscard = useCallback(async () => {
    if (!currentJob || isActing) {
      return;
    }

    try {
      setIsActing(true);
      setErrorMessage(null);
      const updatedJob = await updateScoutJobState(currentJob.id, {
        savedForApply: false,
        isDiscarded: true,
      });
      updateJobInQueue(updatedJob);
      if (isMissionLoopOpen && missionPhase === "triage") {
        setMissionPhase("action");
      }
      toast.success("Scout job discarded.");
    } catch (error) {
      console.error("Discard scout job failed:", error);
      setErrorMessage("Could not discard the scout job.");
    } finally {
      setIsActing(false);
    }
  }, [currentJob, isActing, isMissionLoopOpen, missionPhase, setMissionPhase]);

  const handleMarkAsApplied = useCallback(
    async (job: ScoutJob) => {
      if (isActing) {
        return;
      }

      try {
        setIsActing(true);
        setErrorMessage(null);
        const notes = buildScoutNotes(job);
        const createdApplication = await createJobApplication({
          companyName: job.company,
          position: job.title,
          jobUrl: job.applyUrl ?? undefined,
          location: job.location ?? undefined,
          notes: notes || undefined,
          technicalStack: job.technicalTools ?? undefined,
          status: JobApplicationStatus.Applied,
        });

        await deleteScoutJob(job.id);
        onApplicationCreated(createdApplication);
        removeJobFromQueue(job.id);
        if (isMissionLoopOpen) {
          setMissionPhase("summary");
        }
        toast.success("Scout job moved to tracker.");
      } catch (error) {
        console.error("Mark scout job applied failed:", error);
        setErrorMessage("Could not move the scout job to the tracker.");
      } finally {
        setIsActing(false);
      }
    },
    [isActing, isMissionLoopOpen, onApplicationCreated, setMissionPhase],
  );

  const handleRemoveScoutJob = useCallback(
    async (job: ScoutJob) => {
      if (isActing) {
        return;
      }

      try {
        setIsActing(true);
        setErrorMessage(null);
        await deleteScoutJob(job.id);
        removeJobFromQueue(job.id);
        toast.success("Scout job removed.");
      } catch (error) {
        console.error("Remove scout job failed:", error);
        setErrorMessage("Could not remove the scout job.");
      } finally {
        setIsActing(false);
      }
    },
    [isActing],
  );

  const handleSkip = useCallback(() => {
    if (!currentJob || isActing) {
      return;
    }

    setCurrentIndex((index) =>
      Math.min(index + 1, Math.max(0, evaluateJobs.length - 1)),
    );
  }, [currentJob, evaluateJobs.length, isActing]);

  const handleDeleteAll = async () => {
    try {
      setIsActing(true);
      setErrorMessage(null);
      await deleteAllScoutJobs();
      setJobs([]);
      setCurrentIndex(0);
      toast.success("All jobs cleared.");
    } catch (error) {
      console.error("Clear scout jobs failed:", error);
      setErrorMessage("Could not clear scout jobs.");
    } finally {
      setIsActing(false);
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <section
        className="deco-frame border-border-gold bg-deco-surface-soft p-4 shadow-deco-panel"
        data-tour-id="scout-header"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-gold">
              Review Jobs
            </p>
            <h2 className="mt-1 font-heading text-2xl text-deco-foreground">
              Review imported jobs
            </h2>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:flex-nowrap lg:items-center">
            <Button
              data-tour-id="scout-upload"
              className="w-full justify-center lg:w-auto"
              onClick={() => setActiveView("upload")}
              type="button"
              variant={activeView === "upload" ? "default" : "outline"}
            >
              Upload
            </Button>
            <Button
              data-tour-id="scout-evaluate"
              className="w-full justify-center lg:w-auto"
              onClick={() => setActiveView("evaluate")}
              type="button"
              variant={activeView === "evaluate" ? "default" : "outline"}
            >
              Review
            </Button>
            <Button
              data-tour-id="scout-to-apply"
              className="w-full justify-center lg:w-auto"
              onClick={() => setActiveView("to-apply")}
              type="button"
              variant={activeView === "to-apply" ? "default" : "outline"}
            >
              Saved
            </Button>
            <Button
              className="w-full justify-center lg:w-auto"
              onClick={() => void loadJobs()}
              type="button"
              variant="outline"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              className="w-full justify-center lg:w-auto"
              onClick={() => setIsExportDialogOpen(true)}
              type="button"
              variant="outline"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button
              className="w-full justify-center lg:w-auto"
              onClick={() => {
                setErrorMessage(null);
                setIsManualDialogOpen(true);
              }}
              type="button"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
              Add manually
            </Button>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <p className="deco-frame border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
          {errorMessage}
        </p>
      ) : null}

      {activeView === "upload" ? (
        <ScoutUploadPanel
          selectedFile={selectedFile}
          onFileSelect={setSelectedFile}
          isUploading={isUploading}
          uploadResult={uploadResult}
          onUpload={handleUpload}
        />
      ) : null}

      {activeView === "evaluate" ? (
        <ScoutEvaluatePanel
          isLoading={isLoading}
          currentJob={currentJob}
          currentIndex={currentIndex}
          evaluateCount={evaluateJobs.length}
          isActing={isActing}
          jobsLength={jobs.length}
          onDiscard={() => void handleDiscard()}
          onSkip={handleSkip}
          onSaveForLater={() => void handleSaveForLater()}
          onDeleteAll={handleDeleteAll}
          isActive={isActive}
        />
      ) : null}

      {activeView === "to-apply" ? (
        <ScoutToApplyPanel
          isLoading={isLoading}
          toApplyJobs={toApplyJobs}
          isActing={isActing}
          jobsLength={jobs.length}
          onMarkAsApplied={(job) => void handleMarkAsApplied(job)}
          onRemove={(job) => void handleRemoveScoutJob(job)}
          onDeleteAll={handleDeleteAll}
        />
      ) : null}

      <ScoutManualDialog
        open={isManualDialogOpen}
        onOpenChange={setIsManualDialogOpen}
        onJobsReload={loadJobs}
        onViewSwitch={setActiveView}
      />

      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="deco-frame-thick w-[min(96vw,30rem)] border-border-gold bg-deco-bg shadow-deco-panel">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl text-deco-foreground">
              Export job queue
            </DialogTitle>
            <DialogDescription className="text-sm text-deco-muted">
              Choose JSON for re-imports or CSV for spreadsheet tools like Excel.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <Button
              className="justify-start"
              onClick={() => {
                setIsExportDialogOpen(false);
                void handleExport("json");
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
                void handleExport("csv");
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
    </section>
  );
};

export default ScoutSection;
