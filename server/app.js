const path = require("path");
const express = require("express");

// Builds the Express app without connecting to anything, so tests can reuse it.
function createApp() {
  const app = express();
  app.use(express.json({ limit: "20kb" }));

  app.get("/health", (req, res) => res.json({ ok: true }));
  app.use("/api/auth", require("./routes/auth"));
  app.use("/api/progress", require("./routes/progress"));
  app.use("/api/users", require("./routes/users"));

  app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));
  app.use(express.static(path.join(__dirname, "..", "public")));

  // Express 5 forwards async rejections here.
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  });
  return app;
}

module.exports = createApp;
