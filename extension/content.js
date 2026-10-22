// Runs on javascript.info lesson pages.
// - Opening a lesson marks it "in progress" (unless it is already done).
// - Clicking "Next lesson" (or pressing Ctrl+→, the site's shortcut) marks the current lesson done.
(() => {
  const slug = location.pathname.replace(/^\/|\/$/g, "");
  if (!TRACKED_SLUGS.has(slug)) return;

  const send = (type) => chrome.runtime.sendMessage({ type, slug }).catch(() => {});

  send("visit");

  const onNextLink = (e) => e.target.closest && e.target.closest("a.page__nav_next");

  document.addEventListener("click", (e) => {
    if (e.button === 0 && onNextLink(e)) send("done");
  }, true);
  document.addEventListener("auxclick", (e) => { // middle-click opens the next lesson in a new tab
    if (e.button === 1 && onNextLink(e)) send("done");
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "ArrowRight" && document.querySelector("a.page__nav_next")) send("done");
  });
})();
