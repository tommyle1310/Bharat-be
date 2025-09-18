import http from "http";
import { createApp } from "./app";
import { initSocket, getIO } from "./config/socket";
import { config } from "./config/config";
import { disconnectRedis, getRedis } from "./config/redis";
import { startAutoBidRunner } from "./services/auto-bid.runner";

const app = createApp();
const server = http.createServer(app);
initSocket(server);
startAutoBidRunner();

async function initRedisSubscriber() {
  const redis = getRedis().duplicate(); // ioredis client riêng cho subscriber

  // Subscribe nhiều channel 1 lần
  redis.subscribe("vehicle:endtime:update", "vehicle:winner:update", (err, count) => {
    if (err) {
      console.error("[Redis] Subscribe error", err);
      return;
    }
    console.log(`[Redis] Subscribed to ${count} channels`);
  });

  // Lắng nghe message từ các channel
  redis.on("message", (channel, message) => {
    console.log(`[Redis] Received message on ${channel}: ${message}`);

    try {
      const io = getIO();
      const payload = JSON.parse(message);

      if (channel === "vehicle:endtime:update") {
        io.emit("vehicle:endtime:update", payload);
      } else if (channel === "vehicle:winner:update") {
        // Forward winner update with auctionEndDttm if present
        io.emit("vehicle:winner:update", payload);

        // emit riêng cho buyer cụ thể
        if (payload?.winnerBuyerId) {
          io.to(String(payload.winnerBuyerId)).emit("isWinning", { vehicleId: payload.vehicleId, auctionEndDttm: payload.auctionEndDttm });
        }
        if (payload?.loserBuyerId) {
          io.to(String(payload.loserBuyerId)).emit("isLosing", { vehicleId: payload.vehicleId, auctionEndDttm: payload.auctionEndDttm });
        }
      }
    } catch (e) {
      console.error("[Redis->Socket] Failed handling message", channel, e);
    }
  });
}

server.listen(config.port, config.host, () => {
  console.log(`HTTP listening on http://${config.host}:${config.port} in ${config.env}`);
  initRedisSubscriber().catch((e) => console.error("[Redis] subscribe error", e));
});

const shutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Graceful shutdown...`);
  server.close(async () => {
    await disconnectRedis();
    console.log("Server closed. Bye.");
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));


server.listen(config.port, config.host, () => {
  console.log(`HTTP listening on http://${config.host}:${config.port} in ${config.env}`);
  initRedisSubscriber().catch((e) => console.error('[Redis] subscribe error', e));
});
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
