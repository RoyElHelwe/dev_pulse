import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service.js";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}

/**handles requests,This defines your routes.
 * @Controller() with no argument means the routes start at /,
 * and @Get() makes getHello() respond to GET / .
 * @AllowAnonymous() marks this route as public so users don't need to be logged in. 
 * The controller doesn't do the work itself; it receives AppService through the constructor (this is called dependency injection) and calls it. */