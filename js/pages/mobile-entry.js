import { renderReference } from "./mobile-views.js?v=bell-1";
const demo = new URLSearchParams(location.search).get("demo") === "1";
if (renderReference({ live: !demo }) && !demo) {
  const { startApp } = await import("./mobile-app.js?v=recent-pills-1");
  await startApp();
}
