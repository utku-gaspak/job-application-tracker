import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ExternalLink, LoaderCircle, ArrowLeft, CircleCheck } from "lucide-react";
import {
  completeScrapeVerification,
  getScrapeJob,
  startScrapeVerification,
} from "../api/scrapeApi";
import { ScrapeJobStatus as ScrapeStatus, type ScrapeJobStatusResponse } from "../types";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

const verifyBaseUrl = import.meta.env.VITE_SCRAPER_VERIFY_BASE_URL as
  | string
  | undefined;

const ScrapeVerifyPage = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<ScrapeJobStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sessionUrl = useMemo(() => {
    if (!verifyBaseUrl || !jobId) {
      return null;
    }

    return verifyBaseUrl;
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setErrorMessage("Scrape job id is missing.");
      setLoading(false);
      return;
    }

    let active = true;

    const loadJob = async () => {
      try {
        const nextJob = await getScrapeJob(jobId);
        if (!active) {
          return;
        }

        setJob(nextJob);
        setErrorMessage(null);
      } catch (loadError) {
        console.error("Could not load verification job:", loadError);
        if (active) {
          setErrorMessage("Could not load the verification job.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadJob();

    return () => {
      active = false;
    };
  }, [jobId]);

  const handleOpenSession = async () => {
    if (!sessionUrl) {
      setErrorMessage("No verification browser URL is configured.");
      return;
    }

    if (jobId && job?.status === ScrapeStatus.NeedsVerification) {
      try {
        const nextJob = await startScrapeVerification(jobId);
        setJob(nextJob);
        setErrorMessage(null);
      } catch (startError) {
        console.error("Could not mark verification started:", startError);
        setErrorMessage("Could not start the verification session.");
        return;
      }
    }

    window.open(sessionUrl, "_blank", "noopener,noreferrer");
  };

  const handleCompleteVerification = async () => {
    if (!jobId) {
      return;
    }

    setSaving(true);

    try {
      await completeScrapeVerification(jobId);
      navigate(`/scrape/${jobId}`);
    } catch (completeError) {
      console.error("Could not complete verification:", completeError);
      setErrorMessage("Could not mark verification complete.");
    } finally {
      setSaving(false);
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
              <CardTitle className="mt-1">Verification session</CardTitle>
            </div>
            <Button onClick={() => navigate(`/scrape/${jobId ?? ""}`)} type="button" variant="outline">
              <ArrowLeft className="h-4 w-4" />
              Back to status
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 pt-6">
          {loading && !job ? (
            <div className="deco-frame flex items-center gap-3 border-border-gold-muted bg-deco-card px-4 py-3 text-deco-muted">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading verification status...
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
                  Current status
                </p>
                <p className="mt-1 font-heading text-2xl text-deco-foreground">
                  {job.status.replace(/_/g, " ")}
                </p>
                <p className="mt-2 text-sm text-deco-muted">
                  Open the browser session, clear the challenge, then come back here and mark
                  it complete.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  className="w-full sm:w-auto"
                  disabled={!sessionUrl}
                  onClick={() => void handleOpenSession()}
                  type="button"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open verification session
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  disabled={
                    saving
                    || (
                      job.status !== ScrapeStatus.NeedsVerification
                      && job.status !== ScrapeStatus.Verifying
                    )
                  }
                  onClick={() => void handleCompleteVerification()}
                  type="button"
                  variant="outline"
                >
                  <CircleCheck className="h-4 w-4" />
                  {saving ? "Saving..." : "Mark verification complete"}
                </Button>
              </div>

              {!sessionUrl ? (
                <div className="deco-frame border-border-gold-muted bg-deco-surface-soft px-4 py-3 text-sm text-deco-muted">
                  Set <code className="font-mono text-primary-gold">VITE_SCRAPER_VERIFY_BASE_URL</code>{" "}
                  to the remote browser URL before using this page.
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => navigate(`/scrape/${jobId ?? ""}`)} type="button" variant="ghost">
                  <ArrowLeft className="h-4 w-4" />
                  Back to job status
                </Button>
                <Button asChild type="button" variant="outline">
                  <Link to="/">Back to board</Link>
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
};

export default ScrapeVerifyPage;
