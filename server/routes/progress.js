const express = require("express");
const Progress = require("../models/Progress");
const { requireAuth } = require("../middleware");

const router = express.Router();
router.use(requireAuth);

// Shape sent to the client: { [slug]: { status?, note?, at? } }
const toMap = (docs) =>
  Object.fromEntries(
    docs.map((d) => [d.slug, { status: d.status, note: d.note, at: d.statusAt }])
  );

router.get("/", async (req, res) => {
  res.json(toMap(await Progress.find({ userId: req.userId })));
});

// Reset: remove all of the user's progress and notes.
router.delete("/", async (req, res) => {
  await Progress.deleteMany({ userId: req.userId });
  res.json({});
});

// Set status and/or note for one lesson. status "todo" (or null) clears the status.
router.put("/:slug", async (req, res) => {
  const { slug } = req.params;
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) return res.status(400).json({ error: "Invalid lesson" });

  const { status, note } = req.body || {};
  if (status !== undefined && ![null, "todo", "learning", "done"].includes(status)) return res.status(400).json({ error: "Invalid status" });
  if (note !== undefined && (typeof note !== "string" || note.length > 5000)) return res.status(400).json({ error: "Invalid note" });

  const doc = (await Progress.findOne({ userId: req.userId, slug })) || new Progress({ userId: req.userId, slug });
  if (status !== undefined) {
    const next = status === "todo" || status === null ? undefined : status;
    if (next !== doc.status) doc.statusAt = next ? new Date() : undefined;
    doc.status = next;
  }
  if (note !== undefined) doc.note = note.trim() || undefined;

  if (!doc.status && !doc.note) {
    await doc.deleteOne();
    return res.json({});
  }
  await doc.save();
  res.json(toMap([doc]));
});

module.exports = router;
