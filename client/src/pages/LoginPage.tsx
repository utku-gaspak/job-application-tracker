import axios from "axios";
import {
  ChevronRight,
  ClipboardCheck,
  Columns3,
  PlayCircle,
  Search,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { login as loginRequest } from "../api/accountApi";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useAuth } from "../context/AuthContext";
import Footer from "../components/Footer";
import OnboardingTour from "../components/OnboardingTour";

const workflowSteps = [
  {
    title: "Find jobs",
    body: "Import job leads from a saved search instead of copying rows by hand.",
    icon: Search,
  },
  {
    title: "Review leads",
    body: "Move quickly through matches and keep only the roles worth applying to.",
    icon: ClipboardCheck,
  },
  {
    title: "Track progress",
    body: "Run every saved application through one visible board.",
    icon: Columns3,
  },
];

const credibilityItems = [
  "React",
  ".NET",
  "PostgreSQL",
  "Auth",
  "Scraping/import workflow",
  "Per-user data",
];

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const { login: storeToken } = useAuth();
  const navigate = useNavigate();

  const submitCredentials = async (
    nextUsername: string,
    nextPassword: string,
  ) => {
    setLoading(true);

    try {
      const authData = await loginRequest({
        username: nextUsername,
        password: nextPassword,
      });

      if (authData && authData.token) {
        storeToken(authData.token);
        navigate("/");
      } else {
        toast.error("Login failed.");
      }
    } catch (error) {
      console.error("Login failed:", error);

      if (axios.isAxiosError(error) && error.response?.status === 401) {
        toast.error("Invalid username or password.");
      } else {
        toast.error("Login failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await submitCredentials(username, password);
  };

  const handleDemoLogin = () => {
    void submitCredentials("demo", "demo123");
  };

  return (
    <main className="flex min-h-screen flex-col px-4 pt-6 md:px-8 md:pt-8">
      <div className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(22rem,0.88fr)] lg:items-center">
        <section className="grid gap-5">
          <div className="deco-frame-thick border-border-gold bg-deco-surface-soft p-5 shadow-deco-panel sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-gold">
              Job search command board
            </p>
            <h1 className="mt-2 font-heading text-4xl tracking-normal text-deco-foreground sm:text-5xl">
              Traxr
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-deco-muted sm:text-lg">
              Import job leads, review them quickly, and track every application
              in one board.
            </p>
            <div className="mt-5 grid gap-2 sm:max-w-sm">
              <Button
                type="button"
                disabled={loading}
                size="lg"
                className="w-full tracking-widest"
                onClick={handleDemoLogin}
              >
                <PlayCircle className="h-5 w-5" />
                TRY LIVE DEMO
              </Button>
              <p className="text-sm leading-6 text-deco-muted">
                No signup required. Opens a seeded job-search board.
              </p>
            </div>
          </div>

          <section
            aria-labelledby="how-it-works"
            className="deco-frame border-border-gold bg-deco-surface p-4 shadow-sm sm:p-5"
          >
            <div className="flex flex-col gap-1 border-b border-primary-gold-muted pb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-gold">
                How it works
              </p>
              <h2
                id="how-it-works"
                className="font-heading text-xl text-deco-foreground"
              >
                From search to tracked applications
              </h2>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {workflowSteps.map(({ title, body, icon: Icon }) => (
                <div
                  className="deco-frame border-border-gold-muted bg-deco-card p-3"
                  key={title}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary-gold bg-primary-gold-muted text-primary-gold">
                      <Icon className="h-4 w-4" />
                    </span>
                    <h3 className="text-sm font-semibold text-deco-foreground">
                      {title}
                    </h3>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-deco-muted">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <OnboardingTour open onClose={() => {}} variant="inline" />
        </section>

        <section className="grid gap-4">
          <Card className="border-border-gold bg-deco-surface-soft">
            <CardHeader className="border-b border-primary-gold-muted bg-primary-gold-muted">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-gold">
                SECURE LOGIN
              </p>
              <CardTitle className="mt-1">Access your board</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form className="grid gap-4" onSubmit={handleSubmit}>
                <div className="grid gap-2">
                  <label className="text-sm font-semibold uppercase tracking-[0.12em] text-deco-muted">
                    Username
                  </label>
                  <Input
                    type="text"
                    placeholder="Username"
                    className="border-border-gold-muted focus-visible:ring-primary-gold"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-semibold uppercase tracking-[0.12em] text-deco-muted">
                    Password
                  </label>
                  <Input
                    type="password"
                    placeholder="Password"
                    className="border-border-gold-muted focus-visible:ring-primary-gold"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  variant="outline"
                  className="mt-2 w-full tracking-widest"
                >
                  {loading ? "Signing in..." : "SIGN IN"}
                </Button>
                <p className="text-sm text-deco-muted">
                  New here?{" "}
                  <Link
                    className="inline-flex items-center gap-1 font-medium text-primary-gold hover:underline"
                    to="/register"
                  >
                    Create your own board
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>

          <div className="deco-frame border-border-gold-muted bg-deco-surface px-4 py-3 text-sm text-deco-muted">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-gold">
              Built with
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {credibilityItems.map((item) => (
                <li
                  className="deco-frame border-border-gold-muted bg-deco-card px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-deco-foreground"
                  key={item}
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
      <Footer />
    </main>
  );
};

export default LoginPage;
