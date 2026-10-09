import dotenv from "dotenv";

dotenv.config();

import mongoose from "mongoose";
import createApp from "./app.js";
import connectDB from "./config/db.js";
import { loadConfig } from "./config/env.js";

const startServer = async () => {
  let config;

  try {
    config = loadConfig();
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }

  await connectDB(config.mongoUri);

  const app = createApp(config);

  const server = app.listen(config.port, () => {
    console.log("");
    console.log("========================================");
    console.log("🚀 CodeCrafter AI Backend Started");
    console.log("========================================");
    console.log(`🌐 Server: http://localhost:${config.port}`);
    console.log(`❤️ Health: http://localhost:${config.port}/api/health`);
    console.log(`🔒 HTTPS enforced: ${config.forceHttps}`);
    console.log("========================================");
    console.log("");

    // Tells PM2 (wait_ready) that the app is accepting connections.
    process.send?.("ready");
  });

  // Graceful shutdown for PM2 reloads and container stops.
  const shutdown = (signal) => {
    console.log(`\n${signal} received, shutting down...`);

    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });

    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};

startServer();
