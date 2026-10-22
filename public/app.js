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

function setStatus(slug, status) {
  const prev = progress[slug] || {};
  if (status === "todo" && !prev.note) delete progress[slug];
  else progress[slug] = { ...prev, status, at: new Date().toISOString() };
  if (status === "todo" && progress[slug]) delete progress[slug].status;
  sync(slug, { status });
  render();
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

// ---------- render ----------
function render() {
  const q = $("search").value.trim().toLowerCase();
  const filter = $("filter").value;
  const matches = ([title, slug]) =>
    (!q || title.toLowerCase().includes(q)) && (filter === "all" || statusOf(slug) === filter);

  const total = allLessons();
  const done = countDone(total);
  const pct = total.length ? Math.round((done / total.length) * 100) : 0;
  $("overallBar").style.width = pct + "%";
  $("overallText").textContent = `${done} / ${total.length} lessons completed (${pct}%)`;
  const s = streak();
  $("streakText").textContent = s ? `🔥 ${s}-day streak` : "";

  renderContinue(total);

  content.textContent = "";
  let shown = 0;
  CURRICULUM.forEach((part, pi) => {
    const partEl = el("section", "part");
    const partLessons = part.chapters.flatMap((c) => c.lessons);
    partEl.append(el("h2", "", [part.part, el("small", "", `${countDone(partLessons)}/${partLessons.length}`)]));

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
  d.append(el("summary", "", [el("span", "ch-title", ch.title), mini, el("span", "ch-count", `${done}/${ch.lessons.length}`)]));

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
  .then((data) => { progress = data; })
  .catch((e) => showError("Couldn't load your progress: " + e.message))
  .finally(render);
