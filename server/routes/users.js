const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const Progress = require("../models/Progress");
const { requireAuth } = require("../middleware");

const router = express.Router();
router.use(requireAuth);

// Community leaderboard: every user with their counts. Emails and notes are never exposed.
router.get("/", async (req, res) => {
  const [users, stats] = await Promise.all([
    User.find({}, "name createdAt").lean(),
    Progress.aggregate([
      { $match: { status: { $in: ["learning", "done"] } } },
      {
        $group: {
          _id: "$userId",
          done: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } },
          learning: { $sum: { $cond: [{ $eq: ["$status", "learning"] }, 1, 0] } },
          lastActive: { $max: "$statusAt" },
        },
      },
    ]),
  ]);
  const byId = new Map(stats.map((s) => [String(s._id), s]));
  const list = users.map((u) => {
    const s = byId.get(String(u._id)) || {};
    return {
      id: String(u._id),
      name: u.name,
      done: s.done || 0,
      learning: s.learning || 0,
      lastActive: s.lastActive || null,
      isMe: String(u._id) === req.userId,
    };
  });
  list.sort((a, b) => b.done - a.done || b.learning - a.learning || a.name.localeCompare(b.name));
  res.json(list);
});

// Another user's progress, read-only and without notes.
router.get("/:id/progress", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "User not found" });
  const user = await User.findById(req.params.id, "name").lean();
  if (!user) return res.status(404).json({ error: "User not found" });
  const docs = await Progress.find({ userId: user._id, status: { $in: ["learning", "done"] } }, "slug status statusAt").lean();
  res.json({
    user: { id: String(user._id), name: user.name },
    progress: Object.fromEntries(docs.map((d) => [d.slug, { status: d.status, at: d.statusAt }])),
  });
});

module.exports = router;
