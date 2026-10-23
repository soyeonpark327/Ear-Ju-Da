import { demo, init, route, status, goLogin } from "./ui.js?v=engagement-2";
init();
const list = document.getElementById("notifications-list"),
  all = document.getElementById("notifications-all");
let api,
  rows = [],
  busy = false;
function destination(n) {
  const data = n.data || {};
  if (n.type?.startsWith("booking_") && data.booking_id != null)
    return route("chat.html", { id: data.booking_id });
  if (n.type === "report_ready" && data.booking_id != null)
    return route("report.html", { id: data.booking_id });
  if (n.type === "note_sold" && data.note_id != null)
    return route("note-detail.html", { id: data.note_id });
  if (n.type === "review_new") return route("expert-dashboard.html");
  if (n.type === "verification_changed") return route("expert-setup.html");
  return null;
}
function render() {
  list.replaceChildren(
    ...rows.map((n) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "notification-entry";
      button.classList.toggle("is-unread", !n.read_at);
      for (const [tag, text] of [
        ["h2", `${!n.read_at ? "안 읽음 · " : ""}${n.title}`],
        ["p", n.body],
        [
          "small",
          new Date(n.created_at).toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul",
          }),
        ],
      ]) {
        const el = document.createElement(tag);
        el.textContent = text;
        button.append(el);
      }
      button.onclick = async () => {
        if (busy) return;
        busy = true;
        button.disabled = true;
        all.disabled = true;
        try {
          await api.markNotificationRead(n.id);
          n.read_at = new Date().toISOString();
          const target = destination(n);
          if (target) location.href = target;
          else {
            render();
            status(
              "notifications-status",
              "알림을 읽었어요. 연결된 화면이 없는 알림이에요.",
            );
          }
        } catch (e) {
          status(
            "notifications-status",
            e.message || "읽음 처리하지 못했어요. 다시 눌러주세요.",
          );
        } finally {
          busy = false;
          button.disabled = false;
          all.disabled = !rows.some((n) => !n.read_at);
        }
      };
      return button;
    }),
  );
  all.disabled = !rows.some((n) => !n.read_at);
  status("notifications-status", rows.length ? "" : "아직 알림이 없어요.");
}
async function load() {
  status("notifications-status", "알림을 불러오고 있어요.");
  all.disabled = true;
  try {
    const auth = demo
      ? await import("./engagement-demo.js")
      : await import("../api/auth.js");
    if (!(await auth.getCurrentUser())) {
      status(
        "notifications-status",
        "로그인하면 알림을 확인할 수 있어요.",
        goLogin,
      );
      return;
    }
    api = demo
      ? await import("./engagement-demo.js")
      : await import("../api/notifications.js");
    rows = await api.getNotifications({ limit: 50 });
    render();
  } catch (e) {
    status(
      "notifications-status",
      e.message || "알림을 불러오지 못했어요.",
      load,
    );
  }
}
all.onclick = async () => {
  if (busy) return;
  busy = true;
  all.disabled = true;
  try {
    await api.markAllNotificationsRead();
    rows.forEach((n) => (n.read_at = n.read_at || new Date().toISOString()));
    render();
  } catch (e) {
    status(
      "notifications-status",
      e.message || "읽음 처리하지 못했어요. 다시 시도해주세요.",
    );
  } finally {
    busy = false;
    all.disabled = !rows.some((n) => !n.read_at);
  }
};
load();
