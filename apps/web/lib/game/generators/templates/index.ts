// Office Templates Index
// Export all pre-built office templates

export { techStartupTemplate } from './tech-startup'
export { corporateOfficeTemplate } from './corporate-office'
export { creativeAgencyTemplate } from './creative-agency'
export { remoteHubTemplate } from './remote-hub'
export { enterpriseFloorTemplate } from './enterprise-floor'
export { hybridWorkspaceTemplate } from './hybrid-workspace'

import { techStartupTemplate } from './tech-startup'
import { corporateOfficeTemplate } from './corporate-office'
import { creativeAgencyTemplate } from './creative-agency'
import { remoteHubTemplate } from './remote-hub'
import { enterpriseFloorTemplate } from './enterprise-floor'
import { hybridWorkspaceTemplate } from './hybrid-workspace'
import { OfficeTemplate, TemplateCategory } from '../types'

// All templates array
export const ALL_TEMPLATES: OfficeTemplate[] = [
  techStartupTemplate,
  corporateOfficeTemplate,
  creativeAgencyTemplate,
  remoteHubTemplate,
  enterpriseFloorTemplate,
  hybridWorkspaceTemplate,
]

// Get template by ID
export function getTemplateById(id: string): OfficeTemplate | undefined {
  return ALL_TEMPLATES.find(t => t.id === id)
}

// Get templates by category
export function getTemplatesByCategory(category: TemplateCategory): OfficeTemplate[] {
  return ALL_TEMPLATES.filter(t => t.category === category)
}

// Get templates suitable for team size
export function getTemplatesForTeamSize(teamSize: number): OfficeTemplate[] {
  return ALL_TEMPLATES.filter(t => 
    teamSize >= t.minTeamSize && teamSize <= t.maxTeamSize
  )
}

// Get recommended template for team size
export function getRecommendedTemplate(teamSize: number): OfficeTemplate {
  // Find templates that fit the team size
  const suitable = getTemplatesForTeamSize(teamSize)
  
  if (suitable.length === 0) {
    // If team is too small, use startup template
    if (teamSize < 5) return techStartupTemplate
    // If team is too large, use enterprise template
    return enterpriseFloorTemplate
  }
  
  // Return the template where team size is closest to the middle of the range
  return suitable.reduce((best, current) => {
    const bestMid = (best.minTeamSize + best.maxTeamSize) / 2
    const currentMid = (current.minTeamSize + current.maxTeamSize) / 2
    const bestDiff = Math.abs(teamSize - bestMid)
    const currentDiff = Math.abs(teamSize - currentMid)
    return currentDiff < bestDiff ? current : best
  })
}

// Template summary for UI display
export interface TemplateSummary {
  id: string
  name: string
  description: string
  category: TemplateCategory
  teamRange: string
  features: string[]
  icon: string
}

export function getTemplateSummaries(): TemplateSummary[] {
  return [
    {
      id: 'tech-startup',
      name: 'Tech Startup',
      description: 'Open floor plan with collaborative clusters',
      category: 'STARTUP',
      teamRange: '5-15 people',
      features: ['Open plan', 'Standing desks', 'Bean bags', 'Collaboration hub'],
      icon: '🚀',
    },
    {
      id: 'corporate-office',
      name: 'Corporate Office',
      description: 'Structured layout with department zones',
      category: 'CORPORATE',
      teamRange: '20-50 people',
      features: ['Department zones', 'Executive wing', 'Reception', 'Conference room'],
      icon: '🏢',
    },
    {
      id: 'creative-agency',
      name: 'Creative Agency',
      description: 'Flexible spaces for creativity',
      category: 'CREATIVE',
      teamRange: '10-25 people',
      features: ['Design studio', 'Brainstorm zone', 'Recording booth', 'Inspiration walls'],
      icon: '🎨',
    },
    {
      id: 'remote-hub',
      name: 'Remote Hub',
      description: 'Hot desk system for flexible teams',
      category: 'REMOTE_HUB',
      teamRange: '5-30 people',
      features: ['Hot desks', 'Video booths', 'Town hall', 'Social hub'],
      icon: '🌐',
    },
    {
      id: 'enterprise-floor',
      name: 'Enterprise Floor',
      description: 'Large-scale multi-team organization',
      category: 'ENTERPRISE',
      teamRange: '50-100 people',
      features: ['Multiple departments', 'Town hall', 'Executive wing', 'Cafeteria'],
      icon: '🏛️',
    },
    {
      id: 'hybrid-workspace',
      name: 'Hybrid Workspace',
      description: 'Mixed assigned and hot desks',
      category: 'HYBRID',
      teamRange: '15-40 people',
      features: ['60/40 desk split', 'Focus rooms', 'Collaboration zone', 'Flexible seating'],
      icon: '🔄',
    },
  ]
}

export default ALL_TEMPLATES
