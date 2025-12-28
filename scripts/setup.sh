#!/bin/bash

# ft_transcendence - Setup Script
# This script sets up the development environment

set -e

echo "🚀 ft_transcendence - Setup Script"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js 22+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
    echo -e "${YELLOW}⚠️  Node.js version is $NODE_VERSION, but 22+ is recommended${NC}"
fi

echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}⚠️  pnpm is not installed. Installing...${NC}"
    npm install -g pnpm
fi

echo -e "${GREEN}✓ pnpm $(pnpm -v)${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo "Please install Docker from https://www.docker.com/"
    exit 1
fi

echo -e "${GREEN}✓ Docker $(docker -v | cut -d' ' -f3 | tr -d ',')${NC}"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    echo "Please install Docker Compose"
    exit 1
fi

echo -e "${GREEN}✓ Docker Compose $(docker-compose -v | cut -d' ' -f4 | tr -d ',')${NC}"

echo ""
echo "📦 Installing dependencies..."
pnpm install

echo ""
echo "📝 Setting up environment variables..."
if [ ! -f .env ]; then
    cp .env.template .env
    echo -e "${GREEN}✓ Created .env file${NC}"
    echo -e "${YELLOW}⚠️  Please edit .env and fill in required values${NC}"
    echo -e "${YELLOW}   Generate secrets with: openssl rand -base64 32${NC}"
else
    echo -e "${YELLOW}⚠️  .env file already exists, skipping...${NC}"
fi

echo ""
echo "🐳 Starting Docker services..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check if PostgreSQL is ready
echo "Checking PostgreSQL..."
until docker-compose exec -T postgres pg_isready -U dev -d ft_trans &> /dev/null; do
    echo "Waiting for PostgreSQL..."
    sleep 2
done
echo -e "${GREEN}✓ PostgreSQL is ready${NC}"

# Check if Redis is ready
echo "Checking Redis..."
until docker-compose exec -T redis redis-cli ping &> /dev/null; do
    echo "Waiting for Redis..."
    sleep 2
done
echo -e "${GREEN}✓ Redis is ready${NC}"

echo ""
echo "✅ Setup complete!"
echo ""
echo "📚 Next steps:"
echo "1. Edit .env file and add your secrets"
echo "2. Run 'pnpm run dev' to start development"
echo "3. Visit http://localhost:3000"
echo ""
echo "📖 Useful commands:"
echo "  pnpm run dev          - Start all services"
echo "  pnpm run docker:logs  - View Docker logs"
echo "  pnpm run migrate      - Run database migrations"
echo "  pnpm run seed         - Seed database"
echo ""
echo "🎉 Happy coding!"
