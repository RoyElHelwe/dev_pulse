'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PublicUser } from '../types'
import { authService } from '../auth-service'

interface AuthState {
  user: PublicUser | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  
  // Actions
  setUser: (user: PublicUser | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  checkAuth: () => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          error: null,
        }),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      checkAuth: async () => {
        try {
          set({ isLoading: true, error: null })

          // Always try to get session - if session_token is missing but refresh_token exists,
          // the auth service will automatically refresh
          const sessionInfo = await authService.getSession()

          set({
            user: sessionInfo.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
        } catch (error) {
          console.error('Auth check failed:', error)
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Authentication failed',
          })
          // Re-throw so the caller knows it failed
          throw error
        }
      },

      logout: async () => {
        try {
          await authService.logout()
        } catch (error) {
          console.error('Logout failed:', error)
        } finally {
          set({
            user: null,
            isAuthenticated: false,
            error: null,
          })
        }
      },

      refreshSession: async () => {
        try {
          set({ isLoading: true, error: null })
          const sessionInfo = await authService.refresh()
          set({
            user: sessionInfo.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
        } catch (error) {
          console.error('Session refresh failed:', error)
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Session refresh failed',
          })
          throw error
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
