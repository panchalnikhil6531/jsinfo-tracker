require("dotenv").config();
const mongoose = require("mongoose");
const createApp = require("./app");

const { MONGODB_URI, JWT_SECRET, PORT = 3000 } = process.env;
if (!MONGODB_URI || !JWT_SECRET) {
  console.error("Missing MONGODB_URI or JWT_SECRET. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    createApp().listen(PORT, () => console.log(`Tracker running at http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("Could not connect to MongoDB:", err.message);
    process.exit(1);
  });
