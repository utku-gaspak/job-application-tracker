import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { AuthProvider } from '../context/AuthContext'
import { ThemeProvider } from '../context/ThemeContext'
import { server } from './mocks/server'
import { finalUrl } from '../baseUrl'

const renderAppAt = (path: string) => {
  window.history.pushState({}, '', path)

  return render(
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>,
  )
}

describe('App', () => {
  it('App_ExistingToken_StartsAtDashboard', async () => {
    localStorage.setItem('token', 'test-jwt-token')
    renderAppAt('/dashboard')

    expect(await screen.findByText(/Job Application Tracker/)).toBeInTheDocument()
    expect(screen.queryByText('Access your board')).not.toBeInTheDocument()
  })

  it('ProtectedRoute_NoToken_RedirectsToLogin', async () => {
    renderAppAt('/dashboard')

    expect(await screen.findByText('Access your board')).toBeInTheDocument()
  })

  it('App_ExpiredToken_RedirectsToLogin', async () => {
    localStorage.setItem('token', 'expired-token')
    server.use(
      http.get(`${finalUrl}/api/jobapplications`, () =>
        HttpResponse.json(
          { message: 'Unauthorized' },
          { status: 401 },
        ),
      ),
    )

    renderAppAt('/dashboard')

    await waitFor(() => {
      expect(localStorage.getItem('token')).toBeNull()
      expect(screen.getByText('Access your board')).toBeInTheDocument()
    })
  })

  it('Logout_Click_ClearsStorageAndRedirects', async () => {
    localStorage.setItem('token', 'test-jwt-token')
    renderAppAt('/dashboard')

    expect(await screen.findByText(/Job Application Tracker/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))

    await waitFor(() => {
      expect(localStorage.getItem('token')).toBeNull()
      expect(screen.getByText('Access your board')).toBeInTheDocument()
    })
  })
})
