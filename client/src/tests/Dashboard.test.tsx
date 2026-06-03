import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import Dashboard from '../components/Dashboard'
import OnboardingTour from '../components/OnboardingTour'
import { AuthProvider } from '../context/AuthContext'
import { ThemeProvider } from '../context/ThemeContext'
import { WorkflowProvider } from '../context/WorkflowContext'
import { JobApplicationStatus, type ScoutJob } from '../types'
import { mockApiState } from './mocks/handlers'
import { server } from './mocks/server'
import { finalUrl } from '../baseUrl'

const renderDashboard = (initialHash = '') => {
  localStorage.setItem('token', 'test-jwt-token')
  window.location.hash = initialHash

  return render(
    <ThemeProvider>
      <AuthProvider>
        <MemoryRouter>
          <WorkflowProvider>
            <Dashboard />
          </WorkflowProvider>
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>,
  )
}

describe('Dashboard', () => {
  it('Dashboard_LoadApplications_RendersTwoJobCards', async () => {
    const { container } = renderDashboard()

    // Cards render in both mobile accordion and desktop kanban — check they exist.
    expect(await screen.findAllByText('Acme')).toHaveLength(2)
    // Globex has Interviewing status — mobile accordion for Interviewing is collapsed by default,
    // so it only appears once (desktop).
    expect(screen.getByText('Globex')).toBeInTheDocument()

    await waitFor(() => {
      // Acme appears in both mobile and desktop, Globex only in desktop (Interviewing collapsed on mobile).
      expect(
        container.querySelectorAll('article.application-card').length,
      ).toBeGreaterThanOrEqual(2)
    })
  })

  it('Dashboard_SortToggle_SortsApplicationsByDateAcrossColumns', async () => {
    mockApiState.jobApplications = [
      {
        id: 'job-1',
        companyName: 'Oldest Co',
        position: 'Backend Engineer',
        jobUrl: null,
        location: null,
        salaryRange: null,
        jobDescription: null,
        notes: null,
        interestLevel: 3,
        technicalStack: null,
        status: JobApplicationStatus.Applied,
        dateApplied: '2026-05-01T12:00:00.000Z',
        userId: 'user-1',
      },
      {
        id: 'job-2',
        companyName: 'Newest Co',
        position: 'Frontend Engineer',
        jobUrl: null,
        location: null,
        salaryRange: null,
        jobDescription: null,
        notes: null,
        interestLevel: 4,
        technicalStack: null,
        status: JobApplicationStatus.Applied,
        dateApplied: '2026-05-12T12:00:00.000Z',
        userId: 'user-1',
      },
    ]

    const { container } = renderDashboard()

    await screen.findAllByText('Newest Co')

    // Scope to the desktop kanban board to avoid mobile duplicates.
    const desktopBoard = container.querySelector('[data-tour-id="tracker-board"]')!
    const appliedCards = () =>
      desktopBoard.querySelectorAll('#column-applied article.application-card')

    // Cards render in API response order initially.
    expect(appliedCards()).toHaveLength(2)

    // Click sort toggle — currently "Newest first", clicking switches to "Oldest first".
    fireEvent.click(screen.getByRole('button', { name: 'Newest first' }))

    await waitFor(() => {
      const sorted = appliedCards()
      expect(sorted[0]).toHaveTextContent('Oldest Co')
      expect(sorted[1]).toHaveTextContent('Newest Co')
      expect(
        screen.getByRole('button', { name: 'Oldest first' }),
      ).toBeInTheDocument()
    })
  })

  it('Dashboard_ThemeToggle_SwitchesThemeMode', async () => {
    const { container } = renderDashboard()

    expect(await screen.findAllByText('Acme')).toHaveLength(2)
    expect(document.documentElement).not.toHaveClass('dark')

    fireEvent.click(
      screen.getByRole('button', { name: 'Switch to dark mode' }),
    )

    await waitFor(() => {
      expect(document.documentElement).toHaveClass('dark')
      expect(
        screen.getByRole('button', { name: 'Switch to light mode' }),
      ).toBeInTheDocument()
      expect(
        container.querySelectorAll('article.application-card').length,
      ).toBeGreaterThanOrEqual(2)
    })
  })

  it('Dashboard_FiltersApplications_BySearchStatusAndInterest', async () => {
    const { container } = renderDashboard()

    expect(await screen.findAllByText('Acme')).toHaveLength(2)
    expect(screen.getByText('Globex')).toBeInTheDocument()

    // Open the filter panel
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }))

    // Filter by search term
    fireEvent.change(screen.getByLabelText('Search applications'), {
      target: { value: 'acme' },
    })

    // Filter by status
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter status' }), {
      target: { value: String(JobApplicationStatus.Applied) },
    })

    await waitFor(() => {
      expect(screen.queryByText('Globex')).not.toBeInTheDocument()
      // Acme renders in both mobile and desktop views.
      expect(
        container.querySelectorAll('article.application-card').length,
      ).toBeGreaterThanOrEqual(1)
    })
  })

  it('Dashboard_SkillTransfer_FiltersBySelectedSkillAndCanClearAll', async () => {
    const { container } = renderDashboard()

    expect(await screen.findAllByText('Acme')).toHaveLength(2)
    expect(screen.getByText('Globex')).toBeInTheDocument()

    // Open the filter panel
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }))

    // Click "Add C#" from available skills
    fireEvent.click(screen.getByRole('button', { name: 'Add C#' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Remove C#' })).toBeInTheDocument()
      expect(screen.queryByText('Globex')).not.toBeInTheDocument()
      expect(
        container.querySelectorAll('article.application-card').length,
      ).toBeGreaterThanOrEqual(1)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Clear All' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add C#' })).toBeInTheDocument()
      expect(screen.getByText('Globex')).toBeInTheDocument()
      expect(
        container.querySelectorAll('article.application-card').length,
      ).toBeGreaterThanOrEqual(2)
    })
  })

  it('Dashboard_FilterPanel_DefaultsToCollapsed', async () => {
    renderDashboard()

    expect(await screen.findAllByText('Acme')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /Filters/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('Dashboard_SlowLoad_ShowsSpinner', async () => {
    server.use(
      http.get(`${finalUrl}/api/jobapplications`, async () => {
        await delay(150)
        return HttpResponse.json(mockApiState.jobApplications)
      }),
    )

    renderDashboard()

    expect(screen.getByText('Loading applications...')).toBeInTheDocument()
    expect(await screen.findAllByText('Acme')).toHaveLength(2)
  })

  it('Dashboard_LoadUnauthorizedApplications_ShowsErrorMessage', async () => {
    server.use(
      http.get(`${finalUrl}/api/jobapplications`, () =>
        HttpResponse.json(
          { message: 'Unauthorized' },
          { status: 401 },
        ),
      ),
    )

    renderDashboard()

    expect(
      await screen.findByText('Could not load job applications.'),
    ).toBeInTheDocument()
  })

  it('Dashboard_ServerError_ShowsErrorMessage', async () => {
    server.use(
      http.get(`${finalUrl}/api/jobapplications`, () =>
        HttpResponse.json(
          { message: 'Internal Server Error' },
          { status: 500 },
        ),
      ),
    )

    renderDashboard()

    expect(
      await screen.findByText('Something went wrong. Please try again.'),
    ).toBeInTheDocument()
  })

  it('Dashboard_NetworkError_ShowsConnectionMessage', async () => {
    server.use(
      http.get(`${finalUrl}/api/jobapplications`, () => HttpResponse.error()),
    )

    renderDashboard()

    expect(
      await screen.findByText('Could not reach the server. Check your connection and try again.'),
    ).toBeInTheDocument()
  })

  it('JobApplication_Update_UpdatesList', async () => {
    renderDashboard()

    expect(await screen.findAllByText('Acme')).toHaveLength(2)

    // Click the first Acme card to open details
    const acmeCards = screen.getAllByText('Acme')
    fireEvent.click(acmeCards[0]!.closest('article')!)

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Application' }))
    fireEvent.change(screen.getByPlaceholderText('Example: Stripe'), {
      target: { value: 'Acme' },
    })
    fireEvent.change(screen.getByPlaceholderText('Example: Backend Engineer'), {
      target: { value: 'Backend Engineer' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Status' }), {
      target: { value: String(JobApplicationStatus.Offer) },
    })
    // Interest is now a range slider with input
    fireEvent.change(screen.getByRole('slider', { name: 'Interest Level' }), {
      target: { value: '4' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Remove C#' }))
    const technicalStackInput = screen.getByLabelText('Technical Stack')
    fireEvent.change(technicalStackInput, {
      target: { value: '.NET' },
    })
    fireEvent.keyDown(technicalStackInput, { key: 'Enter' })
    expect(technicalStackInput).toHaveValue('')
    expect(screen.getByText('.NET')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => {
      expect(mockApiState.updateJobApplicationRequests).toHaveLength(1)
      expect(mockApiState.updateJobApplicationRequests[0]?.id).toBe('job-1')
      expect(mockApiState.updateJobApplicationRequests[0]?.body.interestLevel).toBe(4)
      expect(mockApiState.updateJobApplicationRequests[0]?.body.technicalStack).toBe('PostgreSQL, React, .NET')
    })
    expect(screen.getAllByText('Offer').length).toBeGreaterThan(0)
  })

  it('JobApplication_Delete_RemovesFromList', async () => {
    const { container } = renderDashboard()

    expect(await screen.findAllByText('Acme')).toHaveLength(2)

    // Click the first Acme card to open details
    const acmeCards = screen.getAllByText('Acme')
    fireEvent.click(acmeCards[0]!.closest('article')!)

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Application' }))
    expect(screen.getByText('Delete application?')).toBeInTheDocument()
    expect(mockApiState.deleteJobApplicationRequests).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(screen.queryByText('Acme')).not.toBeInTheDocument()
      expect(container.querySelectorAll('article.application-card')).toHaveLength(1)
    })
    expect(mockApiState.deleteJobApplicationRequests).toEqual(['job-1'])
  })

  it('Form_InvalidInput_ShowsValidationErrors', async () => {
    renderDashboard()

    expect(await screen.findAllByText('Acme')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'New Application' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Application' }))

    expect(await screen.findByText('Company name is required.')).toBeInTheDocument()
    expect(screen.getByText('Position is required.')).toBeInTheDocument()
    expect(mockApiState.createJobApplicationRequests).toHaveLength(0)
  })

  it('Form_SubmitPending_DisablesButton', async () => {
    server.use(
      http.post(`${finalUrl}/api/jobapplications`, async ({ request }) => {
        const body = await request.json()
        await delay(150)
        return HttpResponse.json(
          {
            id: 'job-3',
            companyName: (body as { companyName: string }).companyName,
            position: (body as { position: string }).position,
            status: (body as { status: JobApplicationStatus }).status,
            dateApplied: '2026-05-12T12:00:00.000Z',
            userId: 'user-1',
          },
          { status: 201 },
        )
      }),
    )

    renderDashboard()

    expect(await screen.findAllByText('Acme')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'New Application' }))

    fireEvent.change(screen.getByPlaceholderText('Example: Stripe'), {
      target: { value: 'Stripe' },
    })
    fireEvent.change(screen.getByPlaceholderText('Example: Backend Engineer'), {
      target: { value: 'Frontend Engineer' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add Application' }))

    const submitButton = screen.getByRole('button', { name: 'Saving...' })
    expect(submitButton).toBeDisabled()

    expect(await screen.findAllByText('Stripe')).toHaveLength(2)
  })

  it('Dashboard_EmptyState_ShowsNoApplicationsMessage', async () => {
    server.use(
      http.get(`${finalUrl}/api/jobapplications`, () => HttpResponse.json([])),
    )

    renderDashboard()

    expect(
      await screen.findByText(
        'No applications yet. Add your first one and it will appear here immediately.',
      ),
    ).toBeInTheDocument()
  })

  describe('Sidebar pipeline', () => {
    it('Sidebar_Pipeline_RendersFourStepsInOrder', async () => {
      renderDashboard()

      expect(await screen.findAllByText('Acme')).toHaveLength(2)

      // Two PipelineBars render (mobile + desktop), both in DOM
      const searchButtons = screen.getAllByRole('button', { name: /Search/ })
      const reviewButtons = screen.getAllByRole('button', { name: /Review/ })
      const applyButtons = screen.getAllByRole('button', { name: /Apply/ })
      const trackButtons = screen.getAllByRole('button', { name: /Track/ })
      expect(searchButtons.length).toBeGreaterThanOrEqual(1)
      expect(reviewButtons.length).toBeGreaterThanOrEqual(1)
      expect(applyButtons.length).toBeGreaterThanOrEqual(1)
      expect(trackButtons.length).toBeGreaterThanOrEqual(1)
      expect(screen.queryByRole('button', { name: /Saved/ })).not.toBeInTheDocument()
    })

    it('Sidebar_Pipeline_StepReview_SwitchesToReviewAndUpdatesHash', async () => {
      renderDashboard()

      expect(await screen.findAllByText('Acme')).toHaveLength(2)

      const reviewButtons = screen.getAllByRole('button', { name: /Review/ })
      fireEvent.click(reviewButtons[0]!)

      await waitFor(() => {
        expect(screen.getByText('No jobs in this pass.')).toBeInTheDocument()
        expect(window.location.hash).toBe('#review')
      })
    })

    it('Sidebar_Pipeline_StepBoard_SwitchesToTrackerAndUpdatesHash', async () => {
      renderDashboard()

      expect(await screen.findAllByText('Acme')).toHaveLength(2)

      const reviewButtons = screen.getAllByRole('button', { name: /Review/ })
      fireEvent.click(reviewButtons[0]!)
      await waitFor(() => {
        expect(screen.getByText('No jobs in this pass.')).toBeInTheDocument()
      })

      const trackButtons = screen.getAllByRole('button', { name: /Track/ })
      fireEvent.click(trackButtons[0]!)

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'New Application' }),
        ).toBeInTheDocument()
        expect(window.location.hash).toBe('#board')
      })
    })

    it('Sidebar_Pipeline_ShowsCounts', async () => {
      renderDashboard()

      expect(await screen.findAllByText('Acme')).toHaveLength(2)

      const trackButtons = screen.getAllByRole('button', { name: /Track/ })
      expect(trackButtons[0]).toHaveAccessibleName(/2 tracking/)
    })

    it('Sidebar_Pipeline_EmptyState_NoCounts', async () => {
      renderDashboard()

      expect(await screen.findAllByText('Acme')).toHaveLength(2)

      const reviewButtons = screen.getAllByRole('button', { name: /Review/ })
      const applyButtons = screen.getAllByRole('button', { name: /Apply/ })
      expect(reviewButtons[0]).not.toHaveAccessibleName(/to review/)
      expect(applyButtons[0]).not.toHaveAccessibleName(/ready/)
    })

    it('Sidebar_Pipeline_AddNewButton_VisibleOnlyInTracker', async () => {
      renderDashboard()

      expect(await screen.findAllByText('Acme')).toHaveLength(2)

      // In tracker mode: Add New is visible
      expect(
        screen.getByRole('button', { name: 'New Application' }),
      ).toBeInTheDocument()

      const reviewButtons = screen.getAllByRole('button', { name: /Review/ })
      fireEvent.click(reviewButtons[0]!)
      await waitFor(() => {
        expect(screen.getByText('No jobs in this pass.')).toBeInTheDocument()
      })

      expect(
        screen.queryByRole('button', { name: 'New Application' }),
      ).not.toBeInTheDocument()
    })

    it('Sidebar_Pipeline_SummarySection_ContextAware', async () => {
      renderDashboard()

      expect(await screen.findAllByText('Acme')).toHaveLength(2)

      expect(screen.getByText('Summary')).toBeInTheDocument()
      expect(
        screen.queryByText('Total Jobs'),
      ).not.toBeInTheDocument()

      const reviewButtons = screen.getAllByRole('button', { name: /Review/ })
      fireEvent.click(reviewButtons[0]!)
      await waitFor(() => {
        expect(screen.getByText('No jobs in this pass.')).toBeInTheDocument()
      })

      expect(screen.getByText('Review Summary')).toBeInTheDocument()
      expect(screen.getByText('To Review')).toBeInTheDocument()
    })

    it('Sidebar_Pipeline_StepNumbersRenderInCircles', async () => {
      renderDashboard()

      expect(await screen.findAllByText('Acme')).toHaveLength(2)

      expect(screen.getAllByRole('button', { name: /Search/ }).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByRole('button', { name: /Review/ }).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByRole('button', { name: /Apply/ }).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByRole('button', { name: /Track/ }).length).toBeGreaterThanOrEqual(1)
      expect(screen.queryByRole('button', { name: /Saved/ })).not.toBeInTheDocument()
    })

    it('Sidebar_Pipeline_LegacyHashes_OpenExpectedSections', async () => {
      const { unmount } = renderDashboard('#scout')

      expect(await screen.findByText('No jobs in this pass.')).toBeInTheDocument()
      expect(screen.getByText('Review Summary')).toBeInTheDocument()

      unmount()
      const tracker = renderDashboard('#tracker')

      expect(await screen.findAllByText('Acme')).toHaveLength(2)
      expect(
        screen.getByRole('button', { name: 'New Application' }),
      ).toBeInTheDocument()

      tracker.unmount()
      renderDashboard('#saved')

      expect(await screen.findByText('Apply Summary')).toBeInTheDocument()
      expect(screen.getByText('Apply to saved jobs')).toBeInTheDocument()
      expect(window.location.hash).toBe('#apply')
    })

    it('ScoutFlow_SaveApplyMarkApplied_StaysApplyAndCanViewBoard', async () => {
      let scoutJobs: ScoutJob[] = [
        {
          id: 'scout-1',
          title: 'Product Engineer',
          company: 'Scoutly',
          location: 'Remote',
          workplaceType: 'Remote',
          commitment: 'Full-time',
          postedAt: '2026-05-31T12:00:00.000Z',
          jobUrl: 'https://example.com/scoutly',
          applyUrl: 'https://example.com/scoutly/apply',
          technicalTools: 'React, TypeScript',
          requirementsSummary: 'Build product workflows.',
          savedForApply: false,
          isDiscarded: false,
          createdAt: '2026-06-01T12:00:00.000Z',
        },
      ]

      server.use(
        http.get(`${finalUrl}/api/scout/jobs`, () => HttpResponse.json(scoutJobs)),
        http.patch(`${finalUrl}/api/scout/jobs/:id`, async ({ params, request }) => {
          const id = String(params.id)
          const body = await request.json() as Pick<ScoutJob, 'savedForApply' | 'isDiscarded'>
          scoutJobs = scoutJobs.map((job) =>
            job.id === id ? { ...job, ...body } : job,
          )
          return HttpResponse.json(scoutJobs.find((job) => job.id === id))
        }),
        http.delete(`${finalUrl}/api/scout/jobs/:id`, ({ params }) => {
          const id = String(params.id)
          scoutJobs = scoutJobs.filter((job) => job.id !== id)
          return HttpResponse.json(null, { status: 204 })
        }),
      )

      renderDashboard()

      expect(await screen.findAllByText('Acme')).toHaveLength(2)

      fireEvent.click(screen.getAllByRole('button', { name: /Review/ })[0]!)
      expect(await screen.findByText('Scoutly')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /Save for later/ }))

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /Apply/ })[0]).toHaveAccessibleName(/1 ready/)
      })

      fireEvent.click(screen.getAllByRole('button', { name: /Apply/ })[0]!)

      await waitFor(() => {
        expect(window.location.hash).toBe('#apply')
        expect(screen.getByRole('button', { name: /View board/ })).toBeInTheDocument()
        expect(screen.getAllByText('Scoutly').length).toBeGreaterThan(0)
      })

      const scoutlyArticle = screen.getAllByText('Scoutly')[0]!.closest('article')!
      fireEvent.click(within(scoutlyArticle).getAllByRole('button', { name: /Applied/ })[0]!)

      await waitFor(() => {
        expect(mockApiState.createJobApplicationRequests).toHaveLength(1)
        expect(mockApiState.createJobApplicationRequests[0]?.companyName).toBe('Scoutly')
        expect(window.location.hash).toBe('#apply')
        expect(screen.getByRole('button', { name: /View board/ })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /View board/ }))

      await waitFor(() => {
        expect(window.location.hash).toBe('#board')
        expect(screen.getAllByText('Scoutly').length).toBeGreaterThan(0)
      })
    })

    it('ScoutFlow_MarkAppliedDuplicate_ShowsBackendMessageAndKeepsSavedJob', async () => {
      const duplicateMessage = 'This job already exists in Scout or Tracker.'
      let deleteRequests = 0
      let createAttempts = 0
      const scoutJobs: ScoutJob[] = [
        {
          id: 'scout-duplicate-1',
          title: 'Duplicate Engineer',
          company: 'DupCo',
          location: 'Remote',
          workplaceType: 'Remote',
          commitment: 'Full-time',
          postedAt: '2026-05-31T12:00:00.000Z',
          jobUrl: 'https://example.com/dupco',
          applyUrl: 'https://example.com/dupco/apply',
          technicalTools: 'React, TypeScript',
          requirementsSummary: 'Build duplicate-safe workflows.',
          savedForApply: true,
          isDiscarded: false,
          createdAt: '2026-06-01T12:00:00.000Z',
        },
      ]
      mockApiState.jobApplications = [
        {
          id: 'job-duplicate-1',
          companyName: 'DupCo',
          position: 'Duplicate Engineer',
          jobUrl: 'https://example.com/dupco/apply',
          location: 'Remote',
          salaryRange: null,
          jobDescription: null,
          notes: null,
          interestLevel: null,
          technicalStack: null,
          status: JobApplicationStatus.Applied,
          dateApplied: '2026-05-12T12:00:00.000Z',
          userId: 'user-1',
        },
      ]

      server.use(
        http.get(`${finalUrl}/api/scout/jobs`, () => HttpResponse.json(scoutJobs)),
        http.post(`${finalUrl}/api/jobapplications`, async () => {
          createAttempts += 1
          return HttpResponse.json({
            status: 400,
            title: 'Bad Request',
            detail: duplicateMessage,
          }, { status: 400 })
        }),
        http.delete(`${finalUrl}/api/scout/jobs/:id`, () => {
          deleteRequests += 1
          return HttpResponse.json(null, { status: 204 })
        }),
      )

      const { container } = renderDashboard('#apply')

      expect(await screen.findByText('Apply Summary')).toBeInTheDocument()
      const applyPanel = container.querySelector('[data-tour-id="scout-to-apply-panel"]')!
      const duplicateArticle = within(applyPanel as HTMLElement).getAllByText('DupCo')[0]!.closest('article')!

      fireEvent.click(within(duplicateArticle).getAllByRole('button', { name: /Applied/ })[0]!)

      await waitFor(() => {
        expect(screen.getByText(duplicateMessage)).toBeInTheDocument()
        expect(createAttempts).toBe(1)
        expect(deleteRequests).toBe(0)
        expect(screen.getAllByText('DupCo').length).toBeGreaterThan(0)
        expect(mockApiState.jobApplications).toHaveLength(1)
      })
    })

    it('ScoutFlow_RemoveSavedJob_RequiresConfirmation', async () => {
      let scoutJobs: ScoutJob[] = [
        {
          id: 'scout-remove-1',
          title: 'Platform Engineer',
          company: 'QueueCo',
          location: 'Remote',
          workplaceType: 'Remote',
          commitment: 'Full-time',
          postedAt: '2026-05-31T12:00:00.000Z',
          jobUrl: 'https://example.com/queueco',
          applyUrl: 'https://example.com/queueco/apply',
          technicalTools: 'React, TypeScript',
          requirementsSummary: 'Build queue workflows.',
          savedForApply: true,
          isDiscarded: false,
          createdAt: '2026-06-01T12:00:00.000Z',
        },
      ]

      server.use(
        http.get(`${finalUrl}/api/scout/jobs`, () => HttpResponse.json(scoutJobs)),
        http.delete(`${finalUrl}/api/scout/jobs/:id`, ({ params }) => {
          const id = String(params.id)
          scoutJobs = scoutJobs.filter((job) => job.id !== id)
          return HttpResponse.json(null, { status: 204 })
        }),
      )

      renderDashboard('#apply')

      expect((await screen.findAllByText('QueueCo')).length).toBeGreaterThan(0)

      const queueArticle = screen.getAllByText('QueueCo')[0]!.closest('article')!
      fireEvent.click(within(queueArticle).getAllByRole('button', { name: /Remove/ })[0]!)

      expect(screen.getByText('Remove saved job?')).toBeInTheDocument()
      expect(screen.getAllByText('QueueCo').length).toBeGreaterThan(0)

      const dialog = screen.getByText('Remove saved job?').closest('[role="dialog"]')!
      fireEvent.click(within(dialog as HTMLElement).getByRole('button', { name: 'Remove' }))

      await waitFor(() => {
        expect(screen.queryByText('QueueCo')).not.toBeInTheDocument()
      })
    })
  })
})

