// End-to-end API check against an in-memory MongoDB. Run: npm test
process.env.JWT_SECRET = "test-secret";
const assert = require("assert");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const createApp = require("./app");

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const server = createApp().listen(0);
  const base = `http://localhost:${server.address().port}/api`;
  const call = async (path, method = "GET", body, token) => {
    const r = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json() };
  };

  try {
    const a = await call("/auth/register", "POST", { name: "Alice", email: "a@x.com", password: "secret1" });
    const b = await call("/auth/register", "POST", { name: "Bob", email: "b@x.com", password: "secret2" });
    assert.equal(a.status, 201); assert.equal(b.status, 201);
    assert.equal((await call("/auth/register", "POST", { name: "Al", email: "A@x.com", password: "secret1" })).status, 409);
    assert.equal((await call("/auth/login", "POST", { email: "a@x.com", password: "nope" })).status, 401);
    const login = await call("/auth/login", "POST", { email: "a@x.com", password: "secret1" });
    assert.equal(login.status, 200);
    const ta = login.data.token, tb = b.data.token;

    assert.equal((await call("/progress")).status, 401);

    await call("/progress/closure", "PUT", { status: "done" }, ta);
    await call("/progress/promise-basics", "PUT", { status: "learning", note: "private note" }, ta);
    await call("/progress/array", "PUT", { status: "done" }, ta);
    await call("/progress/array", "PUT", { status: "todo" }, ta); // cleared
    assert.equal((await call("/progress/Bad Slug", "PUT", { status: "done" }, ta)).status, 400);
    assert.equal((await call("/progress/closure", "PUT", { status: "bogus" }, ta)).status, 400);

    const mine = (await call("/progress", "GET", null, ta)).data;
    assert.equal(mine.closure.status, "done");
    assert.equal(mine["promise-basics"].note, "private note");
    assert.equal(mine.array, undefined);
    assert.deepEqual((await call("/progress", "GET", null, tb)).data, {}); // Bob sees nothing of Alice's

    const board = (await call("/users", "GET", null, tb)).data;
    assert.equal(board[0].name, "Alice"); assert.equal(board[0].done, 1); assert.equal(board[0].learning, 1);
    assert.equal(board[1].isMe, true);
    assert(!JSON.stringify(board).includes("a@x.com"), "emails must not leak");

    const view = (await call(`/users/${a.data.user.id}/progress`, "GET", null, tb)).data;
    assert.equal(view.progress.closure.status, "done");
    assert(!JSON.stringify(view).includes("private note"), "notes must stay private");
    assert.equal((await call("/users/nope/progress", "GET", null, tb)).status, 404);

    // reset and delete
    await call("/progress", "DELETE", null, ta);
    assert.deepEqual((await call("/progress", "GET", null, ta)).data, {});
    await call("/progress/closure", "PUT", { status: "done" }, ta);
    assert.equal((await call("/auth/me", "DELETE", { password: "wrong" }, ta)).status, 403);
    assert.equal((await call("/auth/me", "DELETE", { password: "secret1" }, ta)).status, 200);
    assert.equal((await call("/auth/login", "POST", { email: "a@x.com", password: "secret1" })).status, 401);
    assert.equal(await mongoose.model("Progress").countDocuments({ userId: a.data.user.id }), 0);
    assert.equal((await call("/users", "GET", null, tb)).data.length, 1);

    console.log("All API checks passed");
  } finally {
    server.close(); await mongoose.disconnect(); await mongod.stop();
  }
})().catch((e) => { console.error(e); process.exit(1); });
