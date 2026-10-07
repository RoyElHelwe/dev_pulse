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
// Reflector helps you read metadata created by decorators
//decorator put info->reflector read them
//@Public() marks a route as not requiring authentication
//Cookie Carries the session token from browser
//AuthGuard is the security checkpoint for HTTP routes it check whether the user is logged in before gave it to controller
//ExecutionContext:This gives our guard information about the current request

/**sooooo:the AuthGuard protects our HTTP routes i
 * it first skips WebSockets because they have their own authentication function 
 * then it checks if the route is public or belongs to Better Auth
 * for protected routes, it asks Better Auth to validate the session using the request's cookie
 * if there is no valid session, it returns 401
 * if the session is valid, it puts the user and session on req, 
 * then allows the request to reach the controller. */