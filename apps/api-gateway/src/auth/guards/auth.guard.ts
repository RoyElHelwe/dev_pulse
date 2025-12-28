import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common'
import { AuthService } from '../auth.service'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const authHeader = request.headers.authorization

    if (!authHeader) {
      throw new UnauthorizedException('No authorization header')
    }

    const sessionToken = authHeader.replace('Bearer ', '')

    try {
      const { user, session } = await this.authService.validateSession(sessionToken)
      request.user = user
      request.session = session
      return true
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired session')
    }
  }
}
