import { demo, money, notice, status, init, goLogin, route } from "./ui.js";
init();
const $ = (id) => document.getElementById(id);
const bookingId = Number(new URLSearchParams(location.search).get("id"));

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const kst = (value, options) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", ...options }).format(new Date(value));
const dayKey = (value) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(value));
const dayTitle = (value) => {
  const d = new Date(`${dayKey(value)}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAYS[d.getUTCDay()]})`;
};
const hm = (value) => kst(value, { hour: "2-digit", minute: "2-digit", hour12: false });
const when = (slot) => `${dayTitle(slot.start_at)} ${hm(slot.start_at)} ~ ${hm(slot.end_at)}`;

const STATE = { confirmed: "예약됨", completed: "상담 완료", cancelled: "취소됨", no_show: "노쇼 처리됨" };
const MAX = 2;

let api = null;
let booking = null;
let me = null;
let busy = false;
let onConfirm = null;

// ---------- 데모 ----------
const hours = (h) => new Date(Date.now() + h * 36e5);
const at = (days, hh) => {
  const key = dayKey(Date.now() + days * 864e5);
  return new Date(`${key}T${hh}:00+09:00`);
};
const DEMO_ME = { id: "youth" };
const DEMO_BOOKING = {
  id: 0,
  youth_id: "youth",
  expert_id: "expert",
  status: "confirmed",
  topic: "첫 양산 계약 단가 조항 검토",
  price_points: 3000,
  reschedule_count: 0,
  slot: { start_at: hours(26).toISOString(), end_at: hours(27).toISOString() },
  youth: { name: "김대표" },
  expert: { profiles: { name: "이정훈" } },
};
const DEMO_SLOTS = [2, 3, 5].flatMap((d) =>
  ["14:00", "19:00"].map((t, i) => {
    const start = at(d, t);
    return { id: d * 10 + i, start_at: start.toISOString(), end_at: new Date(start.getTime() + 36e5).toISOString() };
  }),
);

// ---------- 그리기 ----------
function render(slots = []) {
  const isYouth = booking.youth_id === me.id;
  const other = isYouth ? booking.expert?.profiles?.name ?? "베테랑" : booking.youth?.name ?? "청년 창업가";
  const started = new Date(booking.slot.start_at) <= new Date();
  const active = booking.status === "confirmed" && !started;
  const used = booking.reschedule_count ?? 0;

  $("bm-state").textContent = booking.status === "confirmed" && started ? "진행 중" : STATE[booking.status] ?? booking.status;
  $("bm-person").textContent = `${other}님과의 상담`;
  $("bm-when").textContent = when(booking.slot);
  $("bm-topic").textContent = booking.topic;
  $("bm-points").textContent = booking.status === "confirmed" ? `${money(booking.price_points)}P` : "-";
  $("bm-count").textContent = `${used} / ${MAX}회`;
  $("bm-chat").href = route("chat.html", { id: demo ? "demo-active" : booking.id });

  $("bm-locked").hidden = active;
  if (!active) {
    $("bm-locked").textContent =
      booking.status !== "confirmed"
        ? "진행 중인 예약만 시간을 바꾸거나 취소할 수 있어요."
        : "상담이 이미 시작돼서 시간을 바꾸거나 취소할 수 없어요.";
  }
  $("bm-expert-hint").hidden = !(active && !isYouth);
  $("bm-cancel-box").hidden = !active;
  $("bm-cancel-hint").textContent = isYouth
    ? `상담 시작 전이라 ${money(booking.price_points)}P가 전액 환불돼요.`
    : `청년에게 ${money(booking.price_points)}P가 모두 환불되고, 이 시간은 다시 예약을 받을 수 있어요.`;

  const canMove = active && isYouth;
  $("bm-move").hidden = !canMove;
  if (!canMove) return;
  if (used >= MAX) {
    $("bm-slots").replaceChildren();
    $("bm-slots-empty").hidden = false;
    $("bm-slots-empty").textContent = `일정은 한 예약당 ${MAX}번까지 바꿀 수 있어요. 다른 시간이 필요하면 취소 후 다시 예약해 주세요.`;
    return;
  }
  const byDay = new Map();
  for (const s of slots) {
    if (!byDay.has(dayKey(s.start_at))) byDay.set(dayKey(s.start_at), []);
    byDay.get(dayKey(s.start_at)).push(s);
  }
  $("bm-slots-empty").hidden = byDay.size > 0;
  $("bm-slots").replaceChildren(
    ...[...byDay.values()].map((list) => {
      const box = document.createElement("div");
      box.className = "bm-day";
      const h = document.createElement("h3");
      h.textContent = dayTitle(list[0].start_at);
      const times = document.createElement("div");
      times.className = "bm-times";
      times.append(
        ...list.map((s) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = hm(s.start_at);
          b.setAttribute("aria-label", `${when(s)} 시간으로 바꾸기`);
          b.onclick = () => askMove(s);
          return b;
        }),
      );
      box.append(h, times);
      return box;
    }),
  );
}

