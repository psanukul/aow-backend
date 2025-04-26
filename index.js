import dotenv from "dotenv";
import { app } from "./src/app.js";
import connectDB from "./src/config/db.js";
import { connectRedis } from "./src/config/redis.js";

dotenv.config({
  path: "./.env",
});

const PORT = process.env.PORT || 4000;

console.log("Attempting to connect to services...");

Promise.all([connectDB(), connectRedis()])
  .then(() => {
    console.log(
      "✅✅ MongoDB and Redis connected successfully. Starting server..."
    );

    app.on("error", (error) => {
      console.error("Express App Error:", error);
      throw error;
    });

    app.listen(PORT, () => {
      console.log(`🚀 Server is running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error(
      "🔴🔴 Failed to connect to one or more essential services (MongoDB/Redis). Server not started.",
      error
    );
    process.exit(1);
  });
