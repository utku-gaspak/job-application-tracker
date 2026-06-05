import { createAuthenticatedClient } from "./client";
import type {
  JobApplication,
  ScoutJob,
  ScoutJobCreateInput,
  ScoutJobStateUpdateInput,
  ScoutUploadResult,
} from "../types";

const scoutJobsApi = createAuthenticatedClient("/api/scout");

export const uploadScoutJobs = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await scoutJobsApi.post<ScoutUploadResult>("/upload", formData);
  return response.data;
};

export const createScoutJob = async (input: ScoutJobCreateInput) => {
  const response = await scoutJobsApi.post<ScoutJob>("/jobs", input);
  return response.data;
};

export const applyScoutJob = async (id: string) => {
  const response = await scoutJobsApi.post<JobApplication>(`/jobs/${id}/apply`);
  return response.data;
};

export const updateScoutJobState = async (
  id: string,
  input: ScoutJobStateUpdateInput,
) => {
  const response = await scoutJobsApi.patch<ScoutJob>(`/jobs/${id}`, input);
  return response.data;
};

export const listScoutJobs = async () => {
  const response = await scoutJobsApi.get<ScoutJob[]>("/jobs");
  return response.data;
};

export const exportScoutJobs = async () => {
  return exportScoutJobsAs("json");
};

export const exportScoutJobsAs = async (format: "json" | "csv") => {
  const response = await scoutJobsApi.get<Blob>("/jobs/export", {
    params: { format },
    responseType: "blob",
  });

  return response.data;
};

export const deleteScoutJob = async (id: string) => {
  await scoutJobsApi.delete(`/jobs/${id}`);
};

export const deleteAllScoutJobs = async () => {
  await scoutJobsApi.delete("/jobs");
};
