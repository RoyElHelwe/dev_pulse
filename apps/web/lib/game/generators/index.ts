// Office Generation System - Main Index
// Exports all generation-related modules

// Types
export * from './types'

// Constants
export * from './constants'

// Core Generator
export { OfficeLayoutGenerator } from './OfficeLayoutGenerator'

// Templates
export {
  ALL_TEMPLATES,
  getTemplateById,
  getTemplatesByCategory,
  getTemplatesForTeamSize,
  getRecommendedTemplate,
  getTemplateSummaries,
  techStartupTemplate,
  corporateOfficeTemplate,
  creativeAgencyTemplate,
  remoteHubTemplate,
  enterpriseFloorTemplate,
  hybridWorkspaceTemplate,
} from './templates'
export type { TemplateSummary } from './templates'
