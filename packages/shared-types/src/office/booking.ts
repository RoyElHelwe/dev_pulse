/**
 * Office Booking Types
 * 
 * Types for desk assignments and meeting room bookings
 */

// ============================================
// DESK ASSIGNMENT TYPES
// ============================================

/**
 * Desk assignment record
 * @prisma DeskAssignment
 */
export interface DeskAssignment {
  id: string;
  officeLayoutId: string;
  userId: string;
  userName?: string;
  deskId: string;
  isHotDesk: boolean;
  reservedFrom?: Date | string;
  reservedTo?: Date | string;
  checkedInAt?: Date | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/**
 * DTO for creating a desk assignment
 */
export interface CreateDeskAssignmentDto {
  deskId: string;
  userId: string;
  isPermanent?: boolean;
  startDate?: string;
  endDate?: string;
}

/**
 * DTO for updating a desk assignment
 */
export interface UpdateDeskAssignmentDto {
  isHotDesk?: boolean;
  reservedFrom?: string;
  reservedTo?: string;
}

// ============================================
// MEETING ROOM BOOKING TYPES
// ============================================

/**
 * Meeting room booking record
 * @prisma MeetingRoomBooking
 */
export interface MeetingRoomBooking {
  id: string;
  officeLayoutId: string;
  roomId: string;
  userId: string;
  userName?: string;
  title?: string;
  description?: string;
  startTime: Date | string;
  endTime: Date | string;
  attendees: string[];
  isRecurring: boolean;
  recurringRule?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/**
 * DTO for creating a meeting room booking
 */
export interface CreateMeetingBookingDto {
  roomId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  attendeeIds?: string[];
  isRecurring?: boolean;
  recurringRule?: string;
}

/**
 * DTO for updating a meeting room booking
 */
export interface UpdateMeetingBookingDto {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  attendeeIds?: string[];
}

// ============================================
// QUERY TYPES
// ============================================

/**
 * Query parameters for fetching bookings
 */
export interface GetBookingsQuery {
  startDate?: string;
  endDate?: string;
  roomId?: string;
  userId?: string;
}

/**
 * Query parameters for fetching desk assignments
 */
export interface GetDeskAssignmentsQuery {
  userId?: string;
  deskId?: string;
  isHotDesk?: boolean;
}
