// Progress shape: { [slug]: { status: "learning" | "done", at: ISO date, note?: string } }
// Progress lives on the server (per logged-in user); this object is the local copy.
if (!requireLogin()) throw new Error("not logged in");
renderNav("me");

let progress = {};
const openChapters = new Set(); // chapter keys the user has expanded (survives re-render)

const $ = (id) => document.getElementById(id);
const content = $("content");

// Send one lesson's change to the server. Errors are shown in a banner; the local copy stays as-is.
function sync(slug, body) {
  api("/progress/" + slug, { method: "PUT", body })
    .then(() => showError(""))
    .catch((e) => showError("Couldn't save: " + e.message));
}
function showError(msg) {
  const box = $("errorBox");
  box.hidden = !msg;
  box.textContent = msg;
}
const statusOf = (slug) => progress[slug]?.status || "todo";

function setStatus(slug, status, redraw = true) {
  const prev = progress[slug] || {};
  if (status === "todo" && !prev.note) delete progress[slug];
  else progress[slug] = { ...prev, status, at: new Date().toISOString() };
  if (status === "todo" && progress[slug]) delete progress[slug].status;
  sync(slug, { status });
  if (redraw) render();
}

function setNote(slug, note) {
  const prev = progress[slug] || {};
  progress[slug] = { ...prev, note };
  if (!note) delete progress[slug].note;
  if (!progress[slug].status && !progress[slug].note) delete progress[slug];
  clearTimeout(noteTimers[slug]);
  noteTimers[slug] = setTimeout(() => sync(slug, { note }), 600); // debounce typing
}
const noteTimers = {};

