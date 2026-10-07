import {CanActivate,ExecutionContext,Injectable,UnauthorizedException,} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import { auth } from "../../lib/auth.js";
import { IS_PUBLIC_KEY } from "./public.decorator.js";

@Injectable()
export class AuthGuard implements CanActivate {//creqate the guard
  constructor(private readonly reflector: Reflector) {}//dependecie injection lal reflector we get a reflector

  async canActivate(context: ExecutionContext): Promise<boolean> {//the most important fct
    // Sockets are checked once at connection by authenticateSocket(), not here.
    if (context.getType() !== "http") return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(),context.getClass(),]);
    if (isPublic) return true;
    const req = context.switchToHttp().getRequest<Request>();
    //sign in, sign up, sign out... are Better Auth's own routes
    if (req.originalUrl?.startsWith("/api/auth")) return true;
    //ask Better Auth: it reads the session cookie and checks the session table
    const result = await auth.api.getSession({headers: fromNodeHeaders(req.headers),});
    if (!result) throw new UnauthorizedException("You are not signed in");
    //hand the user and session to the route (read by @CurrentUser())
    (req as any).user = result.user;
    (req as any).session = result.session;
    return true;
  }
}
/**this file check if the user is sign in or no using auth guard
 * browser->get profile->authguard->better-auth->session valid->yes or no 
 */
// reflector is hlper that let us to read metadata that decorate put on class or method
//decorator put info->reflector read them