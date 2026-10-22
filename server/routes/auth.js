const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Progress = require("../models/Progress");
const { requireAuth } = require("../middleware");

const router = express.Router();

const sign = (user) => jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "30d" });
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (typeof name !== "string" || name.trim().length < 2) return res.status(400).json({ error: "Name must be at least 2 characters" });
  if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "Enter a valid email" });
  if (typeof password !== "string" || password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

  if (await User.exists({ email: email.toLowerCase().trim() })) return res.status(409).json({ error: "Email already registered" });
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10) });
  res.status(201).json({ token: sign(user), user: publicUser(user) });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = typeof email === "string" && typeof password === "string" && (await User.findOne({ email: email.toLowerCase().trim() }));
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: "Wrong email or password" });
  res.json({ token: sign(user), user: publicUser(user) });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: "Account no longer exists" });
  res.json({ user: publicUser(user) });
});

// Delete the account and all its progress. Requires the password again.
router.delete("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  const { password } = req.body || {};
  if (!user) return res.status(401).json({ error: "Account no longer exists" });
  if (typeof password !== "string" || !(await bcrypt.compare(password, user.passwordHash))) return res.status(403).json({ error: "Wrong password" });
  await Progress.deleteMany({ userId: user._id });
  await user.deleteOne();
  res.json({});
});

module.exports = router;
