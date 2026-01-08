/**
 * Dynamic Office Generation Types
 * 
 * Re-exports all office-related types from @dev-pulse/shared-types
 * for backward compatibility with existing code.
 * 
 * New code should import directly from '@dev-pulse/shared-types/office'
 */

// Re-export everything from the shared types package
export * from '@dev-pulse/shared-types';
export * from '@dev-pulse/shared-types/office';

// For backwards compatibility, also export common types
export type {
  Position,
  Dimensions,
  Rectangle,
  Bounds,
  Direction,
} from '@dev-pulse/shared-types';

// Re-export all office types explicitly for IDE discoverability
export type {
  // Enums
  GenerationMode,
  TemplateCategory,
  DepartmentType,
  WorkStyle,
  CollaborationLevel,
  OfficeCulture,
  DeskType,
  DeskStatus,
  RoomType,
  RoomStatus,
  ZoneType,
  DecorationType,
  InteractionType,
  SpawnPointType,
  
  // Entities
  ZoneData,
  ZoneRules,
  DeskData,
  RoomData,
  DecorationData,
  WallData,
  SpawnPoint,
  PathwayData,
  
  // Layout
  OfficeLayoutData,
  LayoutMetadata,
  LayoutMetrics,
  OfficeTemplate,
  ColorScheme,
  OfficeLayoutModel,
  OfficeTemplateModel,
  
  // Generation
  Department,
  GenerationParams,
  TemplateSelectionParams,
  TemplateCustomization,
  LayoutConstraints,
  LayoutPreferences,
  AILayoutRequest,
  AILayoutResponse,
  GenerationResult,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  
  // Booking
  DeskAssignment,
  CreateDeskAssignmentDto,
  UpdateDeskAssignmentDto,
  MeetingRoomBooking,
  CreateMeetingBookingDto,
  UpdateMeetingBookingDto,
  
  // Realtime
  OfficeState,
  OfficeStateDto,
  OfficeEventType,
  OfficeUpdateEvent,
  DeskOccupiedPayload,
  DeskVacatedPayload,
  RoomStatusChangedPayload,
  UserMovedPayload,
  EditorTool,
  EditorActionType,
  EditorAction,
  EditorState,
} from '@dev-pulse/shared-types/office';
