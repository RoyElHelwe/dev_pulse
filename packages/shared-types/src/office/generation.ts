/**
 * Office Generation Types
 * 
 * Types for generating office layouts (AI, template, manual)
 */

import { Position, Rectangle } from '../common';
import {
  DepartmentType,
  WorkStyle,
  CollaborationLevel,
  OfficeCulture,
  ZoneType,
} from './enums';
import { OfficeLayoutData, LayoutMetrics, ColorScheme } from './layout';
import { RoomData } from './entities';

// ============================================
// DEPARTMENT INPUT
// ============================================

/**
 * Department configuration for generation
 */
export interface Department {
  type: DepartmentType;
  name: string;
  headcount: number;
  color?: string;
  customName?: string;
}

// ============================================
// GENERATION PARAMS
// ============================================

/**
 * Parameters for generating an office layout
 */
export interface GenerationParams {
  teamSize: number;
  departments: Department[];
  workStyle: WorkStyle;
  collaboration: CollaborationLevel;
  culture: OfficeCulture;

  // Optional advanced settings
  includeHotDesks?: boolean;
  hotDeskRatio?: number; // 0-1, portion of desks that are hot desks
  includeFocusZones?: boolean;
  includeGameArea?: boolean;
  preferredAmenities?: string[];
  accessibilityFeatures?: boolean;
}

/**
 * Parameters for template-based generation
 */
export interface TemplateSelectionParams {
  templateId: string;
  teamSize: number;
  departments?: Department[];
  customizations?: TemplateCustomization;
}

/**
 * Customizations to apply to a template
 */
export interface TemplateCustomization {
  sizeMultiplier?: number; // 0.7 - 1.3
  addRooms?: Partial<RoomData>[];
  removeRoomIds?: string[];
  colorScheme?: ColorScheme;
  addDecorations?: Array<{ type: string; position: Position }>;
}

// ============================================
// LAYOUT CONSTRAINTS & PREFERENCES
// ============================================

/**
 * Constraints for layout generation
 */
export interface LayoutConstraints {
  minDeskSpacing: number;
  minPathwayWidth: number;
  maxDensity: number;
  requiredRooms?: Partial<RoomData>[];
  requiredZones?: ZoneType[];
}

/**
 * Preferences for layout generation
 */
export interface LayoutPreferences {
  preferOpenPlan: boolean;
  preferNaturalLight: boolean;
  prioritizeCollaboration: boolean;
  quietZonePercentage: number;
}

// ============================================
// AI GENERATION TYPES
// ============================================

/**
 * Request payload for AI layout generation
 */
export interface AILayoutRequest {
  params: GenerationParams;
  constraints?: LayoutConstraints;
  preferences?: LayoutPreferences;
}

/**
 * Response from AI layout generation
 */
export interface AILayoutResponse {
  layout: OfficeLayoutData;
  reasoning: string;
  alternativeSuggestions?: string[];
  optimizationScore: number;
  metrics: LayoutMetrics;
}

// ============================================
// GENERATION RESULT TYPES
// ============================================

/**
 * Result of a layout generation operation
 */
export interface GenerationResult {
  success: boolean;
  layout?: OfficeLayoutData;
  metrics?: LayoutMetrics;
  reasoning?: string;
  error?: string;
  warnings?: string[];
}

// ============================================
// VALIDATION TYPES
// ============================================

/**
 * Result of layout validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  code: string;
  message: string;
  location?: Position | Rectangle;
  severity: 'error';
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  code: string;
  message: string;
  location?: Position | Rectangle;
  severity: 'warning';
  suggestion?: string;
}
