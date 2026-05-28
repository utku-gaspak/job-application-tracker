import { createAuthenticatedClient } from "./client";
import type {
  JobApplication,
  JobApplicationCreateInput,
  JobApplicationUpdateInput,
} from "../types";

const jobApplicationsApi = createAuthenticatedClient("/api/jobapplications");

export const listJobApplications = async () => {
  const response = await jobApplicationsApi.get<JobApplication[]>("");
  return response.data;
};

export const createJobApplication = async (input: JobApplicationCreateInput) => {
  const response = await jobApplicationsApi.post<JobApplication>("", {
    companyName: input.companyName,
    position: input.position,
    jobUrl: input.jobUrl,
    location: input.location,
    salaryRange: input.salaryRange,
    jobDescription: input.jobDescription,
    notes: input.notes,
    interestLevel: input.interestLevel,
    technicalStack: input.technicalStack,
    status: input.status,
  });

  return response.data;
};

export const updateJobApplication = async (
  id: string,
  input: JobApplicationUpdateInput,
) => {
  await jobApplicationsApi.put(`/${id}`, {
    companyName: input.companyName,
    position: input.position,
    jobUrl: input.jobUrl,
    location: input.location,
    salaryRange: input.salaryRange,
    jobDescription: input.jobDescription,
    notes: input.notes,
    interestLevel: input.interestLevel,
    technicalStack: input.technicalStack,
    status: input.status,
    dateApplied: input.dateApplied,
  });
};

export const deleteJobApplication = async (id: string) => {
  await jobApplicationsApi.delete(`/${id}`);
};
