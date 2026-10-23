import { renderReference } from "./mobile-views.js?v=approved-home-1";
const demo = new URLSearchParams(location.search).get("demo") === "1";
if (renderReference({ live: !demo }) && !demo) {
  const { startApp } = await import("./mobile-app.js?v=approved-home-1");
  await startApp();
}
