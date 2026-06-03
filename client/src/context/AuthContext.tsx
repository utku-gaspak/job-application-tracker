import { createContext, useEffect, useState, useContext } from "react";
import type { ReactNode } from "react";
import { AUTH_TOKEN_CLEARED_EVENT } from "../authEvents";
import { logout as logoutRequest } from "../api/accountApi";

interface AuthContextType {
  token: string | null;
  username: string | null;
  isLoggedIn: boolean;
  login: (token: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const decodeJwtPayload = (token: string) => {
  try {
    const [, payload] = token.split(".");

    if (!payload) {
      return null;
    }

    // JWT payloads are base64url-encoded, so normalize them before decoding in the browser.
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "=",
    );

    return JSON.parse(window.atob(paddedPayload)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const getUsernameFromToken = (token: string | null) => {
  if (!token) {
    return null;
  }

  const payload = decodeJwtPayload(token);
  const usernameCandidate =
    payload?.unique_name ??
    payload?.preferred_username ??
    payload?.username ??
    payload?.given_name ??
    payload?.name;

  return typeof usernameCandidate === "string" && usernameCandidate.trim()
    ? usernameCandidate
    : null;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Read the persisted token during the initial render so auth state survives refreshes.
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));

  useEffect(() => {
    // Interceptors can clear auth without going through this provider, so keep same-tab logout in sync here.
    const handleTokenCleared = () => {
      setToken(null);
    };

    window.addEventListener(AUTH_TOKEN_CLEARED_EVENT, handleTokenCleared);
    return () => {
      window.removeEventListener(AUTH_TOKEN_CLEARED_EVENT, handleTokenCleared);
    };
  }, []);

  const login = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem("token", newToken);
  };

  const logout = async () => {
    const currentToken = token;
    if (currentToken) {
      try {
        await logoutRequest(currentToken);
      } catch {
        // Logout should still clear the local session even if server cleanup fails.
      }
    }

    setToken(null);
    localStorage.removeItem("token");
  };

  const value = {
    token,
    username: getUsernameFromToken(token),
    isLoggedIn: !!token,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
