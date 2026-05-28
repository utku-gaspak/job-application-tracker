import { ArrowLeft } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { register } from "../api/accountApi";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

const RegisterPage = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      await register({
        username,
        email,
        password,
      });

      toast.success("Registration successful. You can sign in now.");
      navigate("/login");
    } catch (error) {
      console.error("Registration failed:", error);
      toast.error("Registration failed. Check your details and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-10 md:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-2xl items-center">
        <Card className="w-full border-border-gold bg-deco-surface-soft">
          <CardHeader className="border-b border-primary-gold bg-primary-gold-muted">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-gold">
              New Account
            </p>
            <CardTitle>Create Account</CardTitle>
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
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-semibold uppercase tracking-[0.12em] text-deco-muted">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={loading} variant="accent" className="mt-2 w-full">
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            <p className="mt-5 text-sm text-deco-muted">
              Already have an account?{" "}
              <Link className="inline-flex items-center gap-1 text-primary-gold" to="/login">
                <ArrowLeft className="h-3.5 w-3.5" />
                Sign In
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default RegisterPage;
