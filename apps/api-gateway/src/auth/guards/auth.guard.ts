import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Try to get token from cookie first, then fallback to Authorization header
    const sessionToken =
      request.cookies?.session_token ||
      request.headers.authorization?.replace('Bearer ', '');

    if (!sessionToken) {
      throw new UnauthorizedException('No session token provided');
    }

    try {
      const { user, session } =
        await this.authService.validateSession(sessionToken);
      request.user = user;
      request.session = session;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired session');
    }
  }
}
