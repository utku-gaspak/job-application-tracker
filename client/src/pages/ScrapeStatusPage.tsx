import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  Download,
  ExternalLink,
  LoaderCircle,
  FileText,
} from "lucide-react";
import {
  completeScrapeVerification,
  downloadScrapeJson,
  downloadScrapeMarkdown,
  getScrapeJob,
} from "../api/scrapeApi";
import {
  ScrapeJobStatus as ScrapeStatus,
  type ScrapeProgress,
  type ScrapeJobStatusResponse,
} from "../types";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useWorkflow } from "../context/WorkflowContext";

const isTerminalStatus = (status: ScrapeStatus) =>
  status === ScrapeStatus.Done ||
  status === ScrapeStatus.Failed ||
  status === ScrapeStatus.Cancelled;

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
  value == null ? null : new Intl.NumberFormat("en-US").format(value);

const getVisibleJobsSummary = (progress: ScrapeProgress) => {
  const visibleJobs = formatCount(progress.visibleJobsScraped);
  const pagesScraped = formatCount(progress.pagesScraped);

  if (visibleJobs && pagesScraped) {
    return `${visibleJobs} visible jobs scanned across ${pagesScraped} pages`;
  }

  if (visibleJobs) {
    return `${visibleJobs} visible jobs scanned`;
  }

  if (pagesScraped) {
    return `${pagesScraped} pages scraped`;
  }

  return null;
};

