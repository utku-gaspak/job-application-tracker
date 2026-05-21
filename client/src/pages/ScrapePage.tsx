import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { createScrapeJob } from "../api/scrapeApi";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

const ScrapePage = () => {
  const [url, setUrl] = useState("");
  const [includeSeen, setIncludeSeen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();

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

  return (
    <main className="mx-auto flex min-h-[calc(100dvh/var(--ui-scale))] w-full max-w-4xl flex-col px-4 py-4">
      <Card className="border-border-gold bg-deco-surface-soft shadow-deco-panel">
        <CardHeader className="border-b border-primary-gold-muted bg-primary-gold-muted">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-gold">
            HiringCafe Scrape
          </p>
          <CardTitle className="mt-1">Start a new scrape job</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6">
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

            {errorMessage ? (
              <p className="deco-frame border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
                {errorMessage}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button disabled={loading} type="submit">
                {loading ? "Starting..." : "Start scrape"}
              </Button>
              <Button onClick={() => navigate("/")} type="button" variant="outline">
                Back to board
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
};

export default ScrapePage;
