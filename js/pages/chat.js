import { demo, init, money, route, status } from "./ui.js?v=engagement-2";
import {
  $,
  services,
  dateTime,
  showBookingContext,
  isParticipant,
  loginRequired,
} from "./consultation-ui.js?v=engagement-2";
init();
const id = new URLSearchParams(location.search).get("id");
const messages = new Map();
let api,
  me,
  booking,
  unsub = () => {},
  timer = null,
  poll = null,
  version = 0,
  sending = false,
  completing = false,
  uncertain = false,
  loading = false,
  refreshing = false;
function stop() {
  try {
    const pending = unsub();
    pending?.catch?.(() => {});
  } catch {
    /* Cleanup must not block leaving a room. */
  }
  unsub = () => {};
  clearInterval(timer);
  clearInterval(poll);
  timer = null;
  poll = null;
}
function chatWindow() {
  if (!booking || typeof api?.getChatWindow !== "function") return null;
  try {
    return api.getChatWindow(booking);
  } catch {
    return null;
  }
}
function allowed() {
  return booking?.status === "confirmed" && chatWindow()?.state === "open";
}
function update() {
  if (!booking) return;
  const windowState = chatWindow();
  $("chat-window").textContent =
    windowState?.message ||
    "채팅 시간 안내를 준비 중이에요. 지금은 대화 내역만 볼 수 있어요.";
  $("chat-input").disabled = !allowed() || sending || completing;
  $("chat-send").disabled =
    !allowed() || sending || completing || !$("chat-input").value.trim();
  $("chat-send").textContent = sending ? "전송 중…" : "전송";
  const youth = booking.youth_id === me.id;
  $("chat-complete").hidden = booking.status !== "confirmed" || !youth;
  $("chat-complete").disabled =
    completing ||
    sending ||
    uncertain ||
    !(Date.now() >= new Date(booking.slot?.start_at).getTime());
  $("chat-report").hidden = booking.status !== "completed";
  $("chat-report").href = route("report.html", { id });
  $("chat-refresh").disabled = refreshing || loading || completing;
}
function latest() {
  $("chat-messages").lastElementChild?.scrollIntoView({
    block: "nearest",
    behavior: "smooth",
  });
  $("chat-latest").hidden = true;
}
function renderMessages(force = false) {
  const nearBottom =
    window.innerHeight + window.scrollY >=
    document.documentElement.scrollHeight - 250;
  const rows = [...messages.values()].sort(
    (a, b) =>
      new Date(a.created_at) - new Date(b.created_at) ||
      String(a.id).localeCompare(String(b.id)),
  );
  $("chat-messages").replaceChildren(
    ...rows.map((m) => {
      const item = document.createElement("article");
      item.className = `consultation-message${m.sender_id === me.id ? " is-mine" : ""}`;
      const meta = document.createElement("small");
      meta.textContent = `${m.sender_id === me.id ? "나" : "상담 상대"} · ${dateTime(m.created_at)}`;
      const text = document.createElement("p");
      text.textContent = m.content;
      item.append(meta, text);
      return item;
    }),
  );
  $("chat-empty").hidden = rows.length > 0;
  if (force || nearBottom) latest();
  else $("chat-latest").hidden = false;
}
function mergeMessage(message) {
  if (!message || message.id == null || typeof message.content !== "string")
    return;
  const existed = messages.has(String(message.id));
  messages.set(String(message.id), message);
  if (!existed) renderMessages(message.sender_id === me.id);
}
async function refresh() {
  if (refreshing || loading || completing || !booking) return;
  refreshing = true;
  update();
  const v = version;
  try {
    const current = await api.getBooking(id);
    if (v !== version) return;
    if (!isParticipant(current, me)) {
      booking = null;
      stop();
      $("chat-content").hidden = true;
      status(
        "chat-load",
        "상담을 확인할 수 없어요. 내 상담에서 다시 선택해주세요.",
      );
      return;
    }
    booking = current;
    showBookingContext(booking, me, "chat");
    const rows = await api.getMessages(id);
    if (v !== version) return;
    rows.forEach((m) => {
      if (m?.id != null) messages.set(String(m.id), m);
    });
    renderMessages();
    status("chat-sync-status", "");
  } catch (e) {
    if (v === version)
      status(
        "chat-sync-status",
        e.message || "대화를 새로 불러오지 못했어요.",
        refresh,
      );
  } finally {
    if (v === version) {
      refreshing = false;
      update();
    }
  }
}
async function load() {
  const v = ++version;
  stop();
  loading = true;
  booking = null;
  refreshing = false;
  $("chat-content").hidden = true;
  status("chat-load", "상담을 불러오고 있어요.");
  if (!id) {
    status(
      "chat-load",
      "선택한 상담이 없어요. 내 상담에서 상담을 선택해주세요.",
    );
    loading = false;
    return;
  }
  try {
    api = await services();
    me = await api.getCurrentUser();
    if (v !== version) return;
    if (!me) {
      loginRequired("chat-load");
      return;
    }
    booking = await api.getBooking(id);
    if (v !== version) return;
    if (!isParticipant(booking, me)) {
      status(
        "chat-load",
        "존재하지 않거나 접근할 수 없는 상담이에요. 내 상담에서 다시 선택해주세요.",
      );
      return;
    }
    uncertain = false;
    messages.clear();
    $("chat-messages").replaceChildren();
    showBookingContext(booking, me, "chat");
    $("chat-content").hidden = false;
    status("chat-load", "");
    // Subscribe first, then merge history: an arriving message must not be lost or duplicated.
    try {
      unsub = api.subscribeMessages(id, (m) => {
        if (v === version) mergeMessage(m);
      });
    } catch {
      status(
        "chat-sync-status",
        "자동 수신을 시작하지 못했어요. 대화 새로 불러오기를 눌러주세요.",
      );
    }
    try {
      const rows = await api.getMessages(id);
      if (v !== version) return;
      rows.forEach((m) => {
        if (m?.id != null) messages.set(String(m.id), m);
      });
      renderMessages(true);
    } catch (e) {
      if (v !== version) return;
      status(
        "chat-sync-status",
        e.message || "지난 대화를 불러오지 못했어요.",
        refresh,
      );
    }
    if (v !== version) return;
    timer = setInterval(update, 1000);
    poll = setInterval(refresh, 30000);
    update();
  } catch (e) {
    if (v === version)
      status("chat-load", e.message || "상담을 불러오지 못했어요.", load);
  } finally {
    if (v === version) {
      loading = false;
      update();
    }
  }
}
$("chat-input").oninput = update;
$("chat-form").onsubmit = async (e) => {
  e.preventDefault();
  const text = $("chat-input").value.trim();
  if (!text || sending || completing || !allowed()) return;
  sending = true;
  update();
  status("chat-send-status", "");
  try {
    const row = await api.sendMessage(id, text);
    mergeMessage(row);
    $("chat-input").value = "";
    status(
      "chat-send-status",
      demo
        ? "예시 메시지를 보냈어요. 실제 상대에게 전송하지 않아요."
        : "메시지를 보냈어요.",
    );
  } catch (e) {
    status(
      "chat-send-status",
      e.message || "전송하지 못했어요. 입력 내용은 유지했어요.",
    );
    await refresh();
  } finally {
    sending = false;
    update();
  }
};
$("chat-refresh").onclick = refresh;
$("chat-latest").onclick = latest;
$("chat-complete").onclick = () => {
  if ($("chat-complete").disabled || booking.youth_id !== me.id) return;
  $("chat-complete-description").textContent =
    `${demo ? "예시 동작이에요. 실제 포인트는 지급되지 않아요.\n" : ""}상담을 완료하면 보관 중인 ${money(booking.price_points)}P가 베테랑에게 지급돼요. 이후 메시지는 읽기만 가능해요. 보고서 화면에서 대화를 정리할 수 있어요.`;
  $("chat-complete-error").textContent = "";
  $("chat-complete-dialog").showModal();
};
$("chat-complete-cancel").onclick = () => $("chat-complete-dialog").close();
$("chat-complete-dialog").addEventListener("cancel", (e) => {
  if (completing) e.preventDefault();
});
$("chat-complete-confirm").onclick = async () => {
  if (
    completing ||
    uncertain ||
    booking?.status !== "confirmed" ||
    booking.youth_id !== me.id
  )
    return;
  completing = true;
  $("chat-complete-confirm").disabled = true;
  $("chat-complete-cancel").disabled = true;
  update();
  try {
    await api.completeBooking(id);
    booking.status = "completed";
    location.href = route("report.html", { id });
  } catch (e) {
    try {
      const current = await api.getBooking(id);
      if (current?.status === "completed") {
        location.href = route("report.html", { id });
        return;
      }
      if (isParticipant(current, me)) booking = current;
      else uncertain = true;
    } catch {
      uncertain = true;
    }
    $("chat-complete-dialog").close();
    status(
      "chat-sync-status",
      uncertain
        ? "완료 상태를 확인하지 못했어요. 다시 확인하기 전에는 완료 요청을 보내지 않아요."
        : e.message || "상담을 완료하지 못했어요.",
      load,
    );
  } finally {
    completing = false;
    $("chat-complete-confirm").disabled = false;
    $("chat-complete-cancel").disabled = false;
    update();
  }
};
window.addEventListener("pagehide", () => {
  version++;
  stop();
});
window.addEventListener("pageshow", (e) => {
  if (e.persisted) load();
});
window.visualViewport?.addEventListener("resize", () => {
  if (document.activeElement === $("chat-input"))
    $("chat-input").scrollIntoView({ block: "nearest" });
});
load();
