import { renderReference } from "./mobile-views.js?v=fix-5";
const demo = new URLSearchParams(location.search).get("demo") === "1";
if (renderReference({ live: !demo }) && !demo) {
  const { startApp } = await import("./mobile-app.js?v=fix-3");
  await startApp();
}