// ---------- 확인 모달 ----------
function ask(title, text, okLabel, action) {
  $("bm-confirm-title").textContent = title;
  $("bm-confirm-text").textContent = text;
  $("bm-confirm-ok").textContent = okLabel;
  onConfirm = action;
  $("bm-confirm").showModal();
}
$("bm-confirm-cancel").onclick = () => $("bm-confirm").close();
$("bm-confirm-ok").onclick = async () => {
  if (busy || !onConfirm) return;
  busy = true;
  $("bm-confirm-ok").disabled = true;
  try {
    await onConfirm();
  } catch (e) {
    status("bm-action-status", e.message || "처리하지 못했어요. 다시 시도해 주세요.");
    await load(false);
  } finally {
    $("bm-confirm").close();
    $("bm-confirm-ok").disabled = false;
    busy = false;
    onConfirm = null;
  }
};

function askMove(slot) {
  const left = MAX - (booking.reschedule_count ?? 0) - 1;
  ask(
    "이 시간으로 바꿀까요?",
    `${when(booking.slot)}\n→ ${when(slot)}\n\n베테랑에게 알림이 가요. 바꾼 뒤 남은 변경 횟수: ${left}회`,
    "바꾸기",
    async () => {
      if (demo) return notice("예시 화면", "실제 서비스에서는 상담 시간이 바뀌고 베테랑에게 알림이 가요.");
      await api.rescheduleBooking(booking.id, slot.id);
      await load(false);
      status("bm-action-status", `상담 시간을 바꿨어요: ${when(slot)}`);
    },
  );
}

$("bm-cancel").onclick = () =>
  ask(
    "예약을 취소할까요?",
    `${when(booking.slot)}\n취소하면 되돌릴 수 없어요.`,
    "취소하기",
    async () => {
      if (demo) return notice("예시 화면", "실제 서비스에서는 예약이 취소되고 포인트가 환불돼요.");
      await api.cancelBooking(booking.id);
      await load(false);
      status("bm-action-status", `예약을 취소했어요. ${money(booking.price_points)}P가 환불됐어요.`);
    },
  );

// ---------- 불러오기 ----------
async function load(showLoading = true) {
  if (showLoading) status("bm-status", "예약을 불러오고 있어요.");
  if (demo) {
    me = DEMO_ME;
    booking = DEMO_BOOKING;
    render(DEMO_SLOTS);
    $("bm-content").hidden = false;
    status("bm-status", "");
    return;
  }
  try {
    const auth = await import("../api/auth.js");
    me = await auth.getCurrentUser();
    if (!me) return goLogin();
    if (!bookingId) return status("bm-status", "예약 정보를 찾을 수 없어요. 내 상담에서 다시 골라 주세요.");
    const [bookings, experts] = await Promise.all([import("../api/bookings.js"), import("../api/experts.js")]);
    api = { ...bookings, ...experts };
    booking = await api.getBooking(bookingId);
    if (!booking) return status("bm-status", "예약을 찾을 수 없거나 볼 수 있는 권한이 없어요.");
    const canMove =
      booking.youth_id === me.id && booking.status === "confirmed" && new Date(booking.slot.start_at) > new Date();
    const slots = canMove ? (await api.getSlots(booking.expert_id)).filter((s) => s.id !== booking.slot_id) : [];
    render(slots);
    $("bm-content").hidden = false;
    status("bm-status", "");
  } catch (e) {
    status("bm-status", e.message || "예약을 불러오지 못했어요.", load);
  }
}
load();
