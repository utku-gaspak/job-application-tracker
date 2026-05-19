import axios from "axios";
import { AxiosHeaders } from "axios";
import { notifyAuthTokenCleared } from "../authEvents";
import { finalUrl } from "../baseUrl";
import type {
  ScoutJob,
  ScoutJobCreateInput,
  ScoutJobStateUpdateInput,
  ScoutUploadResult,
} from "../types";

const tokenKey = "token";

const cleanToken = (rawToken: string | null) => {
  if (!rawToken || rawToken === "null" || rawToken === "undefined") {
    return null;
  }

  return rawToken.replace(/['"]+/g, "").replace(/\s/g, "");
};

const scoutJobsApi = axios.create({
  baseURL: `${finalUrl}/api/scout`,
});

scoutJobsApi.interceptors.request.use((config) => {
  const token = cleanToken(localStorage.getItem(tokenKey));

  if (token) {
    const headers =
      config.headers instanceof AxiosHeaders ? config.headers : new AxiosHeaders(config.headers);

    headers.set("Authorization", `Bearer ${token}`);
    config.headers = headers;
  }

  return config;
});

scoutJobsApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem(tokenKey);
      notifyAuthTokenCleared();
    }

    return Promise.reject(error);
  },
);

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

export const deleteScoutJob = async (id: string) => {
  await scoutJobsApi.delete(`/jobs/${id}`);
};

export const deleteAllScoutJobs = async () => {
  await scoutJobsApi.delete("/jobs");
};
