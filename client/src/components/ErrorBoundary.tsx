import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <AlertTriangle className="h-10 w-10 text-danger" />
          <h1 className="font-heading text-2xl text-deco-foreground">
            Something went wrong
          </h1>
          <p className="max-w-md text-sm text-deco-muted">
            An unexpected error occurred. Try refreshing the page.
          </p>
          <Button
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
            type="button"
          >
            Reload page
          </Button>
        </main>
      );
    }

    return this.props.children;
  }
}
