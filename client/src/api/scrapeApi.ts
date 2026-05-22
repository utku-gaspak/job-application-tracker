import axios from "axios";
import { AxiosHeaders } from "axios";
import { notifyAuthTokenCleared } from "../authEvents";
import { finalUrl } from "../baseUrl";
import type {
  ScrapeJobCreateInput,
  ScrapeHistorySummary,
  ScrapeJobStatusResponse,
} from "../types";

const tokenKey = "token";

const cleanToken = (rawToken: string | null) => {
  if (!rawToken || rawToken === "null" || rawToken === "undefined") {
    return null;
  }

  return rawToken.replace(/['"]+/g, "").replace(/\s/g, "");
};

const scrapeApi = axios.create({
  baseURL: `${finalUrl}/api/scrape`,
  headers: {
    "Content-Type": "application/json",
  },
});

scrapeApi.interceptors.request.use((config) => {
  const token = cleanToken(localStorage.getItem(tokenKey));

  if (token) {
    const headers =
      config.headers instanceof AxiosHeaders ? config.headers : new AxiosHeaders(config.headers);

    headers.set("Authorization", `Bearer ${token}`);
    config.headers = headers;
  }

  return config;
});

scrapeApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem(tokenKey);
      notifyAuthTokenCleared();
    }

    return Promise.reject(error);
  },
);

export const createScrapeJob = async (input: ScrapeJobCreateInput) => {
  const response = await scrapeApi.post<ScrapeJobStatusResponse>("", input);
  return response.data;
};

export const getScrapeJob = async (jobId: string) => {
  const response = await scrapeApi.get<ScrapeJobStatusResponse>(`/${jobId}`);
  return response.data;
};

export const getScrapeHistorySummary = async () => {
  const response = await scrapeApi.get<ScrapeHistorySummary>("/history");
  return response.data;
};

export const completeScrapeVerification = async (jobId: string) => {
  const response = await scrapeApi.post<ScrapeJobStatusResponse>(
    `/${jobId}/verification-complete`,
  );
  return response.data;
};

export const startScrapeVerification = async (jobId: string) => {
  const response = await scrapeApi.post<ScrapeJobStatusResponse>(
    `/${jobId}/verification-started`,
  );
  return response.data;
};

export const downloadScrapeJson = async (jobId: string) => {
  const response = await scrapeApi.get<Blob>(`/${jobId}/jobs.json`, {
    responseType: "blob",
  });
  return response.data;
};

export const downloadScrapeMarkdown = async (jobId: string) => {
  const response = await scrapeApi.get<Blob>(`/${jobId}/jobs.md`, {
    responseType: "blob",
  });
  return response.data;
};
