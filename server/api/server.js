
import { subRouter } from "./routes/decks.js";
import {Elysia} from "elysia";

const PORT = Number(process.env.PORT) || 3030;

const app = new Elysia()
  .get("/", () => "Hello World")
  .get("/health", () => ({ ok: true }))
  .use(subRouter)
  .listen(PORT);


  console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
