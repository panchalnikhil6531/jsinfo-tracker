// Shared by every page: token storage, fetch wrapper, and the top navigation bar.
const TOKEN_KEY = "jsinfo-tracker-token";
const USER_KEY = "jsinfo-tracker-user";

const Auth = {
  get token() { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  get user() { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } },
  set(token, user) {
    try { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch {}
  },
  clear() {
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch {}
  },
  logout() { Auth.clear(); location.href = "login.html"; },
};

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch("/api" + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(Auth.token ? { Authorization: "Bearer " + Auth.token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !location.pathname.endsWith("login.html")) {
    Auth.logout();
    throw new Error(data.error || "Please log in");
  }
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// Call at the top of every protected page.
function requireLogin() {
  if (!Auth.token) { location.replace("login.html"); return false; }
  return true;
}

function renderNav(active) {
  const nav = document.getElementById("nav");
  if (!nav) return;
  const link = (href, text, key) => `<a href="${href}"${active === key ? ' class="active"' : ""}>${text}</a>`;
  nav.innerHTML =
    link("index.html", "My progress", "me") +
    link("community.html", "Community", "community") +
    `<span class="who"></span><button type="button" id="logoutBtn">Log out</button>`;
  nav.querySelector(".who").textContent = Auth.user?.name || "";
  document.getElementById("logoutBtn").addEventListener("click", Auth.logout);
}

// Theme is shared across pages.
const THEME_KEY = "jsinfo-tracker-theme";
(function initTheme() {
  let theme = null;
  try { theme = localStorage.getItem(THEME_KEY); } catch {}
  theme = theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
  window.toggleTheme = () => {
    theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  };
})();
