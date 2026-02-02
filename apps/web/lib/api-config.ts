/**
 * Get the API base URL for client-side requests
 * This ensures the API URL is properly configured for browser requests
 */
export function getApiUrl(): string {
  // In the browser, use NEXT_PUBLIC_API_URL
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    const protocol = window.location.protocol
    
    // If accessing via localhost or 127.0.0.1, use localhost for API
    // Otherwise use the configured NEXT_PUBLIC_API_URL
    let apiUrl: string
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // Local access - use localhost for API
      apiUrl = `${protocol}//localhost:4000`
      console.log('[API Config] Local access detected, using localhost API:', apiUrl)
    } else {
      // Network access - use the configured URL or fallback to current host
      apiUrl = process.env.NEXT_PUBLIC_API_URL || `${protocol}//${hostname}:4000`
      console.log('[API Config] Network access detected, using configured API:', apiUrl)
    }
    
    console.log('[API Config] Final API URL:', { 
      apiUrl,
      hostname,
      protocol,
      envUrl: process.env.NEXT_PUBLIC_API_URL
    })
    
    return apiUrl
  }
  
  // On the server (should not happen in client components, but just in case)
  // Use Docker internal network
  console.log('[API Config] Server-side API URL request')
  return process.env.API_URL || 'https://api-gateway:4000'
}

/**
 * Get the WebSocket URL for client-side connections
 */
export function getWsUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    
    // If accessing via localhost or 127.0.0.1, use localhost for WebSocket
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//localhost:4000`
    }
    
    // Network access - use the configured URL or fallback
    const url = process.env.NEXT_PUBLIC_WS_URL
    if (!url) {
      console.error('[API Config] NEXT_PUBLIC_WS_URL is not defined!')
      return `${protocol}//${hostname}:4000`
    }
    return url
  }
  
  return process.env.WS_URL || 'wss://api-gateway:4000'
}
