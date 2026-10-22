const $ = (id) => document.getElementById(id);
const setMsg = (text) => { $("msg").textContent = text; };

async function refresh() {
  const { baseUrl, token, userName, lastSync } = await chrome.storage.local.get(["baseUrl", "token", "userName", "lastSync"]);
  const loggedIn = !!(baseUrl && token);
  $("loginView").hidden = loggedIn;
  $("mainView").hidden = !loggedIn;
  if (baseUrl) $("url").value = baseUrl;
  if (loggedIn) {
    $("who").textContent = userName || "";
    $("last").textContent = lastSync
      ? `Last sync: ${lastSync.slug} → ${lastSync.status === "done" ? "done ✅" : "in progress"}`
      : "Open a javascript.info lesson to start tracking.";
  }
}

$("loginView").addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");
  let origin;
  try { origin = new URL($("url").value.trim()).origin; } catch { return setMsg("Enter a valid URL"); }
  try {
    // Must run directly from the click so Chrome allows the permission prompt.
    const granted = await chrome.permissions.request({ origins: [origin + "/*"] });
    if (!granted) return setMsg("Permission to reach your tracker was denied");

    const res = await fetch(origin + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: $("email").value, password: $("password").value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data.error || "Login failed");

    await chrome.storage.local.set({ baseUrl: origin, token: data.token, userName: data.user.name });
    $("password").value = "";
    chrome.action.setBadgeText({ text: "" });
    refresh();
  } catch {
    setMsg("Couldn't reach the tracker. On Render's free plan, wait 30s and retry.");
  }
});

$("logout").addEventListener("click", async () => {
  await chrome.storage.local.remove(["token", "userName", "lastSync"]);
  refresh();
});
$("open").addEventListener("click", async () => {
  const { baseUrl } = await chrome.storage.local.get("baseUrl");
  chrome.tabs.create({ url: baseUrl + "/index.html" });
});

refresh();
