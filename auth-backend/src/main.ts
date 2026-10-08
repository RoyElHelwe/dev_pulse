import "dotenv/config";//load the .env file
import { NestFactory } from "@nestjs/core";//what we use to create the nest app

import { AppModule, ObserveInstrument } from "./app.module.js";

async function bootstrap() {//start the app
  const app = await NestFactory.create(AppModule, {//create the app usiing appmodule
    instrument: ObserveInstrument,//allow to collect/obs info about the app like request error
    bodyParser: false,//dont parse the http body automa
  });

  app.enableCors({
  origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
  credentials: true,
});

  await app.listen(process.env.PORT ?? 4000);//start the backend
}
await bootstrap();//this actl run the fct
/*
the starting point,this is the file that runs first. 
It loads .env variables,creates the Nest application from AppModule,
turns on the Observe instrumentation (to monitor requests and errors),
enables CORS so your frontend at localhost:3000 can call the backend and send cookies (credentials: true),
*/