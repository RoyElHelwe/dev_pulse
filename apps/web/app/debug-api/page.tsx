'use client'

import { useState } from 'react'
import { getApiUrl } from '@/lib/api-config'

export default function DebugAPIPage() {
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const testConnection = async () => {
    setResult(null)
    setError(null)
    
    const apiUrl = getApiUrl()
    console.log('[Debug] Testing API connection to:', apiUrl)
    
    try {
      const response = await fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: 'Debug Test User',
          email: `debug-${Date.now()}@test.com`,
          password: 'debugpass123'
        })
      })
      
      console.log('[Debug] Response status:', response.status)
      console.log('[Debug] Response headers:', Object.fromEntries(response.headers.entries()))
      
      const data = await response.json()
      console.log('[Debug] Response data:', data)
      
      setResult({
        status: response.status,
        ok: response.ok,
        data: data,
        headers: Object.fromEntries(response.headers.entries())
      })
    } catch (err: any) {
      console.error('[Debug] Fetch error:', err)
      setError(err.message || String(err))
    }
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">API Connection Debug</h1>
      
      <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-800 rounded">
        <h2 className="text-xl font-semibold mb-2">Environment Info</h2>
        <div className="space-y-1 text-sm font-mono">
          <div><strong>API URL:</strong> {getApiUrl()}</div>
          <div><strong>Window Location:</strong> {typeof window !== 'undefined' ? window.location.href : 'N/A'}</div>
          <div><strong>Window Origin:</strong> {typeof window !== 'undefined' ? window.location.origin : 'N/A'}</div>
          <div><strong>NEXT_PUBLIC_API_URL:</strong> {process.env.NEXT_PUBLIC_API_URL || 'undefined'}</div>
        </div>
      </div>

      <button
        onClick={testConnection}
        className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Test Registration API
      </button>

      {error && (
        <div className="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <h3 className="font-bold mb-2">Error:</h3>
          <pre className="text-sm whitespace-pre-wrap">{error}</pre>
        </div>
      )}

      {result && (
        <div className="mt-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          <h3 className="font-bold mb-2">Success:</h3>
          <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
