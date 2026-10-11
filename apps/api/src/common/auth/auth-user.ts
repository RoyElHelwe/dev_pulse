/**
 * Authenticated user context model.
 * Represents the caller identity and active device session extracted from verified access tokens.
 */

/** Authenticated user identity attached to request contexts after JWT verification. */
export interface AuthUser {
  id: string;
  /** The device (refresh-token family) this access token belongs to. */
  sessionId: string;
}

