import axios, { AxiosHeaders } from "axios";
import { notifyAuthTokenCleared } from "../authEvents";
import { finalUrl } from "../baseUrl";

const TOKEN_KEY = "token";

const cleanToken = (rawToken: string | null) => {
  if (!rawToken || rawToken === "null" || rawToken === "undefined") {
    return null;
  }

  return rawToken.replace(/['"]+/g, "").replace(/\s/g, "");
};

export const createAuthenticatedClient = (basePath: string) => {
  const client = axios.create({
    baseURL: `${finalUrl}${basePath}`,
    headers: {
      "Content-Type": "application/json",
    },
  });

  client.interceptors.request.use((config) => {
    const token = cleanToken(localStorage.getItem(TOKEN_KEY));

    if (token) {
      const headers =
        config.headers instanceof AxiosHeaders
          ? config.headers
          : new AxiosHeaders(config.headers);

      headers.set("Authorization", `Bearer ${token}`);
      config.headers = headers;
    }

    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        notifyAuthTokenCleared();
      }

      return Promise.reject(error);
    },
  );

  return client;
};