describe('OnboardingTour', () => {
  it('OnboardingTour_Inline_RendersFirstStep', () => {
    render(<OnboardingTour open variant="inline" onClose={() => {}} />)

    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument()
    expect(screen.getByText('Welcome to Traxr')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Next/ })).toBeInTheDocument()
  })

  it('OnboardingTour_Inline_NavigatesToNextStep', () => {
    render(<OnboardingTour open variant="inline" onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /Next/ }))

    expect(screen.getByText('Step 2 of 5')).toBeInTheDocument()
    expect(screen.getByText('Search')).toBeInTheDocument()
  })

  it('OnboardingTour_Inline_LastStepShowsGotIt', () => {
    render(<OnboardingTour open variant="inline" onClose={() => {}} />)

    // Click through to last step
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    }

    expect(screen.getByText('Step 5 of 5')).toBeInTheDocument()
    expect(screen.getByText("Track")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Got it/ })).toBeInTheDocument()
  })

  it('OnboardingTour_Closed_ReturnsNull', () => {
    const { container } = render(<OnboardingTour open={false} variant="inline" onClose={() => {}} />)

    expect(container.innerHTML).toBe('')
  })

  it('OnboardingTour_Modal_ShowsBackdrop', () => {
    render(<OnboardingTour open variant="modal" onClose={() => {}} />)

    // Modal has two close buttons: backdrop + X
    const closeButtons = screen.getAllByLabelText('Close tour')
    expect(closeButtons.length).toBeGreaterThanOrEqual(2)
  })
})
