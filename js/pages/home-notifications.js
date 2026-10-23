import { demo, route, goLogin, notice } from "./ui.js?v=engagement-2";
export function initNotifications() {
  const bell = document.getElementById("notifications");
  if (!bell) return;
  let api,
    loggedIn = false,
    off = () => {},
    generation = 0,
    request = 0;
  function paint(n) {
    bell.classList.toggle("has-unread", n > 0);
    bell.setAttribute(
      "aria-label",
      n > 0 ? `알림, 안 읽은 알림 ${n}개` : "알림",
    );
  }
  async function count() {
    const seq = ++request;
    try {
      const n = await api.getUnreadCount();
      if (seq === request) paint(n);
    } catch {
      /* Keep the last successful count. */
    }
  }
  bell.onclick = async () => {
    if (demo) {
      location.href = route("notifications.html");
      return;
    }
    try {
      const user = await (await import("../api/auth.js")).getCurrentUser();
      if (user) location.href = route("notifications.html");
      else goLogin();
    } catch {
      notice(
        "알림",
        "로그인 상태를 확인하지 못했어요. 연결을 확인하고 다시 눌러주세요.",
      );
    }
  };
  function stop() {
    generation++;
    request++;
    try {
      Promise.resolve(off()).catch(() => {});
    } catch {}
    off = () => {};
  }
  async function start() {
    stop();
    const v = generation;
    paint(0);
    try {
      const auth = demo
        ? await import("./engagement-demo.js")
        : await import("../api/auth.js");
      loggedIn = !!(await auth.getCurrentUser());
      if (v !== generation || !loggedIn) return;
      api = demo
        ? await import("./engagement-demo.js")
        : await import("../api/notifications.js");
      const unsubscribe = await api.subscribeNotifications(() => count());
      if (v !== generation) {
        unsubscribe();
        return;
      }
      off = unsubscribe;
      await count();
    } catch {
      /* Notification errors must not hide the home screen. */
    }
  }
  window.addEventListener("pagehide", stop);
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) start();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && api && loggedIn) count();
  });
  start();
}