// ---------- stats ----------
function allLessons() {
  return CURRICULUM.flatMap((p) => p.chapters.flatMap((c) => c.lessons));
}
function countDone(lessons) {
  return lessons.filter(([, slug]) => statusOf(slug) === "done").length;
}
function streak() {
  const days = new Set(
    Object.values(progress).filter((p) => p.status === "done" && p.at).map((p) => localDay(new Date(p.at)))
  );
  let n = 0;
  const d = new Date();
  if (!days.has(localDay(d))) d.setDate(d.getDate() - 1); // today may not be done yet
  while (days.has(localDay(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
const localDay = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

function doneDates() {
  return Object.values(progress).filter((p) => p.status === "done" && p.at).map((p) => new Date(p.at));
}
const dayNum = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5;
function bestStreak() {
  const days = [...new Set(doneDates().map(dayNum))].sort((x, y) => x - y);
  let best = 0, run = 0;
  days.forEach((d, i) => { run = i && d === days[i - 1] + 1 ? run + 1 : 1; best = Math.max(best, run); });
  return best;
}

function renderStats(total, done) {
  const dates = doneDates();
  const now = Date.now();
  const inRange = (days) => dates.filter((d) => now - d < days * 864e5).length;
  const learning = total.filter(([, s]) => statusOf(s) === "learning").length;
  const remaining = total.length - done;
  const perDay = inRange(14) / 14;
  const eta = remaining && perDay ? Math.ceil(remaining / perDay) : null;
  const cards = [
    ["Completed", done], ["In progress", learning], ["This week", inRange(7)],
    ["Streak", streak() + "d"], ["Best streak", bestStreak() + "d"],
    ["Finish in", remaining === 0 ? "Done 🎉" : eta ? `~${eta}d` : "—"],
  ];
  const grid = $("statsGrid");
  grid.textContent = "";
  cards.forEach(([label, val]) => grid.append(el("div", "statcard", [el("b", "", String(val)), el("span", "", label)])));
  grid.lastChild.title = "Estimate at your pace over the last 14 days";

  // Heatmap: 15 weeks x 7 days, columns are weeks (Sun-Sat), newest on the right.
  const counts = {};
  dates.forEach((d) => { const k = localDay(d); counts[k] = (counts[k] || 0) + 1; });
  const hm = $("heatmap");
  hm.textContent = "";
  const today = new Date();
  for (let i = 0; i < 15 * 7; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() - 14 * 7 + i);
    const cell = el("i", "cell");
    if (d > today) cell.style.visibility = "hidden";
    const n = counts[localDay(d)] || 0;
    cell.dataset.l = n === 0 ? 0 : n < 2 ? 1 : n < 4 ? 2 : n < 7 ? 3 : 4;
    cell.title = `${d.toLocaleDateString()}: ${n} lesson${n === 1 ? "" : "s"}`;
    hm.append(cell);
  }
}

// ---------- render ----------
function render() {
  const q = $("search").value.trim().toLowerCase();
  const filter = $("filter").value;
  const matches = ([title, slug]) =>
    (!q || title.toLowerCase().includes(q)) &&
    (filter === "all" || (filter === "notes" ? !!progress[slug]?.note : statusOf(slug) === filter));

  const total = allLessons();
  const done = countDone(total);
  const pct = total.length ? Math.round((done / total.length) * 100) : 0;
  $("overallBar").style.width = pct + "%";
  $("overallText").textContent = `${done} / ${total.length} lessons completed (${pct}%)`;
  const s = streak();
  $("streakText").textContent = s ? `🔥 ${s}-day streak` : "";

  renderContinue(total);
  renderStats(total, done);

  content.textContent = "";
  let shown = 0;
  CURRICULUM.forEach((part, pi) => {
    const partEl = el("section", "part");
    const partLessons = part.chapters.flatMap((c) => c.lessons);
    const pd = countDone(partLessons);
    partEl.append(el("h2", "", [part.part, el("small", "", `${pd}/${partLessons.length}`)]));
    const pbar = el("div", "bar thin", [el("div")]);
    pbar.firstChild.style.width = (pd / partLessons.length) * 100 + "%";
    partEl.append(pbar);

    part.chapters.forEach((ch, ci) => {
      const visible = ch.lessons.filter(matches);
      if (!visible.length) return;
      shown += visible.length;
      partEl.append(chapterEl(`${pi}-${ci}`, ch, visible, !!q || filter !== "all"));
    });
    if (partEl.querySelector(".chapter")) content.append(partEl);
  });
  if (!shown) content.append(el("p", "empty", "No lessons match."));
}

function renderContinue(total) {
  const box = $("continueBox");
  const next = total.find(([, slug]) => statusOf(slug) === "learning") || total.find(([, slug]) => statusOf(slug) === "todo");
  if (!next) { box.hidden = false; box.textContent = "🎉 You've completed every lesson!"; return; }
  const learning = statusOf(next[1]) === "learning";
  box.hidden = false;
  box.textContent = "";
  box.append(
    el("span", "", learning ? "Continue where you left off:" : "Up next:"),
    Object.assign(el("a", "", next[0]), { href: BASE_URL + next[1], target: "_blank", rel: "noopener" })
  );
}

function chapterEl(key, ch, visible, forceOpen) {
  const d = el("details", "chapter");
  d.open = forceOpen || openChapters.has(key);
  d.addEventListener("toggle", () => (d.open ? openChapters.add(key) : openChapters.delete(key)));

  const done = countDone(ch.lessons);
  const mini = el("div", "mini", [Object.assign(el("div"), {})]);
  mini.firstChild.style.width = (done / ch.lessons.length) * 100 + "%";
  const allDone = done === ch.lessons.length;
  const markAll = el("button", "mark-all", allDone ? "Undo all" : "Mark all done");
  markAll.type = "button";
  markAll.addEventListener("click", (e) => {
    e.preventDefault(); // don't toggle the <details>
    const target = allDone ? "todo" : "done";
    if (!confirm(`${allDone ? "Clear" : "Complete"} all ${ch.lessons.length} lessons in "${ch.title}"?`)) return;
    ch.lessons.forEach(([, slug]) => { if (statusOf(slug) !== target) setStatus(slug, target, false); });
    render();
  });
  d.append(el("summary", "", [el("span", "ch-title", ch.title), mini, el("span", "ch-count", `${done}/${ch.lessons.length}`), markAll]));

  const ul = el("ul", "lessons");
  visible.forEach(([title, slug]) => ul.append(...lessonEl(title, slug)));
  d.append(ul);
  return d;
}

function lessonEl(title, slug) {
  const status = statusOf(slug);
  const li = el("li", `lesson ${status}`);

  const cb = Object.assign(el("input"), { type: "checkbox", checked: status === "done" });
  cb.setAttribute("aria-label", `Mark "${title}" complete`);
  cb.addEventListener("change", () => setStatus(slug, cb.checked ? "done" : "todo"));

  const link = Object.assign(el("a", "", title), { href: BASE_URL + slug, target: "_blank", rel: "noopener" });
  // Opening a lesson that hasn't been started marks it "in progress".
  link.addEventListener("click", () => { if (statusOf(slug) === "todo") setTimeout(() => setStatus(slug, "learning"), 0); });

  const sel = el("select");
  [["todo", "Not started"], ["learning", "In progress"], ["done", "Done"]].forEach(([v, t]) => {
    sel.append(Object.assign(el("option"), { value: v, textContent: t, selected: v === status }));
  });
  sel.addEventListener("change", () => setStatus(slug, sel.value));

  const hasNote = !!progress[slug]?.note;
  const noteBtn = el("button", "note-btn" + (hasNote ? " has" : ""), "📝");
  noteBtn.title = "Notes";
  li.append(cb, link, sel, noteBtn);

  const ta = Object.assign(el("textarea", "note"), { rows: 2, placeholder: "Notes…", value: progress[slug]?.note || "", hidden: !hasNote });
  ta.addEventListener("input", () => { setNote(slug, ta.value.trim()); noteBtn.classList.toggle("has", !!ta.value.trim()); });
  noteBtn.addEventListener("click", () => { ta.hidden = !ta.hidden; if (!ta.hidden) ta.focus(); });

  return [li, ta];
}

function el(tag, cls = "", children) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (typeof children === "string") e.textContent = children;
  else if (children) e.append(...children);
  return e;
}

// ---------- controls ----------
$("search").addEventListener("input", render);
$("filter").addEventListener("change", render);
$("expandAll").addEventListener("click", () => {
  CURRICULUM.forEach((p, pi) => p.chapters.forEach((_, ci) => openChapters.add(`${pi}-${ci}`)));
  render();
});
$("collapseAll").addEventListener("click", () => { openChapters.clear(); render(); });

$("exportBtn").addEventListener("click", () => {
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([JSON.stringify(progress, null, 2)], { type: "application/json" })),
    download: "jsinfo-progress.json",
  });
  a.click();
  URL.revokeObjectURL(a.href);
});
$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const known = new Set(allLessons().map(([, s]) => s));
    const entries = Object.entries(data).filter(([slug, p]) => known.has(slug) && p && typeof p === "object");
    if (!entries.length) throw new Error("no matching lessons in file");
    if (!confirm(`Import ${entries.length} lessons? This overwrites matching lessons.`)) return;
    for (const [slug, p] of entries) {
      const body = {};
      if (["learning", "done"].includes(p.status)) body.status = p.status;
      if (typeof p.note === "string") body.note = p.note;
      if (Object.keys(body).length) await api("/progress/" + slug, { method: "PUT", body });
    }
    progress = await api("/progress");
    showError("");
    render();
  } catch (err) { showError("Import failed: " + err.message); }
});

