import { SetMetadata } from "@nestjs/common";
export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);//create the decorator
/**
 * This file creates the @Public() label
 * It doesn't check or block anything
 * It only sticks a note on a route that says "this one is open"
 * The AuthGuard reads that note later and lets the route pass.
 */
//we create our decorator @public mean skip auth for this ropute
//setmetadat mean attch someinfo to the root
