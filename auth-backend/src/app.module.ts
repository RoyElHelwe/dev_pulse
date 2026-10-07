import { Module } from "@nestjs/common";//to use the @module
import { APP_GUARD } from "@nestjs/core";
import { createObserveModule } from "@nestjs/observe";
import { AuthModule } from "@thallesp/nestjs-better-auth";//for connect better auth with nestjs
import { auth } from "./lib/auth.js";//the better auth config
import { AuthGuard } from "./common/auth/auth.guard.js";//for guard
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({//the config of appmodule
  imports: [
	ObserveModule.forRoot({
	  appKey: "YOUR_APP_KEY",
	  appSecret: "YOUR_APP_SECRET",
	  serviceId: "auth-backend",
	}),
	// Better Auth still serves /api/auth/* (sign in, sign up, OAuth, 2FA...).
	// We turn off its built-in guard because we use our own AuthGuard below.
	AuthModule.forRoot({ auth, disableGlobalAuthGuard: true }),//connect the vetter auth conf to nestjs
  ],
  controllers: [AppController],
  providers: [
	AppService,
	//our AuthGuard runs before EVERY route. Open routes use @Public().
	{ provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}

/**This is the root module,the place where we tell Nest what our app is made of
 * In imports it plugs in two external modules: Observe (monitoring) and Better Auth (which automatically serves the /api/auth/* routes like sign-in and sign-up)
 * In providers it registers AppService and sets my own AuthGuard as a global guard via APP_GUARD,
 * meaning every request passes through that guard before reaching any route. */
