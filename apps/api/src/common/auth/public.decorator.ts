import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/** Every route needs a signed-in user unless it is marked @Public(). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
