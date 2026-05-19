import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Binoculars,
  FileDigit,
  ExternalLink,
  FileUp,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createScoutJob,
  deleteAllScoutJobs,
  deleteScoutJob,
  listScoutJobs,
  updateScoutJobState,
  uploadScoutJobs,
} from "../api/scoutJobsApi";
import { createJobApplication } from "../api/jobApplicationsApi";
import {
  JobApplicationStatus,
  type JobApplication,
  type ScoutJobCreateInput,
  type ScoutJob,
  type ScoutUploadResult,
} from "../types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

interface ScoutSectionProps {
  onApplicationCreated: (application: JobApplication) => void;
}

const splitTools = (value?: string | null) =>
  value
    ?.split(",")
    .map((tool) => tool.trim())
    .filter(Boolean) ?? [];

const formatPostedDate = (value?: string | null) => {
  if (!value) {
    return "Not provided";
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(value));
};

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

const emptyManualScoutForm = {
  title: "",
  company: "",
  location: "",
  workplaceType: "",
  commitment: "",
  postedAt: "",
  jobUrl: "",
  applyUrl: "",
  technicalTools: "",
  requirementsSummary: "",
};

const ScoutSection = ({ onApplicationCreated }: ScoutSectionProps) => {
  const [activeView, setActiveView] = useState<
    "upload" | "evaluate" | "to-apply"
  >("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<ScoutUploadResult | null>(null);
  const [jobs, setJobs] = useState<ScoutJob[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [manualForm, setManualForm] = useState(emptyManualScoutForm);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toApplyViewMode, setToApplyViewMode] = useState<"detailed" | "list">(
    "detailed",
  );

  const evaluateJobs = useMemo(
    () => jobs.filter((job) => !job.savedForApply && !job.isDiscarded),
    [jobs],
  );
  const toApplyJobs = useMemo(
    () => jobs.filter((job) => job.savedForApply && !job.isDiscarded),
    [jobs],
  );
  const currentJob = evaluateJobs[currentIndex] ?? null;
  const currentTools = useMemo(
    () => splitTools(currentJob?.technicalTools),
    [currentJob],
  );

  const loadJobs = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const items = await listScoutJobs();
      setJobs(items);
      setCurrentIndex(0);
    } catch (error) {
      console.error("Load scout jobs failed:", error);
      setErrorMessage("Could not load scout jobs.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

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

  const compactTools = (job: ScoutJob) => splitTools(job.technicalTools).slice(0, 2);

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

  const openManualDialog = () => {
    setManualForm(emptyManualScoutForm);
    setErrorMessage(null);
    setIsManualDialogOpen(true);
  };

  const closeManualDialog = () => {
    setIsManualDialogOpen(false);
  };

  const submitManualScoutJob = async () => {
    const title = manualForm.title.trim();
    const company = manualForm.company.trim();

    if (!title || !company) {
      setErrorMessage("Title and company are required for manual scout entries.");
      return;
    }

    const payload: ScoutJobCreateInput = {
      title,
      company,
      location: manualForm.location.trim() || null,
      workplaceType: manualForm.workplaceType.trim() || null,
      commitment: manualForm.commitment.trim() || null,
      postedAt: manualForm.postedAt || null,
      jobUrl: manualForm.jobUrl.trim() || null,
      applyUrl: manualForm.applyUrl.trim() || null,
      technicalTools: manualForm.technicalTools.trim() || null,
      requirementsSummary: manualForm.requirementsSummary.trim() || null,
    };

    try {
      setIsActing(true);
      setErrorMessage(null);
      await createScoutJob(payload);
      toast.success("Scout job added manually.");
      setIsManualDialogOpen(false);
      await loadJobs();
      setActiveView("evaluate");
    } catch (error) {
      console.error("Create manual scout job failed:", error);
      setErrorMessage("Could not add the scout job manually.");
    } finally {
      setIsActing(false);
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
      toast.success("Scout job moved to To Apply.");
    } catch (error) {
      console.error("Save scout job for later failed:", error);
      setErrorMessage("Could not save the scout job for later.");
    } finally {
      setIsActing(false);
    }
  }, [currentJob, isActing]);

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
      toast.success("Scout job discarded.");
    } catch (error) {
      console.error("Discard scout job failed:", error);
      setErrorMessage("Could not discard the scout job.");
    } finally {
      setIsActing(false);
    }
  }, [currentJob, isActing]);

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
          jobUrl: job.applyUrl ?? job.jobUrl ?? undefined,
          location: job.location ?? undefined,
          notes: notes || undefined,
          technicalStack: job.technicalTools ?? undefined,
          status: JobApplicationStatus.Applied,
        });

        await deleteScoutJob(job.id);
        onApplicationCreated(createdApplication);
        removeJobFromQueue(job.id);
        toast.success("Scout job moved to tracker.");
      } catch (error) {
        console.error("Mark scout job applied failed:", error);
        setErrorMessage("Could not move the scout job to the tracker.");
      } finally {
        setIsActing(false);
      }
    },
    [isActing, onApplicationCreated, jobs.length],
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
    [isActing, jobs.length],
  );

  const handleSkip = useCallback(() => {
    if (!currentJob || isActing) {
      return;
    }

    setCurrentIndex((index) =>
      Math.min(index + 1, Math.max(0, evaluateJobs.length - 1)),
    );
  }, [currentJob, evaluateJobs.length, isActing]);

  useEffect(() => {
    if (activeView !== "evaluate") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "l") {
        event.preventDefault();
        void handleSaveForLater();
      }

      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "h") {
        event.preventDefault();
        void handleDiscard();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        handleSkip();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeView, handleDiscard, handleSaveForLater, handleSkip]);

  const handleDeleteAll = async () => {
    try {
      setIsActing(true);
      setErrorMessage(null);
      await deleteAllScoutJobs();
      setJobs([]);
      setCurrentIndex(0);
      toast.success("Scout queue cleared.");
    } catch (error) {
      console.error("Clear scout jobs failed:", error);
      setErrorMessage("Could not clear scout jobs.");
    } finally {
      setIsActing(false);
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <section className="deco-frame border-border-gold bg-deco-surface-soft p-4 shadow-deco-panel">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary-gold">
              Job Scout
            </p>
            <h2 className="mt-1 font-heading text-2xl text-deco-foreground">
              Review imported jobs
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setActiveView("upload")}
              type="button"
              variant={activeView === "upload" ? "default" : "outline"}
            >
              Upload
            </Button>
            <Button
              onClick={() => setActiveView("evaluate")}
              type="button"
              variant={activeView === "evaluate" ? "default" : "outline"}
            >
              Evaluate
            </Button>
            <Button
              onClick={() => setActiveView("to-apply")}
              type="button"
              variant={activeView === "to-apply" ? "default" : "outline"}
            >
              To Apply
            </Button>
            <Button onClick={() => void loadJobs()} type="button" variant="outline">
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={openManualDialog} type="button" variant="outline">
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
        <Card>
          <CardHeader>
            <CardTitle>Upload jobs.json</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <label className="deco-frame flex min-h-[10rem] cursor-pointer flex-col items-center justify-center gap-3 border-border-gold-muted bg-deco-surface-soft p-6 text-center transition-colors hover:bg-primary-gold-muted">
              <FileUp className="h-8 w-8 text-primary-gold" />
              <span className="text-sm text-deco-foreground">
                {selectedFile?.name ?? "Choose a hiring-cafe-scout jobs.json file"}
              </span>
              <input
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) =>
                  setSelectedFile(event.target.files?.[0] ?? null)
                }
                type="file"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                disabled={isUploading}
                onClick={() => void handleUpload()}
                type="button"
              >
                <FileUp className="h-4 w-4" />
                {isUploading ? "Uploading..." : "Upload Scout File"}
              </Button>

              {uploadResult ? (
                <p className="text-sm text-deco-muted">
                  {uploadResult.imported} imported, {uploadResult.skipped} skipped
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeView === "evaluate" ? (
        <Card className="min-h-0 flex-1 overflow-hidden">
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Evaluate</CardTitle>
              <p className="mt-1 text-sm text-deco-muted">
                {currentJob
                  ? `${Math.min(currentIndex + 1, evaluateJobs.length)} of ${evaluateJobs.length} remaining`
                  : "No scout jobs waiting."}
              </p>
            </div>
            <Button
              disabled={isActing || jobs.length === 0}
              onClick={() => void handleDeleteAll()}
              type="button"
              variant="ghost"
            >
              <Trash2 className="h-4 w-4" />
              Clear Scout Queue
            </Button>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <p className="text-sm text-deco-muted">Loading scout jobs...</p>
            ) : null}

            {!isLoading && currentJob ? (
              <article className="deco-frame border-border-gold bg-deco-surface-soft p-5 shadow-deco-panel">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary-gold">
                      {currentJob.company}
                    </p>
                    <h3 className="mt-2 font-heading text-3xl text-deco-foreground">
                      {currentJob.title}
                    </h3>
                  </div>
                  <Badge>{formatPostedDate(currentJob.postedAt)}</Badge>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="deco-frame border-border-gold-muted bg-deco-surface px-3 py-2">
                    <p className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-primary-gold">
                      Location
                    </p>
                    <p className="mt-1 text-sm text-deco-foreground">
                      {currentJob.location ?? "Not provided"}
                    </p>
                  </div>
                  <div className="deco-frame border-border-gold-muted bg-deco-surface px-3 py-2">
                    <p className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-primary-gold">
                      Workplace
                    </p>
                    <p className="mt-1 text-sm text-deco-foreground">
                      {currentJob.workplaceType ?? "Not provided"}
                    </p>
                  </div>
                  <div className="deco-frame border-border-gold-muted bg-deco-surface px-3 py-2">
                    <p className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-primary-gold">
                      Commitment
                    </p>
                    <p className="mt-1 text-sm text-deco-foreground">
                      {currentJob.commitment ?? "Not provided"}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-primary-gold">
                    Tech Stack
                  </p>
                  {currentTools.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {currentTools.map((tool) => (
                        <span
                          className="deco-frame border-border-gold-muted bg-deco-card px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-deco-foreground"
                          key={tool}
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-deco-muted">Not provided</p>
                  )}
                </div>

                <div className="mt-5 grid gap-3">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-primary-gold">
                    Requirements Summary
                  </p>
                  <div className="deco-frame max-h-48 overflow-y-auto border-border-gold-muted bg-deco-surface p-3">
                    <pre className="whitespace-pre-wrap break-words font-mono text-[0.75rem] leading-5 text-deco-foreground">
                      {currentJob.requirementsSummary?.trim() ||
                        "No requirements summary provided."}
                    </pre>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  {currentJob.jobUrl ? (
                    <a
                      className="inline-flex items-center gap-2 text-sm text-deco-foreground underline decoration-primary-gold underline-offset-4 hover:text-primary-gold"
                      href={currentJob.jobUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Job page
                    </a>
                  ) : null}
                  {currentJob.applyUrl ? (
                    <a
                      className="inline-flex items-center gap-2 text-sm text-deco-foreground underline decoration-primary-gold underline-offset-4 hover:text-primary-gold"
                      href={currentJob.applyUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Apply page
                    </a>
                  ) : null}
                </div>

                <div className="mt-6 flex flex-col gap-3 border-t border-primary-gold-muted pt-4 sm:flex-row sm:justify-between">
                  <Button
                    disabled={isActing}
                    onClick={() => void handleDiscard()}
                    type="button"
                    variant="outline"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Discard
                  </Button>
                  <Button
                    disabled={isActing}
                    onClick={handleSkip}
                    type="button"
                    variant="ghost"
                  >
                    Skip for now
                  </Button>
                  <Button
                    disabled={isActing}
                    onClick={() => void handleSaveForLater()}
                    type="button"
                  >
                    <Save className="h-4 w-4" />
                    Save for later
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>

                <p className="mt-4 text-xs uppercase tracking-[0.16em] text-deco-muted">
                  Shortcuts: H or Left = discard, L or Right = save for later, Escape = skip
                </p>
              </article>
            ) : null}

            {!isLoading && !currentJob ? (
              <div className="deco-frame border-border-gold-muted bg-deco-surface-soft px-5 py-10 text-center">
                <p className="font-heading text-2xl text-deco-foreground">
                  No scout jobs in this pass.
                </p>
                <p className="mt-3 text-sm text-deco-muted">
                  Upload a new jobs.json file or refresh the queue.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {activeView === "to-apply" ? (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <CardHeader className="shrink-0 flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>To Apply</CardTitle>
              <p className="mt-1 text-sm text-deco-muted">
                {toApplyJobs.length > 0
                  ? `${toApplyJobs.length} jobs saved for later.`
                  : "No saved jobs yet."}
              </p>
            </div>
            <Button
              aria-pressed={toApplyViewMode === "list"}
              className="h-9 px-3"
              onClick={() =>
                setToApplyViewMode((current) =>
                  current === "detailed" ? "list" : "detailed",
                )
              }
              type="button"
              variant="outline"
            >
              <span className="inline-flex items-center gap-2">
                {toApplyViewMode === "detailed" ? (
                  <Binoculars className="h-4 w-4" />
                ) : (
                  <FileDigit className="h-4 w-4" />
                )}
                {toApplyViewMode === "detailed" ? "List view" : "Detail view"}
              </span>
            </Button>
            <Button
              disabled={isActing || jobs.length === 0}
              onClick={() => void handleDeleteAll()}
              type="button"
              variant="ghost"
            >
              <Trash2 className="h-4 w-4" />
              Clear Scout Queue
            </Button>
          </CardHeader>

          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {isLoading ? (
              <p className="text-sm text-deco-muted">Loading scout jobs...</p>
            ) : null}

            {!isLoading && toApplyJobs.length > 0 ? (
              <div
                className={`mt-3 flex-1 overflow-y-auto pr-1 ${
                  toApplyViewMode === "list" ? "space-y-2" : "space-y-3"
                }`}
              >
                {toApplyJobs.map((job) => {
                  const jobTools = splitTools(job.technicalTools);
                  const listTools = compactTools(job);
                  const applyHref = job.applyUrl ?? job.jobUrl ?? null;

                  return (
                    <article
                      className={`deco-frame border-border-gold bg-deco-surface-soft shadow-deco-panel ${
                        toApplyViewMode === "list" ? "px-3 py-2" : "p-3"
                      }`}
                      key={job.id}
                    >
                      <div
                        className={`flex ${
                          toApplyViewMode === "list"
                            ? "flex-col gap-2 xl:flex-row xl:items-center xl:justify-between"
                            : "flex-col gap-2 lg:flex-row lg:items-start lg:justify-between"
                        }`}
                      >
                        <div className="min-w-0">
                          {toApplyViewMode === "list" ? (
                            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[0.72rem] text-deco-muted">
                              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary-gold">
                                {job.company}
                              </p>
                              <span className="text-deco-muted">—</span>
                              <h3 className="truncate font-heading text-[0.95rem] text-deco-foreground">
                                {job.title}
                              </h3>
                              {listTools.length > 0 ? (
                                <>
                                  <span className="text-deco-muted">—</span>
                                  <span className="truncate">
                                    {listTools.join(", ")}
                                  </span>
                                </>
                              ) : null}
                              <span className="text-deco-muted">—</span>
                              <span>
                                {job.workplaceType ?? "Not provided"}
                                {job.location ? `, ${job.location}` : ""}
                              </span>
                            </div>
                          ) : (
                            <>
                              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary-gold">
                                  {job.company}
                                </p>
                                <span className="text-sm text-deco-muted">—</span>
                                <h3 className="font-heading text-xl text-deco-foreground">
                                  {job.title}
                                </h3>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2 text-[0.72rem] text-deco-muted">
                                <span>{job.location ?? "Not provided"}</span>
                                {job.workplaceType ? <span>• {job.workplaceType}</span> : null}
                                {job.commitment ? <span>• {job.commitment}</span> : null}
                                <span>• {formatPostedDate(job.postedAt)}</span>
                              </div>
                            </>
                          )}
                        </div>

                        {toApplyViewMode === "list" ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              disabled={isActing}
                              className="h-9 px-3"
                              onClick={() => void handleMarkAsApplied(job)}
                              type="button"
                              title="Mark as Applied"
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              disabled={isActing}
                              className="h-9 px-3"
                              onClick={() => void handleRemoveScoutJob(job)}
                              type="button"
                              variant="outline"
                              title="Remove"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            {applyHref ? (
                              <Button
                                asChild
                                className="h-9 shrink-0"
                                size="sm"
                                variant="outline"
                              >
                                <a href={applyHref} rel="noreferrer" target="_blank">
                                  <ExternalLink className="h-4 w-4" />
                                  Open
                                </a>
                              </Button>
                            ) : null}
                          </div>
                        ) : applyHref ? (
                          <Button asChild className="h-9 shrink-0" size="sm" variant="outline">
                            <a href={applyHref} rel="noreferrer" target="_blank">
                              <ExternalLink className="h-4 w-4" />
                              Open apply link
                            </a>
                          </Button>
                        ) : null}
                      </div>

                      {toApplyViewMode === "detailed" && jobTools.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {jobTools.map((tool) => (
                            <span
                              className="deco-frame border-border-gold-muted bg-deco-card px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-deco-foreground"
                              key={tool}
                            >
                              {tool}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {toApplyViewMode === "detailed" ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            disabled={isActing}
                            className="h-9 px-3"
                            onClick={() => void handleMarkAsApplied(job)}
                            type="button"
                          >
                            <Save className="h-4 w-4" />
                            Mark as Applied
                          </Button>
                          <Button
                            disabled={isActing}
                            className="h-9 px-3"
                            onClick={() => void handleRemoveScoutJob(job)}
                            type="button"
                            variant="outline"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </Button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : null}

            {!isLoading && toApplyJobs.length === 0 ? (
              <div className="deco-frame border-border-gold-muted bg-deco-surface-soft px-5 py-10 text-center">
                <p className="font-heading text-2xl text-deco-foreground">
                  No saved Scout jobs yet.
                </p>
                <p className="mt-3 text-sm text-deco-muted">
                  Save jobs from Evaluate to build your To Apply list.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
        <DialogContent className="max-h-[92vh] w-[min(96vw,65rem)] overflow-y-auto lg:overflow-hidden">
          <DialogHeader>
            <DialogTitle>Manually add scout job</DialogTitle>
          </DialogHeader>

          <div className="px-4 pb-4 pt-4">
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="grid gap-1">
                <label className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary-gold">
                  Title *
                </label>
                <Input
                  value={manualForm.title}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Senior Backend Engineer"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary-gold">
                  Company *
                </label>
                <Input
                  value={manualForm.company}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      company: event.target.value,
                    }))
                  }
                  placeholder="Acme GmbH"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary-gold">
                  Location
                </label>
                <Input
                  value={manualForm.location}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      location: event.target.value,
                    }))
                  }
                  placeholder="Remote / Berlin"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary-gold">
                  Workplace type
                </label>
                <Input
                  value={manualForm.workplaceType}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      workplaceType: event.target.value,
                    }))
                  }
                  placeholder="Hybrid"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary-gold">
                  Commitment
                </label>
                <Input
                  value={manualForm.commitment}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      commitment: event.target.value,
                    }))
                  }
                  placeholder="Full-time"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary-gold">
                  Posted date
                </label>
                <Input
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      postedAt: event.target.value,
                    }))
                  }
                  value={manualForm.postedAt}
                  type="date"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary-gold">
                  Job URL
                </label>
                <Input
                  value={manualForm.jobUrl}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      jobUrl: event.target.value,
                    }))
                  }
                  placeholder="https://..."
                />
              </div>

              <div className="grid gap-1">
                <label className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary-gold">
                  Apply URL
                </label>
                <Input
                  value={manualForm.applyUrl}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      applyUrl: event.target.value,
                    }))
                  }
                  placeholder="https://..."
                />
              </div>

              <div className="grid gap-1 lg:col-span-2">
                <label className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary-gold">
                  Technical tools
                </label>
                <Input
                  value={manualForm.technicalTools}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      technicalTools: event.target.value,
                    }))
                  }
                  placeholder="React, .NET, PostgreSQL"
                />
              </div>

              <div className="grid gap-1 lg:col-span-2">
                <label className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary-gold">
                  Requirements summary
                </label>
                <Textarea
                  className="min-h-32"
                  value={manualForm.requirementsSummary}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      requirementsSummary: event.target.value,
                    }))
                  }
                  placeholder="Notes, requirements, or scout observations..."
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-3">
              <Button
                onClick={closeManualDialog}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={isActing}
                onClick={() => void submitManualScoutJob()}
                type="button"
              >
                <Plus className="h-4 w-4" />
                Add scout job
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default ScoutSection;
