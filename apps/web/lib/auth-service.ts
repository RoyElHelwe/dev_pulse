import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  Verify2FARequest,
  Verify2FAResponse,
  RefreshTokenResponse,
  Setup2FAResponse,
  SessionInfo,
  UserSession,
  ApiError,
} from './types'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL!

class AuthService {
  private isRefreshing = false
  private refreshPromise: Promise<void> | null = null

  // Get authorization header (for backwards compatibility, but cookies are now used)
  private getAuthHeader(): HeadersInit {
    return {
      'Content-Type': 'application/json',
    }
  }

  // Handle API errors
  private async handleResponse<T>(response: Response, skipRefresh = false): Promise<T> {
    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        statusCode: response.status,
        message: response.statusText,
      }))

      console.log('API Error:', { status: response.status, error, skipRefresh })

      // Try to refresh token on 401 if we haven't already tried
      // We can't check for refresh_token cookie in JS because it's httpOnly
      // Just try to refresh - if it fails, backend will return 401
      if (response.status === 401 && !skipRefresh) {
        console.log('Got 401, attempting to refresh token...')
        try {
          // Wait if already refreshing
          if (this.isRefreshing && this.refreshPromise) {
            console.log('Already refreshing, waiting...')
            await this.refreshPromise
          } else {
            // Refresh the token
            console.log('Calling refresh endpoint...')
            await this.refresh()
          }
          
          console.log('Token refreshed successfully, retrying original request...')
          // Retry the original request with the new token from cookie
          const retryResponse = await fetch(response.url, {
            method: response.url.includes('/register') || response.url.includes('/login') ? 'POST' : 
                    response.url.includes('/refresh') || response.url.includes('/logout') || 
                    response.url.includes('/2fa') ? 'POST' : 'GET',
            headers: this.getAuthHeader(),
            credentials: 'include',
          })
          
          return this.handleResponse<T>(retryResponse, true)
        } catch (refreshError) {
          console.error('Refresh failed:', refreshError)
          // If refresh fails, redirect to login (but not if already on login page)
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            window.location.href = '/login'
          }
          throw new Error('Session expired. Please login again.')
        }
      }

      throw new Error(error.message || 'An error occurred')
    }

    // Handle 204 No Content - return empty object
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return {} as T
    }

    return response.json()
  }

  // Check if refresh token exists in cookies
  private hasRefreshToken(): boolean {
    if (typeof document === 'undefined') return false
    const cookies = document.cookie
    const hasToken = cookies.includes('refresh_token=')
    console.log('Checking for refresh token:', { cookies, hasToken })
    return hasToken
  }

  // Register new user
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies
      body: JSON.stringify(data),
    })

    return this.handleResponse<RegisterResponse>(response, true)
  }

  // Login
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies
      body: JSON.stringify(data),
    })

    return this.handleResponse<LoginResponse>(response, true)
  }

  // Verify 2FA
  async verify2FA(data: Verify2FARequest): Promise<Verify2FAResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/2fa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies
      body: JSON.stringify(data),
    })

    return this.handleResponse<Verify2FAResponse>(response)
  }

  // Setup 2FA
  async setup2FA(): Promise<Setup2FAResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/2fa/setup`, {
      method: 'POST',
      headers: this.getAuthHeader(),
      credentials: 'include', // Include cookies
    })

    return this.handleResponse<Setup2FAResponse>(response)
  }

  // Enable 2FA
  async enable2FA(token: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE_URL}/auth/2fa/enable`, {
      method: 'POST',
      headers: this.getAuthHeader(),
      credentials: 'include', // Include cookies
      body: JSON.stringify({ token }),
    })

    return this.handleResponse<{ success: boolean }>(response)
  }

  // Disable 2FA
  async disable2FA(token: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE_URL}/auth/2fa/disable`, {
      method: 'POST',
      headers: this.getAuthHeader(),
      credentials: 'include', // Include cookies
      body: JSON.stringify({ token }),
    })

    return this.handleResponse<{ success: boolean }>(response)
  }

  // Get current session info
  async getSession(): Promise<SessionInfo> {
    const response = await fetch(`${API_BASE_URL}/auth/session`, {
      method: 'GET',
      headers: this.getAuthHeader(),
      credentials: 'include', // Include cookies
    })

    return this.handleResponse<SessionInfo>(response)
  }

  // Get all user sessions
  async getSessions(): Promise<UserSession[]> {
    const response = await fetch(`${API_BASE_URL}/auth/sessions`, {
      method: 'GET',
      headers: this.getAuthHeader(),
      credentials: 'include', // Include cookies
    })

    return this.handleResponse<UserSession[]>(response)
  }

  // Revoke specific session
  async revokeSession(sessionId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/session/${sessionId}`, {
      method: 'DELETE',
      headers: this.getAuthHeader(),
      credentials: 'include', // Include cookies
      body: JSON.stringify({ sessionId }),
    })

    await this.handleResponse<void>(response)
  }

  // Revoke all sessions except current
  async revokeAllSessions(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/sessions`, {
      method: 'DELETE',
      headers: this.getAuthHeader(),
      credentials: 'include', // Include cookies
    })

    await this.handleResponse<void>(response)
  }

  // Logout
  async logout(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: this.getAuthHeader(),
      credentials: 'include', // Include cookies
    })

    await this.handleResponse<void>(response)
  }

  // Refresh token
  async refresh(): Promise<RefreshTokenResponse> {
    // Prevent multiple simultaneous refresh requests
    if (this.isRefreshing && this.refreshPromise) {
      await this.refreshPromise
      return { user: null! } // Return empty, actual user will come from retry
    }

    this.isRefreshing = true
    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: this.getAuthHeader(),
          credentials: 'include', // Include cookies - refresh token comes from cookie
        })

        if (!response.ok) {
          throw new Error('Token refresh failed')
        }

        const result = await response.json()
        return result
      } finally {
        this.isRefreshing = false
        this.refreshPromise = null
      }
    })()

    return this.refreshPromise
  }

  // Check if user is authenticated (we can't check httpOnly cookies from JS)
  isAuthenticated(): boolean {
    // We can't check httpOnly cookies from JavaScript
    // This is just a fallback - real auth is handled by server cookies
    if (typeof document === 'undefined') return false
    return true // Always return true on client, let server validate
  }

  // Get session token (no longer needed as cookies handle this)
  getSessionToken(): string | null {
    return null
  }
}

// Export singleton instance
export const authService = new AuthService()
