// Runs the app with a throwaway local MongoDB that stores its files in ./.data (no install needed).
// For a real database, set MONGODB_URI in .env and use `npm start` instead.
require("dotenv").config();
const path = require("path");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const createApp = require("./app");

(async () => {
  const mongod = await MongoMemoryServer.create({
    instance: { dbPath: path.join(__dirname, ".data"), storageEngine: "wiredTiger", port: 27018 },
  });
  await mongoose.connect(mongod.getUri("jsinfo-tracker"));
  const port = process.env.PORT || 3000;
  createApp().listen(port, () => console.log(`Tracker running at http://localhost:${port}`));
  process.on("SIGINT", async () => { await mongoose.disconnect(); await mongod.stop(); process.exit(0); });
})().catch((e) => { console.error(e); process.exit(1); });
