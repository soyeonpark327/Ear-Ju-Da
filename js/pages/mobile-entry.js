import { renderReference } from "./mobile-views.js?v=app-2";
const demo = new URLSearchParams(location.search).get("demo") === "1";
if (renderReference({ live: !demo }) && !demo) {
  const { startApp } = await import("./mobile-app.js?v=app-2");
  await startApp();
}
