import { createAuthenticatedClient } from "./client";
import type {
  ScrapeJobCreateInput,
  ScrapeHistorySummary,
  ScrapeJobStatusResponse,
} from "../types";

const scrapeApi = createAuthenticatedClient("/api/scrape");

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

export interface ScrapePreset {
  id: string;
  name: string;
  sourceUrl: string;
  createdAt: string;
}

export const listScrapePresets = async () => {
  const response = await scrapeApi.get<ScrapePreset[]>("/presets");
  return response.data;
};

export const createScrapePreset = async (input: { name: string; sourceUrl: string }) => {
  const response = await scrapeApi.post<ScrapePreset>("/presets", input);
  return response.data;
};

export const deleteScrapePreset = async (id: string) => {
  await scrapeApi.delete(`/presets/${id}`);
};
