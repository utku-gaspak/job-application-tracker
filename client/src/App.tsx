import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuth } from "./context/AuthContext";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const Dashboard = lazy(() => import("./components/Dashboard"));

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
};

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-deco-bg px-6 text-sm text-deco-muted">
    Loading...
  </div>
);

function App() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            className:
              "deco-frame border-primary-gold bg-deco-card text-deco-foreground shadow-lg",
            descriptionClassName: "text-deco-muted",
          }}
        />
        <Suspense fallback={<RouteFallback />}>
          <div className="flex-1">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              {/* Keep unknown routes flowing through the protected root instead of rendering a dead end. */}
              <Route path="*" element={<Navigate to="/" replace />} />
              <Route path="/register" element={<RegisterPage />} />
            </Routes>
          </div>
        </Suspense>
      </BrowserRouter>
    </div>
  );
}

export default App;
