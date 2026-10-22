const $ = (id) => document.getElementById(id);
const setMsg = (text) => { $("msg").textContent = text; };
const TOTAL = TRACKED_SLUGS.size;

function ago(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

async function showView() {
  const { baseUrl, token, userName, lastSync } = await chrome.storage.local.get(["baseUrl", "token", "userName", "lastSync"]);
  const loggedIn = !!(baseUrl && token);
  $("loginView").hidden = loggedIn;
  $("mainView").hidden = !loggedIn;
  $("dot").classList.toggle("on", loggedIn);
  $("status").textContent = loggedIn ? "Syncing automatically" : "Not connected";
  if (baseUrl) $("url").value = baseUrl;
  if (!loggedIn) return;

  $("who").textContent = userName || "";
  if (lastSync) {
    $("last").textContent = `${lastSync.slug} → ${lastSync.status === "done" ? "done ✅" : "in progress 🟠"} · ${ago(lastSync.at)}`;
  }
  loadStats(baseUrl, token);
  showCurrentPage();
}

async function loadStats(baseUrl, token) {
  try {
    const res = await fetch(baseUrl + "/api/progress", { headers: { Authorization: "Bearer " + token } });
    if (res.status === 401) {
      await chrome.storage.local.remove("token");
      return showView();
    }
    if (!res.ok) throw new Error();
    const data = await res.json();
    const entries = Object.entries(data).filter(([slug]) => TRACKED_SLUGS.has(slug));
    const done = entries.filter(([, p]) => p.status === "done").length;
    const learning = entries.filter(([, p]) => p.status === "learning").length;
    const pct = Math.round((done / TOTAL) * 100);
    $("pct").textContent = pct + "%";
    $("bar").style.width = pct + "%";
    $("doneCount").textContent = `${done} / ${TOTAL} lessons done`;
    $("learnCount").textContent = learning ? `${learning} in progress` : "";
    setMsg("");
    window.__progress = data;
    showCurrentPage();
  } catch {
    setMsg("Couldn't load your progress. If the server was idle, wait ~30s and reopen.");
  }
}

// If the active tab is a tracked lesson, show its status.
async function showCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab.url);
    if (url.hostname !== "javascript.info") return;
    const slug = url.pathname.replace(/^\/|\/$/g, "");
    if (!TRACKED_SLUGS.has(slug)) return;
    const status = window.__progress?.[slug]?.status;
    $("nowCard").hidden = false;
    $("nowCard").classList.toggle("done", status === "done");
    $("nowText").textContent = `${slug} — ${status === "done" ? "completed ✅" : "will be marked done when you click Next"}`;
  } catch { /* no tab access: skip */ }
}

$("loginView").addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");
  let origin;
  try { origin = new URL($("url").value.trim()).origin; } catch { return setMsg("Enter a valid tracker URL."); }
  if (!$("email").value || !$("password").value) return setMsg("Enter your email and password.");

  $("loginBtn").disabled = true;
  $("loginBtn").textContent = "Connecting…";
  try {
    // Must be called straight from the click so Chrome allows the permission prompt.
    const granted = await chrome.permissions.request({ origins: [origin + "/*"] });
    if (!granted) return setMsg("Permission to reach your tracker was denied.");

    const res = await fetch(origin + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: $("email").value, password: $("password").value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data.error || "Login failed.");

    await chrome.storage.local.set({ baseUrl: origin, token: data.token, userName: data.user.name });
    $("password").value = "";
    chrome.action.setBadgeText({ text: "" });
    showView();
  } catch {
    setMsg("Couldn't reach the tracker. On Render's free plan, wait ~30s and try again.");
  } finally {
    $("loginBtn").disabled = false;
    $("loginBtn").textContent = "Log in";
  }
});

$("togglePw").addEventListener("click", () => {
  const show = $("password").type === "password";
  $("password").type = show ? "text" : "password";
  $("togglePw").textContent = show ? "Hide" : "Show";
});
$("logout").addEventListener("click", async () => {
  await chrome.storage.local.remove(["token", "userName", "lastSync"]);
  showView();
});
$("open").addEventListener("click", async () => {
  const { baseUrl } = await chrome.storage.local.get("baseUrl");
  chrome.tabs.create({ url: baseUrl + "/index.html" });
});

showView();
