import { Module } from "@nestjs/common";
import { createObserveModule } from "@nestjs/observe";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { auth } from "./lib/auth.js";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ObserveModule.forRoot({
      appKey: "YOUR_APP_KEY",
      appSecret: "YOUR_APP_SECRET",
      serviceId: "auth-backend",
    }),
    AuthModule.forRoot({ auth }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}