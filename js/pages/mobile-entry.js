import { renderReference } from "./mobile-views.js?v=portraits-1";
const demo = new URLSearchParams(location.search).get("demo") === "1";
if (renderReference({ live: !demo }) && !demo) {
  const { startApp } = await import("./mobile-app.js?v=portraits-1");
  await startApp();
}
