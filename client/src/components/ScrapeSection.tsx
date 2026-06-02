import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  Download,
  ExternalLink,
  FileText,
  X,
} from "lucide-react";
import {
  cancelScrapeJob,
  completeScrapeVerification,
  createScrapeJob,
  createScrapePreset,
  deleteScrapePreset,
  downloadScrapeJson,
  downloadScrapeMarkdown,
  getScrapeHistorySummary,
  getScrapeJob,
  listScrapePresets,
  type ScrapePreset,
} from "../api/scrapeApi";
import { useWorkflow } from "../context/WorkflowContext";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import {
  ScrapeJobStatus,
  type ScrapeHistorySummary,
  type ScrapeJobStatusResponse,
  type ScrapeProgress,
} from "../types";

interface ScrapeSectionProps {
  onSummaryChange: (summary: ScrapeHistorySummary | null) => void;
}

const isTerminalStatus = (status: ScrapeJobStatusResponse["status"]) =>
  status === ScrapeJobStatus.Done ||
  status === ScrapeJobStatus.Failed ||
  status === ScrapeJobStatus.Cancelled;

const downloadBlob = (blob: Blob, fileName: string) => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};

const formatCount = (value?: number | null) =>
  value == null ? "—" : new Intl.NumberFormat("en-US").format(value);

const getVisibleJobsSummary = (progress: ScrapeProgress) => {
  const visibleJobs = formatCount(progress.visibleJobsScraped);
  const pagesScraped = formatCount(progress.pagesScraped);
  if (visibleJobs && pagesScraped) {
    return `${visibleJobs} visible jobs scanned across ${pagesScraped} pages`;
  }
  if (visibleJobs) return `${visibleJobs} visible jobs scanned`;
  if (pagesScraped) return `${pagesScraped} pages scraped`;
  return null;
};

