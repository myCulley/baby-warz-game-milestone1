import { defineRoom, defineServer } from "colyseus";
import { BabyWarzRoom } from "./rooms/BabyWarzRoom.js";

interface JsonResponse {
  status(code: number): { json(body: unknown): void };
}

const server = defineServer({
  rooms: { baby_warz: defineRoom(BabyWarzRoom).enableRealtimeListing() },
  express: (app) => {
    app.get("/health", (_request: unknown, response: JsonResponse) =>
      response.status(200).json({ status: "ok" }),
    );
    app.get("/api/status", (_request: unknown, response: JsonResponse) =>
      response.status(200).json({ game: "Baby Warz", status: "ready" }),
    );
  },
});

server.listen(Number(process.env.PORT ?? 2567));
