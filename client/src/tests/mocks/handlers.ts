import { http, HttpResponse } from 'msw'
import { finalUrl } from '../../baseUrl'
import { JobApplicationStatus, type JobApplication } from '../../types'

interface LoginRequestBody {
  username: string
  password: string
}

interface CreateJobApplicationBody {
  companyName: string
  position: string
  jobUrl?: string | null
  location?: string | null
  salaryRange?: string | null
  jobDescription?: string | null
  notes?: string | null
  interestLevel?: number | null
  technicalStack?: string | null
  status: JobApplicationStatus
}

interface MockApiState {
  loginRequests: LoginRequestBody[]
  createJobApplicationRequests: CreateJobApplicationBody[]
  updateJobApplicationRequests: Array<{ id: string; body: CreateJobApplicationBody & { dateApplied: string } }>
  deleteJobApplicationRequests: string[]
  jobApplications: JobApplication[]
}

const defaultJobs: JobApplication[] = [
  {
    id: 'job-1',
    companyName: 'Acme',
    position: 'Backend Engineer',
    jobUrl: 'https://example.com/jobs/acme-backend',
    location: 'Remote',
    salaryRange: '$110k - $130k',
    jobDescription: 'Strong backend role working on distributed systems.',
    interestLevel: 5,
    technicalStack: 'C#, PostgreSQL, React',
    status: JobApplicationStatus.Applied,
    dateApplied: '2026-05-11T12:00:00.000Z',
    userId: 'user-1',
  },
  {
    id: 'job-2',
    companyName: 'Globex',
    position: 'Platform Engineer',
    jobUrl: null,
    location: 'London',
    salaryRange: null,
    jobDescription: null,
    interestLevel: null,
    technicalStack: null,
    status: JobApplicationStatus.Interviewing,
    dateApplied: '2026-05-10T12:00:00.000Z',
    userId: 'user-1',
  },
]

export const mockApiState: MockApiState = {
  loginRequests: [],
  createJobApplicationRequests: [],
  updateJobApplicationRequests: [],
  deleteJobApplicationRequests: [],
  jobApplications: [...defaultJobs],
}

export const resetMockApiState = () => {
  mockApiState.loginRequests = []
  mockApiState.createJobApplicationRequests = []
  mockApiState.updateJobApplicationRequests = []
  mockApiState.deleteJobApplicationRequests = []
  mockApiState.jobApplications = [...defaultJobs]
}

export const handlers = [
  http.post(`${finalUrl}/api/account/login`, async ({ request }) => {
    const body = (await request.json()) as LoginRequestBody
    mockApiState.loginRequests.push(body)

    return HttpResponse.json({
      token: 'test-jwt-token',
      userName: body.username,
      email: `${body.username}@example.com`,
    })
  }),

  http.get(`${finalUrl}/api/jobapplications`, () => {
    return HttpResponse.json(mockApiState.jobApplications)
  }),

  http.post(`${finalUrl}/api/jobapplications`, async ({ request }) => {
    const body = (await request.json()) as CreateJobApplicationBody
    mockApiState.createJobApplicationRequests.push(body)

    const createdApplication: JobApplication = {
      id: `job-${mockApiState.jobApplications.length + 1}`,
      companyName: body.companyName,
      position: body.position,
      jobUrl: body.jobUrl ?? null,
      location: body.location ?? null,
      salaryRange: body.salaryRange ?? null,
      jobDescription: body.jobDescription ?? null,
      notes: body.notes ?? null,
      interestLevel: body.interestLevel ?? null,
      technicalStack: body.technicalStack ?? null,
      status: body.status,
      dateApplied: '2026-05-12T12:00:00.000Z',
      userId: 'user-1',
    }

    mockApiState.jobApplications = [createdApplication, ...mockApiState.jobApplications]
    return HttpResponse.json(createdApplication, { status: 201 })
  }),

  http.put(`${finalUrl}/api/jobapplications/:id`, async ({ params, request }) => {
    const body = (await request.json()) as CreateJobApplicationBody & { dateApplied: string }
    const id = String(params.id)

    mockApiState.updateJobApplicationRequests.push({ id, body })
    mockApiState.jobApplications = mockApiState.jobApplications.map((application) =>
      application.id === id
        ? {
            ...application,
            companyName: body.companyName,
            position: body.position,
            jobUrl: body.jobUrl ?? null,
            location: body.location ?? null,
            salaryRange: body.salaryRange ?? null,
            jobDescription: body.jobDescription ?? null,
            notes: body.notes ?? null,
            interestLevel: body.interestLevel ?? null,
            technicalStack: body.technicalStack ?? null,
            status: body.status,
            dateApplied: body.dateApplied,
          }
        : application,
    )

    return HttpResponse.json(null, { status: 204 })
  }),

  http.get(`${finalUrl}/api/scout/jobs`, () => {
    return HttpResponse.json([])
  }),

  http.get(`${finalUrl}/api/scrape/history`, () => {
    return HttpResponse.json({
      totalJobs: 5,
      completedJobs: 3,
      failedJobs: 1,
      runningJobs: 1,
      queuedJobs: 0,
      lastScrapedAt: '2026-06-01T12:00:00.000Z',
      lastSuccessfulScrapedAt: '2026-06-01T10:00:00.000Z',
      lastSuccessfulResultCount: 42,
      lastSuccessfulImportedCount: 38,
      totalResultsFound: 150,
      totalImportedJobs: 120,
      recentJobs: [],
    })
  }),

  http.delete(`${finalUrl}/api/jobapplications/:id`, ({ params }) => {
    const id = String(params.id)

    mockApiState.deleteJobApplicationRequests.push(id)
    mockApiState.jobApplications = mockApiState.jobApplications.filter(
      (application) => application.id !== id,
    )

    return HttpResponse.json(null, { status: 204 })
  }),
]
