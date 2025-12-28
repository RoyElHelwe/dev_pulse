export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-purple-500 via-purple-600 to-blue-600">
      <div className="text-center">
        <h1 className="mb-4 text-6xl font-bold text-white">
          ft_transcendence
        </h1>
        <p className="mb-8 text-xl text-purple-100">
          Collaborative Workspace with 2D Metaverse
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/login"
            className="rounded-lg bg-white px-6 py-3 font-semibold text-purple-600 transition hover:bg-purple-50"
          >
            Login
          </a>
          <a
            href="/register"
            className="rounded-lg border-2 border-white px-6 py-3 font-semibold text-white transition hover:bg-white/10"
          >
            Sign Up
          </a>
        </div>
      </div>
      
      <div className="mt-16 text-center text-purple-100">
        <p className="text-sm">✅ Phase 1 Complete - Infrastructure Ready</p>
        <p className="text-sm mt-2">🚧 Phase 2 In Progress - Building Authentication</p>
        <p className="text-xs mt-4 opacity-75">
          Next.js 16 • NestJS • PostgreSQL • Redis • NATS • Phaser.js
        </p>
      </div>
    </div>
  )
}
