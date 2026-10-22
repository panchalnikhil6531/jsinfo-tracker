// Talks to the tracker API. The token and tracker URL are saved by the popup after login.
async function call(path, options = {}) {
  const { baseUrl, token } = await chrome.storage.local.get(["baseUrl", "token"]);
  if (!baseUrl || !token) throw new Error("not-logged-in");
  const res = await fetch(baseUrl + "/api" + path, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
  });
  if (res.status === 401) {
    await chrome.storage.local.remove("token");
    throw new Error("not-logged-in");
  }
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

const put = (slug, status) => call("/progress/" + slug, { method: "PUT", body: JSON.stringify({ status }) });

async function handle({ type, slug }, tabId) {
  try {
    if (type === "done") {
      await put(slug, "done");
      await chrome.storage.local.set({ lastSync: { slug, status: "done", at: Date.now() } });
    } else if (type === "visit") {
      const mine = await call("/progress");
      if (mine[slug]?.status !== "done") {
        await put(slug, "learning");
        await chrome.storage.local.set({ lastSync: { slug, status: "learning", at: Date.now() } });
      }
    }
    chrome.action.setBadgeText({ text: "", tabId });
  } catch (e) {
    // "!" on the toolbar icon means: log in again or check the connection.
    chrome.action.setBadgeBackgroundColor({ color: "#c0392b" });
    chrome.action.setBadgeText({ text: "!", tabId });
  }
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  handle(msg, sender.tab?.id);
});
