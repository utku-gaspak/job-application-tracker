import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  Download,
  ExternalLink,
  FileText,
  LoaderCircle,
} from "lucide-react";
import {
  completeScrapeVerification,
  createScrapeJob,
  downloadScrapeJson,
  downloadScrapeMarkdown,
  getScrapeHistorySummary,
  getScrapeJob,
} from "../api/scrapeApi";
import Footer from "../components/Footer";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useWorkflow } from "../context/WorkflowContext";
import {
  ScrapeJobStatus,
  type ScrapeHistorySummary,
  type ScrapeJobStatusResponse,
  type ScrapeProgress,
} from "../types";

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

const formatTimestamp = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "—";

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

const ScrapePage = () => {
  const { jobId: routeJobId } = useParams<{ jobId?: string }>();
  const [url, setUrl] = useState("");
  const [includeSeen, setIncludeSeen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ScrapeJobStatusResponse | null>(null);
  const [activeJobLoading, setActiveJobLoading] = useState(Boolean(routeJobId));
  const [activeJobError, setActiveJobError] = useState<string | null>(null);
  const [working, setWorking] = useState<"json" | "markdown" | null>(null);
  const [verificationSaving, setVerificationSaving] = useState(false);
  const [historySummary, setHistorySummary] = useState<ScrapeHistorySummary | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const navigate = useNavigate();
  const { setActiveSection, setScoutTourView } = useWorkflow();

  useEffect(() => {
    let active = true;

    const loadHistory = async () => {
      try {
        const summary = await getScrapeHistorySummary();
        if (!active) {
          return;
        }

        setHistorySummary(summary);
      } catch (error) {
        console.error("Could not load scrape history:", error);
      } finally {
        if (active) {
          setHistoryLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!routeJobId) {
      setActiveJob(null);
      setActiveJobError(null);
      setActiveJobLoading(false);
      return;
    }

    let active = true;
    let intervalId: number | null = null;

    const loadJob = async () => {
      try {
        const nextJob = await getScrapeJob(routeJobId);

        if (!active) {
          return;
        }

        setActiveJob(nextJob);
        setActiveJobError(null);
        setActiveJobLoading(false);

        if (isTerminalStatus(nextJob.status) && intervalId !== null) {
          window.clearInterval(intervalId);
          intervalId = null;
        }
      } catch (loadError) {
        console.error("Could not load scrape job:", loadError);
        if (active) {
          setActiveJobError("Could not load the scrape job.");
          setActiveJobLoading(false);
        }
      }
    };

    setActiveJobLoading(true);
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
  }, [routeJobId]);

  const extractErrorMessage = (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data;

      if (typeof data === "string" && data.trim()) {
        return data;
      }

      if (data && typeof data === "object") {
        const payload = data as {
          detail?: string;
          title?: string;
          message?: string;
          errors?: Record<string, string[]>;
        };

        if (payload.detail?.trim()) {
          return payload.detail;
        }

        if (payload.message?.trim()) {
          return payload.message;
        }

        if (payload.title?.trim()) {
          return payload.title;
        }

        const validationMessage = Object.values(payload.errors ?? {})
          .flat()
          .find((message) => typeof message === "string" && message.trim());

        if (validationMessage) {
          return validationMessage;
        }
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
      navigate(`/scrape/${job.jobId}`);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const job = activeJob;
  const title = useMemo(() => {
    if (!job) {
      return routeJobId ? "Scrape status" : "Scrape setup";
    }

    switch (job.status) {
      case ScrapeJobStatus.Queued:
        return "Waiting to start";
      case ScrapeJobStatus.Running:
        return "Collecting jobs";
      case ScrapeJobStatus.NeedsVerification:
        return "HiringCafe needs browser verification";
      case ScrapeJobStatus.Verifying:
        return "Waiting for verification";
      case ScrapeJobStatus.Done:
        return "Scrape complete";
      case ScrapeJobStatus.Failed:
        return "Scrape failed";
      case ScrapeJobStatus.Cancelled:
        return "Scrape cancelled";
      default:
        return "Scrape status";
    }
  }, [job]);

  const progress = job?.progress ?? null;
  const progressPercent =
    job?.status === ScrapeJobStatus.Done ? 100 : progress?.progressPercent ?? null;
  const showProgressCard =
    progress !== null ||
    job?.status === ScrapeJobStatus.Running ||
    job?.status === ScrapeJobStatus.Done;
  const isIndeterminateProgress =
    job?.status === ScrapeJobStatus.Running && progressPercent === null;
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
    job?.status === ScrapeJobStatus.Done && job.resultCount != null
      ? `${formatCount(job.resultCount)} final results from jobs.json`
      : null;

  const handleDownload = async (format: "json" | "markdown") => {
    if (!routeJobId) {
      return;
    }

    setWorking(format);

    try {
      const blob =
        format === "json"
          ? await downloadScrapeJson(routeJobId)
          : await downloadScrapeMarkdown(routeJobId);

      downloadBlob(blob, format === "json" ? "jobs.json" : "jobs.md");
    } catch (downloadError) {
      console.error("Could not download scrape result:", downloadError);
      setErrorMessage("Could not download the scrape result.");
    } finally {
      setWorking(null);
    }
  };

  const handleCompleteVerification = async () => {
    if (!routeJobId) {
      return;
    }

    setVerificationSaving(true);

    try {
      const nextJob = await completeScrapeVerification(routeJobId);
      setActiveJob(nextJob);
      setActiveJobError(null);
    } catch (completeError) {
      console.error("Could not complete verification:", completeError);
      setErrorMessage("Could not mark verification complete.");
    } finally {
      setVerificationSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-3 py-3 lg:px-5">
        <header className="deco-frame-thick mb-3 flex w-full flex-col gap-3 bg-deco-surface-soft px-3 py-3 shadow-deco-panel sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-gold">
              HiringCafe Scrape
            </p>
            <h1 className="mt-1 font-heading text-3xl tracking-tight text-deco-foreground md:text-4xl">
              Start a new scrape job
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => navigate("/")} type="button" variant="outline">
              <ArrowLeft className="h-4 w-4" />
              Back to board
            </Button>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-stretch md:min-h-0 md:flex-1">
          <aside className="deco-frame flex h-auto min-h-0 w-full flex-col items-stretch overflow-visible border-border-gold bg-deco-surface-soft p-4 shadow-deco-panel md:h-full md:overflow-hidden md:p-6">
            <section className="deco-frame border-border-gold bg-deco-surface p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-gold">
                Scrape history
              </p>
              <h2 className="mt-1 font-heading text-xl text-deco-foreground">
                Recent scrape activity
              </h2>

              {historyLoading ? (
                <p className="mt-4 text-sm text-deco-muted">Loading history...</p>
              ) : historySummary ? (
                <div className="mt-4 grid gap-4">
                  <div className="grid grid-cols-1 gap-2">
                    <div className="deco-frame border-border-gold-muted bg-deco-card p-3 text-center">
                      <p className="text-xs uppercase tracking-[0.12em] text-deco-muted">
                        Jobs
                      </p>
                      <p className="mt-1 font-heading text-2xl text-deco-foreground">
                        {historySummary.totalJobs}
                      </p>
                    </div>
                    <div className="deco-frame border-border-gold-muted bg-deco-card p-3 text-center">
                      <p className="text-xs uppercase tracking-[0.12em] text-deco-muted">
                        Completed
                      </p>
                      <p className="mt-1 font-heading text-2xl text-deco-foreground">
                        {historySummary.completedJobs}
                      </p>
                    </div>
                    <div className="deco-frame border-border-gold-muted bg-deco-card p-3 text-center">
                      <p className="text-xs uppercase tracking-[0.12em] text-deco-muted">
                        New found
                      </p>
                      <p className="mt-1 font-heading text-2xl text-deco-foreground">
                        {formatCount(historySummary.lastSuccessfulResultCount)}
                      </p>
                    </div>
                    <div className="deco-frame border-border-gold-muted bg-deco-card p-3 text-center">
                      <p className="text-xs uppercase tracking-[0.12em] text-deco-muted">
                        Imported
                      </p>
                      <p className="mt-1 font-heading text-2xl text-deco-foreground">
                        {formatCount(historySummary.totalImportedJobs)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 border-t border-border-gold-muted pt-4 text-sm text-deco-muted">
                    <p>Last scraped: {formatTimestamp(historySummary.lastScrapedAt)}</p>
                    <p>
                      Last successful scrape:{" "}
                      {formatTimestamp(historySummary.lastSuccessfulScrapedAt)}
                    </p>
                    <p>
                      Latest results found:{" "}
                      {formatCount(historySummary.lastSuccessfulResultCount)}
                    </p>
                    <p>
                      New jobs imported:{" "}
                      {formatCount(historySummary.lastSuccessfulImportedCount)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="deco-frame mt-4 border-border-gold-muted bg-deco-card px-4 py-3 text-sm text-deco-muted">
                  Scrape history will appear here after a run completes.
                </div>
              )}
            </section>
          </aside>

          <section className="flex min-h-0 flex-col gap-4">
            <Card className="border-border-gold bg-deco-surface-soft shadow-deco-panel">
              <CardHeader className="border-b border-primary-gold-muted bg-primary-gold-muted">
                <CardTitle className="mt-1">{title}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 pt-6">
                {activeJobLoading && routeJobId && !job ? (
                  <div className="deco-frame flex items-center gap-3 border-border-gold-muted bg-deco-card px-4 py-3 text-deco-muted">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Loading scrape status...
                  </div>
                ) : null}

                {activeJobError ? (
                  <p className="deco-frame border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
                    {activeJobError}
                  </p>
                ) : null}

                {errorMessage ? (
                  <p className="deco-frame border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
                    {errorMessage}
                  </p>
                ) : null}

                {job ? (
                  <div className="grid gap-4">
                    <div className="deco-frame border-border-gold-muted bg-deco-surface px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-gold">
                        Status
                      </p>
                      <p className="mt-1 font-heading text-2xl text-deco-foreground">
                        {job.status.replace(/_/g, " ")}
                      </p>
                      {job.message ? (
                        <p className="mt-2 text-sm text-deco-muted">{job.message}</p>
                      ) : null}
                    </div>

                    {job.status === ScrapeJobStatus.Queued ||
                    job.status === ScrapeJobStatus.Running ? (
                      <div className="deco-frame border-border-gold-muted bg-deco-surface-soft px-4 py-3">
                        <p className="text-sm text-deco-muted">
                          {job.status === ScrapeJobStatus.Queued
                            ? "Waiting for the scraper worker to start."
                            : "Collecting jobs from HiringCafe now."}
                        </p>
                      </div>
                    ) : null}

                    {showProgressCard ? (
                      <div className="deco-frame border-border-gold-muted bg-deco-surface px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-gold">
                            Activity
                          </p>
                          <p className="text-xs uppercase tracking-[0.12em] text-deco-muted">
                            {progressPercent !== null
                              ? `${Math.round(progressPercent)}%`
                              : job.status === ScrapeJobStatus.Running
                                ? "Updating"
                                : "Pending"}
                          </p>
                        </div>

                        {progressPercent !== null || isIndeterminateProgress ? (
                          <div className="mt-3 h-2 overflow-hidden border border-border-gold-muted bg-deco-surface-soft">
                            {progressPercent !== null ? (
                              <div
                                className="h-full bg-primary-gold"
                                style={{
                                  width: `${Math.max(0, Math.min(100, progressPercent))}%`,
                                }}
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
                          {job.status === ScrapeJobStatus.Done && finalResultCountText ? (
                            <p className="sm:col-span-2">{finalResultCountText}</p>
                          ) : null}
                          {progress?.message ? (
                            <p className="text-deco-muted sm:col-span-2">{progress.message}</p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {job.status === ScrapeJobStatus.NeedsVerification ||
                    job.status === ScrapeJobStatus.Verifying ? (
                      <div className="deco-frame border-border-gold-muted bg-deco-surface-soft px-4 py-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-sm text-deco-foreground">
                              Open the verification browser session, clear the challenge, then mark
                              it complete.
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-deco-muted">
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

                    {job.status === ScrapeJobStatus.Done ? (
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
                          setScoutTourView("evaluate");
                          navigate("/#scout");
                        }}
                          type="button"
                          variant="outline"
                        >
                          <ArrowRight className="h-4 w-4" />
                          Open Scout queue
                        </Button>
                        <Button onClick={() => navigate("/scrape")} type="button" variant="ghost">
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
                            <p className="font-semibold uppercase tracking-[0.12em]">
                              Scrape failed
                            </p>
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
                      <Button onClick={() => navigate("/scrape")} type="button" variant="outline">
                        <ArrowLeft className="h-4 w-4" />
                        Back to setup
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form className="grid gap-4" onSubmit={handleSubmit}>
                    <div className="grid gap-2">
                      <label className="text-sm font-semibold uppercase tracking-[0.12em] text-deco-muted">
                        HiringCafe URL
                      </label>
                      <Input
                        required
                        className="border-border-gold-muted focus-visible:ring-primary-gold"
                        onChange={(event) => setUrl(event.target.value)}
                        placeholder="https://hiring.cafe/?searchState=..."
                        type="url"
                        value={url}
                      />
                    </div>

                    <label className="flex items-center gap-3 text-sm text-deco-foreground">
                      <input
                        checked={includeSeen}
                        className="h-4 w-4 accent-[var(--color-primary)]"
                        onChange={(event) => setIncludeSeen(event.target.checked)}
                        type="checkbox"
                      />
                      Include previously seen jobs
                    </label>

                    <div className="flex flex-wrap gap-3">
                      <Button disabled={loading} type="submit">
                        {loading ? "Starting..." : "Start scrape"}
                      </Button>
                      <Button asChild type="button" variant="outline">
                        <a href="https://hiring.cafe" rel="noreferrer" target="_blank">
                          <ExternalLink className="h-4 w-4" />
                          Go to hiring.cafe
                        </a>
                      </Button>
                      <Button onClick={() => navigate("/")} type="button" variant="outline">
                        Back to board
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="deco-frame-thick border-border-gold bg-deco-bg/78 p-4 shadow-deco-panel backdrop-blur-md sm:p-6">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-gold">
                      HiringCafe Guide
                    </p>
                    <h3 className="font-heading text-2xl text-deco-foreground">
                      What is hiring.cafe?
                    </h3>
                    <p className="text-sm leading-6 text-deco-muted sm:text-sm">
                      hiring.cafe is a job aggregator that collects postings from hundreds of
                      sources worldwide and provides structured search with precise filters - by
                      keyword, seniority, location, workplace type, and more. Unlike LinkedIn or
                      Indeed, keyword searches on hiring.cafe return exact matches, making it
                      significantly more reliable for specific tech stacks like .NET, C#, or
                      ASP.NET.
                    </p>
                  </div>

                  <div className="grid gap-2 border-t border-primary-gold-muted pt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-gold">
                      Why do we use it?
                    </p>
                    <p className="text-sm leading-6 text-deco-muted sm:text-sm">
                      Most job portals have poor keyword matching and make it difficult to apply
                      directly on company websites. hiring.cafe provides direct apply links to the
                      original job posting, so you skip the middleman and apply where it matters.
                    </p>
                  </div>
                </div>
              </section>

              <section className="deco-frame-thick border-border-gold bg-deco-bg/78 p-4 shadow-deco-panel backdrop-blur-md sm:p-6">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-gold">
                      Scout Flow
                    </p>
                    <h3 className="font-heading text-2xl text-deco-foreground">
                      How the Scout works
                    </h3>
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
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ScrapePage;