const ScrapeSection = ({ onSummaryChange }: ScrapeSectionProps) => {
  const [url, setUrl] = useState("");
  const [includeSeen, setIncludeSeen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ScrapeJobStatusResponse | null>(null);
  const [activeJobError, setActiveJobError] = useState<string | null>(null);
  const [working, setWorking] = useState<"json" | "markdown" | null>(null);
  const [verificationSaving, setVerificationSaving] = useState(false);
  const [presets, setPresets] = useState<ScrapePreset[]>([]);
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [deletePresetId, setDeletePresetId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const { setActiveSection, setScoutTourView } = useWorkflow();

  const loadPresets = async () => {
    try {
      setPresets(await listScrapePresets());
    } catch (error) {
      console.error("Could not load scrape presets:", error);
    }
  };

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      try {
        const summary = await getScrapeHistorySummary();
        if (!active) return;
        onSummaryChange(summary);
      } catch (error) {
        console.error("Could not load scrape history:", error);
      }
    };
    void loadHistory();
    void loadPresets();
    return () => { active = false; };
  }, [onSummaryChange]);

  useEffect(() => {
    if (!activeJob || isTerminalStatus(activeJob.status)) return;
    const intervalId = window.setInterval(async () => {
      try {
        const nextJob = await getScrapeJob(activeJob.jobId);
        setActiveJob(nextJob);
        if (isTerminalStatus(nextJob.status)) {
          window.clearInterval(intervalId);
        }
      } catch (pollError) {
        console.error("Could not poll scrape job:", pollError);
      }
    }, 2000);
    return () => window.clearInterval(intervalId);
  }, [activeJob?.jobId, activeJob?.status]);

  const extractErrorMessage = (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data;
      if (typeof data === "string" && data.trim()) return data;
      if (data && typeof data === "object") {
        const payload = data as { detail?: string; title?: string; message?: string; errors?: Record<string, string[]> };
        if (payload.detail?.trim()) return payload.detail;
        if (payload.message?.trim()) return payload.message;
        if (payload.title?.trim()) return payload.title;
        const validationMessage = Object.values(payload.errors ?? {}).flat().find((m) => typeof m === "string" && m.trim());
        if (validationMessage) return validationMessage;
      }
    }
    return "Could not start the scrape job.";
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    try {
      const job = await createScrapeJob({ url, includeSeen });
      setActiveJob(job);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (format: "json" | "markdown") => {
    if (!activeJob) return;
    setWorking(format);
    try {
      const blob = format === "json"
        ? await downloadScrapeJson(activeJob.jobId)
        : await downloadScrapeMarkdown(activeJob.jobId);
      downloadBlob(blob, format === "json" ? "jobs.json" : "jobs.md");
    } catch (downloadError) {
      console.error("Could not download scrape result:", downloadError);
      setErrorMessage("Could not download the scrape result.");
    } finally {
      setWorking(null);
    }
  };

  const handleCompleteVerification = async () => {
    if (!activeJob) return;
    setVerificationSaving(true);
    try {
      const nextJob = await completeScrapeVerification(activeJob.jobId);
      setActiveJob(nextJob);
      setActiveJobError(null);
    } catch (completeError) {
      console.error("Could not complete verification:", completeError);
      setErrorMessage("Could not mark verification complete.");
    } finally {
      setVerificationSaving(false);
    }
  };

  const handleNewScrape = () => {
    setActiveJob(null);
    setUrl("");
    setIncludeSeen(false);
    setErrorMessage(null);
    setActiveJobError(null);
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) return;
    try {
      await createScrapePreset({ name: presetName.trim(), sourceUrl: url });
      await loadPresets();
      setPresetName("");
      setPresetDialogOpen(false);
    } catch (error) {
      console.error("Could not save preset:", error);
    }
  };

  const openPresetDialog = () => {
    setPresetName("");
    setPresetDialogOpen(true);
  };

  const handleDeletePreset = async () => {
    if (!deletePresetId) return;
    try {
      await deleteScrapePreset(deletePresetId);
      setPresets((prev) => prev.filter((p) => p.id !== deletePresetId));
    } catch (error) {
      console.error("Could not delete preset:", error);
    } finally {
      setDeletePresetId(null);
    }
  };

  const handleUsePreset = (presetUrl: string) => {
    setUrl(presetUrl);
  };

  const handleCancel = async () => {
    if (!activeJob) return;
    setCancelling(true);
    try {
      const result = await cancelScrapeJob(activeJob.jobId);
      setActiveJob(result);
    } catch (error) {
      console.error("Could not cancel scrape job:", error);
    } finally {
      setCancelling(false);
    }
  };

  const job = activeJob;
  const title = useMemo(() => {
    if (!job) return "Start a new scrape";
    switch (job.status) {
      case ScrapeJobStatus.Queued: return "Waiting to start";
      case ScrapeJobStatus.Running: return "Collecting jobs";
      case ScrapeJobStatus.NeedsVerification: return "HiringCafe needs browser verification";
      case ScrapeJobStatus.Verifying: return "Waiting for verification";
      case ScrapeJobStatus.Done: return "Scrape complete";
      case ScrapeJobStatus.Failed: return "Scrape failed";
      case ScrapeJobStatus.Cancelled: return "Scrape cancelled";
      default: return "Scrape status";
    }
  }, [job]);

  const progress = job?.progress ?? null;
  const progressPercent = job?.status === ScrapeJobStatus.Done ? 100 : progress?.progressPercent ?? null;
  const showProgressCard = progress !== null || job?.status === ScrapeJobStatus.Running || job?.status === ScrapeJobStatus.Done;
  const isIndeterminateProgress = job?.status === ScrapeJobStatus.Running && progressPercent === null;
  const visibleJobsSummary = progress ? getVisibleJobsSummary(progress) : null;
  const matchedJobsText = progress?.matchedJobs != null ? `${formatCount(progress.matchedJobs)} matched jobs` : null;
  const currentPageText = progress?.currentPageListings != null
    ? [`${formatCount(progress.currentPageListings)} current page listings`,
       progress.currentPageMatched != null ? `${formatCount(progress.currentPageMatched)} matched on this page` : null,
      ].filter(Boolean).join(", ")
    : null;
  const skippedSeenText = progress?.skippedSeen && progress.skippedSeen > 0
    ? `${formatCount(progress.skippedSeen)} skipped seen jobs` : null;
  const estimatedTotalText = progress?.estimatedTotalJobs != null
    ? `${progress.totalIsEstimate === false ? "Site total" : "Estimated site total"}: ${progress.totalIsEstimate === false ? "" : "~"}${formatCount(progress.estimatedTotalJobs)}`
    : null;
  const finalResultCountText = job?.status === ScrapeJobStatus.Done && job.resultCount != null
    ? `${formatCount(job.resultCount)} final results from jobs.json` : null;

  return (
    <section className="flex min-h-0 flex-col gap-4">
      <Card className="border-border-gold bg-deco-surface-soft shadow-deco-panel">
        <CardHeader className="border-b border-primary-gold-muted bg-primary-gold-muted">
          <CardTitle className="mt-1">{title}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6">
          {activeJobError ? (
            <p className="deco-frame border-danger bg-danger-soft px-4 py-3 text-sm text-danger">{activeJobError}</p>
          ) : null}
          {errorMessage ? (
            <p className="deco-frame border-danger bg-danger-soft px-4 py-3 text-sm text-danger">{errorMessage}</p>
          ) : null}

          {job ? (
            <div className="grid gap-4">
              <div className="deco-frame border-border-gold-muted bg-deco-surface px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-gold">Status</p>
                <p className="mt-1 font-heading text-2xl text-deco-foreground">{job.status.replace(/_/g, " ")}</p>
                {job.message ? <p className="mt-2 text-sm text-deco-muted">{job.message}</p> : null}
              </div>

              {job.status === ScrapeJobStatus.Queued || job.status === ScrapeJobStatus.Running ? (
                <div className="deco-frame border-border-gold-muted bg-deco-surface-soft px-4 py-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-deco-muted">
                    {job.status === ScrapeJobStatus.Queued ? "Waiting for the scraper worker to start." : "Collecting jobs from HiringCafe now."}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 px-3 text-xs shrink-0"
                    disabled={cancelling}
                    onClick={() => void handleCancel()}
                  >
                    {cancelling ? "Cancelling..." : "Cancel"}
                  </Button>
                </div>
              ) : null}

              {showProgressCard ? (
                <div className="deco-frame border-border-gold-muted bg-deco-surface px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-gold">Activity</p>
                    <p className="text-xs uppercase tracking-[0.12em] text-deco-muted">
                      {progressPercent !== null ? `${Math.round(progressPercent)}%` : job.status === ScrapeJobStatus.Running ? "Updating" : "Pending"}
                    </p>
                  </div>
                  {progressPercent !== null || isIndeterminateProgress ? (
                    <div className="mt-3 h-2 overflow-hidden border border-border-gold-muted bg-deco-surface-soft">
                      {progressPercent !== null ? (
                        <div className="h-full bg-primary-gold" style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }} />
                      ) : (
                        <div className="h-full w-1/3 animate-pulse bg-primary-gold" />
                      )}
                    </div>
                  ) : null}
                  <div className="mt-4 grid gap-2 text-sm text-deco-foreground sm:grid-cols-2">
                    {visibleJobsSummary ? <p>{visibleJobsSummary}</p> : null}
                    {matchedJobsText ? <p>{matchedJobsText}</p> : null}
                    {currentPageText ? <p>{currentPageText}</p> : null}
                    {skippedSeenText ? <p>{skippedSeenText}</p> : null}
                    {estimatedTotalText ? <p>{estimatedTotalText}</p> : null}
                    {job.status === ScrapeJobStatus.Done && finalResultCountText ? <p className="sm:col-span-2">{finalResultCountText}</p> : null}
                    {progress?.message ? <p className="text-deco-muted sm:col-span-2">{progress.message}</p> : null}
                  </div>
                </div>
              ) : null}

              {job.status === ScrapeJobStatus.NeedsVerification || job.status === ScrapeJobStatus.Verifying ? (
                <div className="deco-frame border-border-gold-muted bg-deco-surface-soft px-4 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm text-deco-foreground">Open the verification browser session, clear the challenge, then mark it complete.</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-deco-muted">The same browser profile stays attached to this scrape job.</p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                      <Button asChild className="w-full sm:w-auto" type="button" variant="outline">
                        <Link to={`/verify/${job.jobId}`}>
                          <ExternalLink className="h-4 w-4" />
                          Open verification session
                        </Link>
                      </Button>
                      <Button className="w-full sm:w-auto" disabled={verificationSaving} onClick={() => void handleCompleteVerification()} type="button">
                        <CircleCheck className="h-4 w-4" />
                        {verificationSaving ? "Saving..." : "I completed verification"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {job.status === ScrapeJobStatus.Done ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button disabled={working !== null} onClick={() => void handleDownload("json")} type="button">
                    <Download className="h-4 w-4" />
                    {working === "json" ? "Downloading..." : "Download jobs.json"}
                  </Button>
                  <Button disabled={working !== null} onClick={() => void handleDownload("markdown")} type="button" variant="outline">
                    <FileText className="h-4 w-4" />
                    {working === "markdown" ? "Downloading..." : "Download jobs.md"}
                  </Button>
                  <Button onClick={() => { setActiveSection("review"); setScoutTourView("review"); }} type="button" variant="outline">
                    <ArrowRight className="h-4 w-4" />
                    Review imported jobs
                  </Button>
                  <Button onClick={handleNewScrape} type="button" variant="ghost">
                    <ArrowLeft className="h-4 w-4" />
                    New scrape
                  </Button>
                </div>
              ) : null}

              {job.status === ScrapeJobStatus.Failed ? (
                <div className="deco-frame border-danger bg-danger-soft px-4 py-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold uppercase tracking-[0.12em]">Scrape failed</p>
                      <p className="mt-1 text-sm">{job.error ?? "The scraper stopped before producing output."}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button onClick={handleNewScrape} type="button" variant="outline">
                  <ArrowLeft className="h-4 w-4" />
                  Back to setup
                </Button>
              </div>
            </div>
          ) : (
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <label className="text-sm font-semibold uppercase tracking-[0.12em] text-deco-muted">HiringCafe URL</label>
                <Input required className="border-border-gold-muted focus-visible:ring-primary-gold" onChange={(event) => setUrl(event.target.value)} placeholder="https://hiring.cafe/?searchState=..." type="url" value={url} />
              </div>
              <label className="flex items-center gap-3 text-sm text-deco-foreground">
                <input checked={includeSeen} className="h-4 w-4 accent-[var(--color-primary)]" onChange={(event) => setIncludeSeen(event.target.checked)} type="checkbox" />
                Include previously seen jobs
              </label>
              <div className="flex flex-wrap gap-3">
                <Button disabled={loading} type="submit">{loading ? "Starting..." : "Start scrape"}</Button>
                <Button asChild type="button" variant="outline">
                  <a href="https://hiring.cafe" rel="noreferrer" target="_blank">
                    <ExternalLink className="h-4 w-4" />
                    Go to hiring.cafe
                  </a>
                </Button>
                {url.trim() && (
                  <Button type="button" variant="ghost" onClick={openPresetDialog}>
                    Save as preset
                  </Button>
                )}
              </div>
              {presets.length > 0 && (
                <div className="border-t border-primary-gold-muted pt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-gold mb-2">
                    Saved searches
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {presets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className="deco-frame group inline-flex items-center gap-2 border-border-gold bg-deco-surface px-3 py-1.5 text-sm font-medium text-deco-foreground shadow-sm transition-all hover:border-primary-gold hover:bg-primary-gold/10 hover:shadow-md"
                        onClick={() => handleUsePreset(preset.sourceUrl)}
                      >
                        {preset.name}
                        <span
                          className="flex h-4 w-4 items-center justify-center rounded-full text-deco-muted opacity-0 transition-opacity hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
                          aria-label={`Delete preset ${preset.name}`}
                          onClick={(e) => { e.stopPropagation(); setDeletePresetId(preset.id); }}
                          role="button"
                        >
                          <X className="h-3 w-3" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </form>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="deco-frame-thick border-border-gold bg-deco-bg/78 p-4 shadow-deco-panel backdrop-blur-md sm:p-6">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-gold">HiringCafe Guide</p>
              <h3 className="font-heading text-2xl text-deco-foreground">What is hiring.cafe?</h3>
              <p className="text-sm leading-6 text-deco-muted sm:text-sm">
                hiring.cafe is a job aggregator that collects postings from hundreds of sources worldwide and provides structured search with precise filters - by keyword, seniority, location, workplace type, and more. Unlike LinkedIn or Indeed, keyword searches on hiring.cafe return exact matches, making it significantly more reliable for specific tech stacks like .NET, C#, or ASP.NET.
              </p>
            </div>
            <div className="grid gap-2 border-t border-primary-gold-muted pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-gold">Why do we use it?</p>
              <p className="text-sm leading-6 text-deco-muted sm:text-sm">
                Most job portals have poor keyword matching and make it difficult to apply directly on company websites. hiring.cafe provides direct apply links to the original job posting, so you skip the middleman and apply where it matters.
              </p>
            </div>
          </div>
        </section>

        <section className="deco-frame-thick border-border-gold bg-deco-bg/78 p-4 shadow-deco-panel backdrop-blur-md sm:p-6">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-gold">Scout Flow</p>
              <h3 className="font-heading text-2xl text-deco-foreground">How the Scout works</h3>
            </div>
            <div className="grid gap-2 border-t border-primary-gold-muted pt-4 text-sm leading-6 text-deco-muted sm:text-sm">
              <p>Go to hiring.cafe and set your filters</p>
              <p>Copy the search URL from your browser</p>
              <p>Paste it here and start scraping</p>
              <p>Evaluate results with the swipe interface</p>
              <p>Save the ones worth applying to and apply directly on the company website</p>
            </div>
          </div>
        </section>
      </div>

      <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
        <DialogContent className="border-border-gold bg-deco-bg/95 shadow-deco-panel backdrop-blur-md sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-deco-foreground">Save search preset</DialogTitle>
            <DialogDescription className="text-deco-muted">
              Save this hiring.cafe URL for quick one-click reuse later.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 pt-2"
            onSubmit={(e) => { e.preventDefault(); void handleSavePreset(); }}
          >
            <Input
              autoFocus
              className="border-border-gold-muted focus-visible:ring-primary-gold"
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="e.g. .NET Germany Remote"
              value={presetName}
            />
            <div className="flex justify-end gap-2">
              <Button className="h-8 px-3 text-xs" type="button" variant="outline" onClick={() => setPresetDialogOpen(false)}>
                Cancel
              </Button>
              <Button className="h-8 px-3 text-xs" type="submit" disabled={!presetName.trim()}>
                Save preset
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deletePresetId !== null} onOpenChange={(open) => { if (!open) setDeletePresetId(null); }}>
        <DialogContent className="border-border-gold bg-deco-bg/95 shadow-deco-panel backdrop-blur-md sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-deco-foreground">Delete preset?</DialogTitle>
            <DialogDescription className="text-deco-muted">
              This only removes the saved search — your existing scraped jobs are not affected.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button className="h-8 px-3 text-xs" type="button" variant="outline" onClick={() => setDeletePresetId(null)}>
              Cancel
            </Button>
            <Button className="h-8 px-3 text-xs" type="button" variant="default" onClick={() => void handleDeletePreset()}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default ScrapeSection;
