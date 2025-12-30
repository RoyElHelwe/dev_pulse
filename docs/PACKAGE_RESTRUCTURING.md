# Package Restructuring - Frontend/Backend Separation

## Overview
This project has been restructured to separate frontend and backend shared packages, preventing dependency conflicts and improving build isolation.

## Structure Changes

### Before:
```
packages/
  shared/          # Single shared package used by both frontend and backend
  config/
    eslint-config/
    typescript-config/
```

### After:
```
packages/
  frontend/        # Frontend-specific shared code (for Next.js apps)
  backend/         # Backend-specific shared code (for NestJS services)
  config/
    eslint-config/
    typescript-config/
```

## Package Details

### @ft-trans/frontend-shared
- **Used by**: `apps/web` (Next.js application)
- **Dependencies**: `zod` (client-side validation)
- **Contains**: Types, schemas, and constants needed by frontend apps
- **TypeScript Config**: Uses base TypeScript configuration

### @ft-trans/backend-shared
- **Used by**: `apps/api-gateway` (NestJS service)
- **Dependencies**: `zod` (server-side validation)
- **Contains**: Types, schemas, and constants needed by backend services
- **TypeScript Config**: Uses NestJS-specific TypeScript configuration

## Benefits

1. **No Version Conflicts**: Frontend and backend can have different versions of dependencies without conflicts
2. **Faster Builds**: Each app only builds the packages it needs
3. **Better Tree-Shaking**: Frontend doesn't include backend-only code and vice versa
4. **Clear Separation**: Explicit boundaries between frontend and backend concerns
5. **Easier Maintenance**: Changes to frontend packages don't require backend rebuilds

## Migration Steps Completed

1. ✅ Created `packages/frontend` with frontend-specific configuration
2. ✅ Created `packages/backend` with backend-specific configuration
3. ✅ Copied shared types, schemas, and constants to both packages
4. ✅ Updated `apps/web/package.json` to use `@ft-trans/frontend-shared`
5. ✅ Updated `apps/api-gateway/package.json` to use `@ft-trans/backend-shared`
6. ✅ Updated all imports in `apps/web` from `@ft-trans/shared` to `@ft-trans/frontend-shared`
7. ✅ Updated `pnpm-workspace.yaml` to include new package paths
8. ✅ Updated `next.config.ts` transpile packages configuration

## Next Steps

To complete the migration, run:

```bash
# Install all dependencies
pnpm install

# Build shared packages
pnpm --filter @ft-trans/frontend-shared run build
pnpm --filter @ft-trans/backend-shared run build

# Build and test with Docker
docker-compose down
docker-compose build
docker-compose up -d

# Check logs
docker-compose logs -f web
docker-compose logs -f api-gateway
```

## Important Notes

- The old `packages/shared` directory can be removed after confirming everything works
- Each package has its own `tsconfig.json` optimized for its use case
- Frontend package uses standard TypeScript config
- Backend package uses NestJS-optimized TypeScript config
- Both packages maintain the same API (types, schemas, constants) for consistency

## File Structure

```
packages/frontend/
├── package.json           # Frontend package configuration
├── tsconfig.json          # TypeScript config (base)
└── src/
    ├── index.ts          # Main exports
    ├── types/
    │   └── index.ts      # TypeScript interfaces & types
    ├── schemas/
    │   └── index.ts      # Zod validation schemas
    └── constants/
        └── index.ts      # Constants & enums

packages/backend/
├── package.json           # Backend package configuration
├── tsconfig.json          # TypeScript config (NestJS)
└── src/
    ├── index.ts          # Main exports
    ├── types/
    │   └── index.ts      # TypeScript interfaces & types
    ├── schemas/
    │   └── index.ts      # Zod validation schemas
    └── constants/
        └── index.ts      # Constants & enums
```

## Troubleshooting

If you encounter build issues:

1. Clear all node_modules and rebuild:
   ```bash
   pnpm clean
   rm -rf node_modules
   pnpm install
   ```

2. Rebuild packages in order:
   ```bash
   pnpm --filter @ft-trans/typescript-config run build
   pnpm --filter @ft-trans/frontend-shared run build
   pnpm --filter @ft-trans/backend-shared run build
   pnpm --filter web run build
   pnpm --filter api-gateway run build
   ```

3. Check Docker containers:
   ```bash
   docker-compose ps
   docker-compose logs
   ```