const ScrapeStatusPage = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { setActiveSection } = useWorkflow();
  const [job, setJob] = useState<ScrapeJobStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [working, setWorking] = useState<"json" | "markdown" | null>(null);
  const [verificationSaving, setVerificationSaving] = useState(false);
  const progress = job?.progress ?? null;
  const progressPercent = job?.status === ScrapeStatus.Done ? 100 : progress?.progressPercent ?? null;
  const showProgressCard =
    progress !== null ||
    job?.status === ScrapeStatus.Running ||
    job?.status === ScrapeStatus.Done;
  const isIndeterminateProgress =
    job?.status === ScrapeStatus.Running && progressPercent === null;
  const visibleJobsSummary = progress ? getVisibleJobsSummary(progress) : null;
  const matchedJobsText =
    progress?.matchedJobs != null
      ? `${formatCount(progress.matchedJobs)} matched jobs`
      : null;
  const currentPageText =
    progress?.currentPageListings != null
      ? [
          `${formatCount(progress.currentPageListings)} current page listings`,
          progress.currentPageMatched != null
            ? `${formatCount(progress.currentPageMatched)} matched on this page`
            : null,
        ]
          .filter(Boolean)
          .join(", ")
      : null;
  const skippedSeenText =
    progress?.skippedSeen && progress.skippedSeen > 0
      ? `${formatCount(progress.skippedSeen)} skipped seen jobs`
      : null;
  const estimatedTotalText =
    progress?.estimatedTotalJobs != null
      ? `${progress.totalIsEstimate === false ? "Site total" : "Estimated site total"}: ${
          progress.totalIsEstimate === false ? "" : "~"
        }${formatCount(progress.estimatedTotalJobs)}`
      : null;
  const finalResultCountText =
    job?.status === ScrapeStatus.Done && job.resultCount != null
      ? `${formatCount(job.resultCount)} final results from jobs.json`
      : null;

  const title = useMemo(() => {
    if (!job) {
      return "Scrape job";
    }

    switch (job.status) {
      case ScrapeStatus.Queued:
        return "Waiting to start";
      case ScrapeStatus.Running:
        return "Collecting jobs";
      case ScrapeStatus.NeedsVerification:
        return "HiringCafe needs browser verification";
      case ScrapeStatus.Verifying:
        return "Waiting for verification";
      case ScrapeStatus.Done:
        return "Scrape complete";
      case ScrapeStatus.Failed:
        return "Scrape failed";
      case ScrapeStatus.Cancelled:
        return "Scrape cancelled";
      default:
        return "Scrape job";
    }
  }, [job]);

  useEffect(() => {
    if (!jobId) {
      setErrorMessage("Scrape job id is missing.");
      setLoading(false);
      return;
    }

    let active = true;
    let intervalId: number | null = null;

    const loadJob = async () => {
      try {
        const nextJob = await getScrapeJob(jobId);

        if (!active) {
          return;
        }

        setJob(nextJob);
        setErrorMessage(null);
        setLoading(false);

        if (isTerminalStatus(nextJob.status) && intervalId !== null) {
          window.clearInterval(intervalId);
          intervalId = null;
        }
      } catch (loadError) {
        console.error("Could not load scrape job:", loadError);
        if (active) {
          setErrorMessage("Could not load the scrape job.");
          setLoading(false);
        }
      }
    };

    void loadJob();
    intervalId = window.setInterval(() => {
      void loadJob();
    }, 2000);

    return () => {
      active = false;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [jobId]);

  const handleDownload = async (format: "json" | "markdown") => {
    if (!jobId) {
      return;
    }

    setWorking(format);

    try {
      const blob =
        format === "json"
          ? await downloadScrapeJson(jobId)
          : await downloadScrapeMarkdown(jobId);

      downloadBlob(blob, format === "json" ? "jobs.json" : "jobs.md");
    } catch (downloadError) {
      console.error("Could not download scrape result:", downloadError);
      setErrorMessage("Could not download the scrape result.");
    } finally {
      setWorking(null);
    }
  };

  const handleCompleteVerification = async () => {
    if (!jobId) {
      return;
    }

    setVerificationSaving(true);

    try {
      const nextJob = await completeScrapeVerification(jobId);
      setJob(nextJob);
      setErrorMessage(null);
    } catch (completeError) {
      console.error("Could not complete verification:", completeError);
      setErrorMessage("Could not mark verification complete.");
    } finally {
      setVerificationSaving(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100dvh/var(--ui-scale))] w-full max-w-4xl flex-col px-4 py-4">
      <Card className="flex min-h-0 flex-1 flex-col border-border-gold bg-deco-surface-soft shadow-deco-panel">
        <CardHeader className="border-b border-primary-gold-muted bg-primary-gold-muted">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-gold">
                HiringCafe Scrape
              </p>
              <CardTitle className="mt-1">{title}</CardTitle>
            </div>
            <Button onClick={() => navigate("/scrape")} type="button" variant="outline">
              <ArrowLeft className="h-4 w-4" />
              New scrape
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 pt-6">
          {loading && !job ? (
            <div className="deco-frame flex items-center gap-3 border-border-gold-muted bg-deco-card px-4 py-3 text-deco-muted">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading scrape status...
            </div>
          ) : null}

          {errorMessage ? (
            <p className="deco-frame border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
              {errorMessage}
            </p>
          ) : null}

          {job ? (
            <div className="grid gap-4">
              <div className="deco-frame border-border-gold-muted bg-deco-surface px-4 py-3">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-primary-gold">
                  Status
                </p>
                <p className="mt-1 font-heading text-2xl text-deco-foreground">
                  {job.status.replace(/_/g, " ")}
                </p>
                {job.message ? (
                  <p className="mt-2 text-sm text-deco-muted">{job.message}</p>
                ) : null}
              </div>

              {job.status === ScrapeStatus.Queued || job.status === ScrapeStatus.Running ? (
                <div className="deco-frame border-border-gold-muted bg-deco-surface-soft px-4 py-3">
                  <p className="text-sm text-deco-muted">
                    {job.status === ScrapeStatus.Queued
                      ? "Waiting for the scraper worker to start."
                      : "Collecting jobs from HiringCafe now."}
                  </p>
                </div>
              ) : null}

              {showProgressCard ? (
                <div className="deco-frame border-border-gold-muted bg-deco-surface px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-primary-gold">
                      Activity
                    </p>
                    <p className="text-xs uppercase tracking-[0.14em] text-deco-muted">
                      {progressPercent !== null
                        ? `${Math.round(progressPercent)}%`
                        : job.status === ScrapeStatus.Running
                          ? "Updating"
                          : "Pending"}
                    </p>
                  </div>

                  {progressPercent !== null || isIndeterminateProgress ? (
                    <div className="mt-3 h-2 overflow-hidden border border-border-gold-muted bg-deco-surface-soft">
                      {progressPercent !== null ? (
                        <div
                          className="h-full bg-primary-gold"
                          style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
                        />
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
                    {job.status === ScrapeStatus.Done && finalResultCountText ? (
                      <p className="sm:col-span-2">{finalResultCountText}</p>
                    ) : null}
                    {progress?.message ? (
                      <p className="text-deco-muted sm:col-span-2">{progress.message}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {job.status === ScrapeStatus.NeedsVerification || job.status === ScrapeStatus.Verifying ? (
                <div className="deco-frame border-border-gold-muted bg-deco-surface-soft px-4 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm text-deco-foreground">
                        Open the verification browser session, clear the challenge, then mark it complete.
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-deco-muted">
                        The same browser profile stays attached to this scrape job.
                      </p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                      <Button
                        asChild
                        className="w-full sm:w-auto"
                        type="button"
                        variant="outline"
                      >
                        <Link to={`/verify/${job.jobId}`}>
                          <ExternalLink className="h-4 w-4" />
                          Open verification session
                        </Link>
                      </Button>
                      <Button
                        className="w-full sm:w-auto"
                        disabled={verificationSaving}
                        onClick={() => void handleCompleteVerification()}
                        type="button"
                      >
                        <CircleCheck className="h-4 w-4" />
                        {verificationSaving ? "Saving..." : "I completed verification"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {job.status === ScrapeStatus.Done ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    disabled={working !== null}
                    onClick={() => void handleDownload("json")}
                    type="button"
                  >
                    <Download className="h-4 w-4" />
                    {working === "json" ? "Downloading..." : "Download jobs.json"}
                  </Button>
                  <Button
                    disabled={working !== null}
                    onClick={() => void handleDownload("markdown")}
                    type="button"
                    variant="outline"
                  >
                    <FileText className="h-4 w-4" />
                    {working === "markdown" ? "Downloading..." : "Download jobs.md"}
                  </Button>
                    <Button
                      onClick={() => {
                        setActiveSection("scout");
                        navigate("/#scout");
                      }}
                      type="button"
                      variant="outline"
                    >
                    <ArrowRight className="h-4 w-4" />
                    Open Scout queue
                  </Button>
                </div>
              ) : null}

              {job.status === ScrapeStatus.Failed ? (
                <div className="deco-frame border-danger bg-danger-soft px-4 py-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold uppercase tracking-[0.14em]">Scrape failed</p>
                      <p className="mt-1 text-sm">
                        {job.error ?? "The scraper stopped before producing output."}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => navigate("/")} type="button" variant="ghost">
                  <ArrowRight className="h-4 w-4" />
                  Back to board
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
};

export default ScrapeStatusPage;
