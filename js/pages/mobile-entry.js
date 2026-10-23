import { renderReference } from "./mobile-views.js?v=home-logo-1";
const demo = new URLSearchParams(location.search).get("demo") === "1";
if (renderReference({ live: !demo }) && !demo) {
  const { startApp } = await import("./mobile-app.js?v=booking-fix-2");
  await startApp();
}
