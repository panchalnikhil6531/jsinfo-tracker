const mongoose = require("mongoose");

// One document per (user, lesson). A lesson with no status and no note has no document.
const progressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    slug: { type: String, required: true, match: /^[a-z0-9-]{1,100}$/ },
    status: { type: String, enum: ["learning", "done"] },
    note: { type: String, maxlength: 5000 },
    statusAt: { type: Date }, // when status last changed (drives streaks / last active)
  },
  { timestamps: true }
);

progressSchema.index({ userId: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model("Progress", progressSchema);
