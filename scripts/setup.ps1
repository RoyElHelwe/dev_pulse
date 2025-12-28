# PowerShell Setup Script for Windows
# ft_transcendence - Setup Script

Write-Host "🚀 ft_transcendence - Setup Script" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "📋 Checking prerequisites..." -ForegroundColor Yellow

if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is not installed" -ForegroundColor Red
    Write-Host "Please install Node.js 22+ from https://nodejs.org/"
    exit 1
}

$nodeVersion = (node -v).Substring(1).Split('.')[0]
if ([int]$nodeVersion -lt 22) {
    Write-Host "⚠️  Node.js version is $nodeVersion, but 22+ is recommended" -ForegroundColor Yellow
}

Write-Host "✓ Node.js $(node -v)" -ForegroundColor Green

# Check pnpm
if (!(Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️  pnpm is not installed. Installing..." -ForegroundColor Yellow
    npm install -g pnpm
}

Write-Host "✓ pnpm $(pnpm -v)" -ForegroundColor Green

# Check Docker
if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker is not installed" -ForegroundColor Red
    Write-Host "Please install Docker Desktop from https://www.docker.com/"
    exit 1
}

Write-Host "✓ Docker installed" -ForegroundColor Green

Write-Host ""
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
pnpm install

Write-Host ""
Write-Host "📝 Setting up environment variables..." -ForegroundColor Yellow
if (!(Test-Path .env)) {
    Copy-Item .env.template .env
    Write-Host "✓ Created .env file" -ForegroundColor Green
    Write-Host "⚠️  Please edit .env and fill in required values" -ForegroundColor Yellow
    Write-Host "   Generate secrets with: openssl rand -base64 32" -ForegroundColor Yellow
} else {
    Write-Host "⚠️  .env file already exists, skipping..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🐳 Starting Docker services..." -ForegroundColor Yellow
docker-compose up -d

Write-Host ""
Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📚 Next steps:" -ForegroundColor Cyan
Write-Host "1. Edit .env file and add your secrets"
Write-Host "2. Run 'pnpm run dev' to start development"
Write-Host "3. Visit http://localhost:3000"
Write-Host ""
Write-Host "📖 Useful commands:" -ForegroundColor Cyan
Write-Host "  pnpm run dev          - Start all services"
Write-Host "  pnpm run docker:logs  - View Docker logs"
Write-Host "  pnpm run migrate      - Run database migrations"
Write-Host "  pnpm run seed         - Seed database"
Write-Host ""
Write-Host "🎉 Happy coding!" -ForegroundColor Green
