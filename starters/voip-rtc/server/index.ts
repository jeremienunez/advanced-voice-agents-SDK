import {
  BunVoiceSocketAdapter,
  type WsData,
} from "./adapters/bun/voice-socket-adapter.js";
import { createStarterServerApp } from "./app/bootstrap.js";
import { createFetchHandler } from "./http/routes.js";

const app = createStarterServerApp();

Bun.serve<WsData>({
  hostname: app.env.hostname,
  port: app.env.port,
  fetch: createFetchHandler(app),
  websocket: {
    open(socket) {
      const adapter = new BunVoiceSocketAdapter(socket);
      socket.data.adapter = adapter;
      app.voiceService.handleBrowserStream(adapter, socket.data.user);
    },
    message(socket, message) {
      socket.data.adapter?.emitMessage(message, typeof message !== "string");
    },
    close(socket) {
      socket.data.adapter?.emitClose();
    },
  },
});

console.log(
  `VOIP RTC starter server listening on http://${app.env.hostname}:${app.env.port}`,
);
