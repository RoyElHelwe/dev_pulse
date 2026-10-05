/** What every protected route knows about the caller (from the access token). */
export interface AuthUser {
  id: string;
  /** The device (refresh-token family) this access token belongs to. */
  sessionId: string;
}
