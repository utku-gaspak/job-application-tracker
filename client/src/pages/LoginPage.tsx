import axios from "axios";
import {
  BriefcaseBusiness,
  ChevronRight,
  MoonStar,
  SunMedium,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { useTheme } from "../context/ThemeContext";
import Footer from "../components/Footer";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const { login: storeToken } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const showLoginFailure = () => {
    alert("Login failed.");
  };

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
        showLoginFailure();
      }
    } catch (error) {
      console.error("Login failed:", error);

      if (axios.isAxiosError(error) && error.response?.status === 401) {
        alert("Invalid username or password.");
      } else {
        showLoginFailure();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await submitCredentials(username, password);
  };

  const handleDemoLogin = async () => {
    setUsername("demo");
    setPassword("demo123");
    await submitCredentials("demo", "demo123");
  };

  return (
    <main className="flex min-h-screen flex-col px-4 pt-10 md:px-8 md:pt-10">
      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left Section: Information */}
        <section className="deco-frame border-border-gold-muted bg-deco-surface p-8 shadow-deco-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary-gold">
                Job Application Tracker
              </p>
              <h1 className="max-w-[12ch] text-5xl leading-[0.95] text-deco-foreground md:text-6xl">
                Traxr
              </h1>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >
              {theme === "dark" ? (
                <SunMedium className="h-4 w-4" />
              ) : (
                <MoonStar className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="mt-5 max-w-xl text-base text-deco-muted">
            Manage all your application data in one secure and clean interface.
          </p>
          <div className="mt-8 flex items-center gap-4 text-sm uppercase tracking-[0.14em] text-deco-muted">
            <span className="inline-flex items-center gap-2">
              <BriefcaseBusiness className="h-4 w-4 text-primary-gold" />
              APPLY — LOG
            </span>
            <span className="h-px w-8 bg-border-gold" />
            <span>TRACK</span>
          </div>
        </section>

        {/* Right Section: Form */}
        <Card className="border-border-gold bg-deco-surface-soft">
          <CardHeader className="border-b border-primary-gold bg-primary-gold-muted">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-gold">
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
                className="mt-2 w-full tracking-widest"
              >
                {loading ? "Signing in..." : "SIGN IN"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                className="w-full tracking-widest"
                onClick={handleDemoLogin}
              >
                SEE IT IN ACTION
              </Button>
              <p className="text-sm text-deco-muted">
                Need an account?{" "}
                <Link
                  className="inline-flex items-center gap-1 font-medium text-primary-gold hover:underline"
                  to="/register"
                >
                  Create one now
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </main>
  );
};

export default LoginPage;
