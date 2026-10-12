/**
 * Public endpoint route decorator.
 * Marks route handlers or entire controllers as accessible without authentication credentials.
 */
import { SetMetadata } from '@nestjs/common';

/** Metadata key used to flag routes that bypass the global authentication guard. */
export const IS_PUBLIC = 'isPublic';

/** Decorator marking an endpoint or controller as publicly accessible without authentication. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

