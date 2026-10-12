// Playwright global setup script warming up HTTP routes before test suites run.
// Disables TLS rejection for local testing certificates during route pre-fetching.

/** Application routes pre-warmed before launching test suites to prime bundler caches. */
export const routes = [
  '/',
  '/login',
  '/register',
  '/onboarding',
  '/office',
  '/board',
  '/auth/dev',
  '/api/auth/dev',
  '/terms',
  '/privacy',
  '/team',
  '/forgot-password',
  '/verify-email',
  '/reset-password',
  '/close-sessions',
  '/two-factor',
  '/settings/security',
  '/settings/voice',
  '/invite/warmup',
  '/status',
];

/** Sequentially pings application routes to warm up compilation caches before testing. */
export default async function globalSetup() {
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:8080';
  const prevTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const start = Date.now();
  try {
    await Promise.all(
      routes.map(async (route) => {
        try {
          const url = new URL(route, baseURL).toString();
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 30_000);
          try {
            await fetch(url, { signal: controller.signal });
          } finally {
            clearTimeout(timeout);
          }
        } catch {
          // Ignore warmup errors
        }
      }),
    );
  } finally {
    if (prevTls === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevTls;
    }
  }

  const elapsed = Date.now() - start;
  console.log(`[globalSetup] Warmed up ${routes.length} routes in ${elapsed}ms (${baseURL})`);
}