document.addEventListener("keydown", (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if (e.key === "/" && !typing) { e.preventDefault(); $("search").focus(); }
  else if (e.key === "Escape" && document.activeElement === $("search")) { $("search").value = ""; $("search").blur(); render(); }
});

$("resetBtn").addEventListener("click", async () => {
  if (!confirm("Erase all your progress and notes? This can't be undone.")) return;
  try {
    await api("/progress", { method: "DELETE" });
    progress = {};
    showError("");
    render();
  } catch (e) { showError("Couldn't reset: " + e.message); }
});

$("deleteBtn").addEventListener("click", async () => {
  if (!confirm("Permanently delete your account and all its progress?")) return;
  const password = prompt("Enter your password to confirm:");
  if (password === null) return;
  try {
    await api("/auth/me", { method: "DELETE", body: { password } });
    Auth.clear();
    location.href = "login.html";
  } catch (e) { showError("Couldn't delete account: " + e.message); }
});

$("themeBtn").addEventListener("click", () => window.toggleTheme());

api("/progress")
  .then((data) => {
    progress = data;
    // Start with the chapter holding the next lesson expanded.
    const next = allLessons().find(([, s]) => statusOf(s) !== "done");
    CURRICULUM.forEach((p, pi) => p.chapters.forEach((c, ci) => {
      if (next && c.lessons.some(([, s]) => s === next[1])) openChapters.add(`${pi}-${ci}`);
    }));
  })
  .catch((e) => showError("Couldn't load your progress: " + e.message))
  .finally(render);
