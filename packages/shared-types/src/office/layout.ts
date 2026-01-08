/**
 * Office Layout Types
 * 
 * Core layout structure types for office configurations
 */

import { Dimensions } from '../common';
import { GenerationMode, TemplateCategory } from './enums';
import { ZoneData, DeskData, RoomData, DecorationData, WallData, SpawnPoint, PathwayData } from './entities';

// ============================================
// MAIN LAYOUT DATA STRUCTURE
// ============================================

/**
 * Complete office layout data structure
 * This is what gets stored in the database as JSON
 */
export interface OfficeLayoutData {
  metadata: LayoutMetadata;
  dimensions: Dimensions;
  zones: ZoneData[];
  desks: DeskData[];
  rooms: RoomData[];
  decorations: DecorationData[];
  walls: WallData[];
  spawnPoints: SpawnPoint[];
  pathways: PathwayData[];
}

/**
 * Layout metadata - generation info and versioning
 */
export interface LayoutMetadata {
  version: string;
  generatedAt: string;
  mode: GenerationMode;
  teamSize: number;
  templateId?: string;
  aiPrompt?: string;
  aiReasoning?: string;
  optimizationScore?: number;
}

// ============================================
// LAYOUT METRICS
// ============================================

/**
 * Computed metrics for a layout
 */
export interface LayoutMetrics {
  totalArea: number;
  deskCount: number;
  hotDeskCount: number;
  roomCount: number;
  zoneCount: number;
  walkabilityScore: number;
  collaborationScore: number;
  privacyScore: number;
  utilizationEstimate: number;
}

// ============================================
// TEMPLATE TYPES
// ============================================

/**
 * Office template for pre-built layouts
 */
export interface OfficeTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  layout: OfficeLayoutData;
  preview?: string;
  minTeamSize: number;
  maxTeamSize: number;
  popularity?: number;
  isDefault?: boolean;
  tags?: string[];
}

// ============================================
// COLOR SCHEME
// ============================================

/**
 * Color scheme for office customization
 */
export interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  zones: Record<string, string>;
}

// ============================================
// DATABASE MODEL TYPES
// These match the Prisma schema models
// ============================================

/**
 * OfficeLayout model from Prisma
 * @prisma OfficeLayout
 */
export interface OfficeLayoutModel {
  id: string;
  workspaceId: string;
  generationMode: GenerationMode;
  templateId?: string | null;
  aiPrompt?: string | null;
  layout: OfficeLayoutData; // JSON field
  teamSize: number;
  departments: string[];
  totalArea: number;
  deskCount: number;
  roomCount: number;
  aiReasoning?: string | null;
  optimizationScore?: number | null;
  version: number;
  previousVersionId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * OfficeTemplate model from Prisma
 * @prisma OfficeTemplate
 */
export interface OfficeTemplateModel {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  layout: OfficeLayoutData; // JSON field
  preview?: string | null;
  minTeamSize: number;
  maxTeamSize: number;
  popularity: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
