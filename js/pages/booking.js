import { demo, money, escape, notice, status, init } from "./ui.js";
init();
const $ = (id) => document.getElementById(id),
  params = new URLSearchParams(location.search);
const key = (d) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(d));
const clock = (d) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(d));
const weekday = (d) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    weekday: "long",
  }).format(new Date(d + "T12:00:00+09:00"));
let experts = [],
  expert,
  slots = [],
  date = "",
  slot = null,
  mode = demo ? "call" : "chat",
  points = null,
  busy = false,
  complete = false,
  version = 0;
const price = () =>
  demo ? (mode === "call" ? 12000 : 10000) : Number(expert?.price_points || 0);
function update() {
  const valid = !!slot && !busy && !complete;
  $("book").disabled = !valid;
  $("book").textContent = complete
    ? "예약 완료"
    : busy
      ? "예약 중…"
      : slot
        ? `${weekday(date)} ${clock(slot.start_at)}으로 예약하기`
        : "날짜와 시간을 선택해주세요";
  $("call-mode").setAttribute("aria-pressed", String(mode === "call"));
  $("chat-mode").setAttribute("aria-pressed", String(mode === "chat"));
  $("points").textContent = demo
    ? "예시 보유 포인트 31,500P"
    : points === null
      ? "로그인 후 보유 포인트를 확인할 수 있어요."
      : `보유 포인트 ${money(points)}P`;
}
function renderTimes() {
  const rows = slots.filter(
    (s) => key(s.start_at) === date && new Date(s.start_at) > new Date(),
  );
  $("booking-times").replaceChildren();
  $("day-heading").textContent = date ? weekday(date) : "시간을 선택해주세요";
  for (const s of rows) {
    const b = document.createElement("button");
    b.textContent = clock(s.start_at);
    b.setAttribute("aria-label", `${clock(s.start_at)} – ${clock(s.end_at)}`);
    b.setAttribute("aria-pressed", String(slot?.id === s.id));
    b.onclick = () => {
      slot = s;
      renderTimes();
    };
    $("booking-times").append(b);
  }
  if (demo) {
    const closed = document.createElement("button");
    closed.textContent = "18:00 마감";
    closed.disabled = true;
    $("booking-times").append(closed);
  }
  update();
}
function renderDates() {
  const days = [...new Set(slots.map((s) => key(s.start_at)))];
  $("date-strip").replaceChildren();
  for (const d of days) {
    const b = document.createElement("button");
    b.setAttribute("aria-label", `${d} ${weekday(d)}`);
    b.setAttribute("aria-pressed", String(date === d));
    b.innerHTML = `<span>${escape(weekday(d).slice(0, 1))}</span><b>${Number(d.slice(-2))}</b>`;
    b.onclick = () => {
      date = d;
      slot = null;
      renderDates();
      renderTimes();
    };
    $("date-strip").append(b);
  }
}
async function loadExpert() {
  const v = ++version;
  expert = experts.find((e) => String(e.id) === $("expert-choice").value);
  slots = [];
  slot = null;
  date = "";
  renderDates();
  renderTimes();
  $("chat-price").textContent = `${money(demo ? 10000 : expert.price_points)}P`;
  status("slots-status", "가능한 시간을 불러오고 있어요.");
  try {
    let rows;
    if (demo) {
      const today = key(new Date());
      rows = Array.from({ length: 5 }, (_, i) => {
        const d = key(
          new Date(
            new Date(today + "T12:00:00+09:00").getTime() + (i + 1) * 86400000,
          ),
        );
        return ["14:00", "16:00"].map((t, j) => ({
          id: `demo-${i}-${j}`,
          start_at: `${d}T${t}:00+09:00`,
          end_at: `${d}T${j ? "17:00" : "15:00"}:00+09:00`,
        }));
      }).flat();
    } else rows = await (await import("../api/experts.js")).getSlots(expert.id);
    if (v !== version) return;
    slots = rows
      .filter((s) => new Date(s.start_at) > new Date())
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
    date = slots.some((s) => key(s.start_at) === params.get("date"))
      ? params.get("date")
      : slots[demo ? Math.min(4, slots.length - 1) : 0]
        ? key(slots[demo ? Math.min(4, slots.length - 1) : 0].start_at)
        : "";
    status(
      "slots-status",
      slots.length ? "" : "현재 예약 가능한 시간이 없어요.",
    );
    if (demo) slot = slots.find((s) => key(s.start_at) === date);
    renderDates();
    renderTimes();
  } catch (e) {
    if (v === version)
      status(
        "slots-status",
        e.message || "시간을 불러오지 못했어요.",
        loadExpert,
      );
  }
}
async function load() {
  status("load-status", "베테랑을 불러오고 있어요.");
  try {
    experts = demo
      ? (await import("./demo-data.js")).experts
      : await (await import("../api/experts.js")).getExperts();
    if (!experts.length) {
      status("load-status", "예약 가능한 베테랑이 없어요.");
      return;
    }
    $("expert-choice").innerHTML = experts
      .map(
        (e) =>
          `<option value="${escape(e.id)}">${escape(e.name)} · ${escape(e.headline)}</option>`,
      )
      .join("");
    if (experts.some((e) => String(e.id) === params.get("id")))
      $("expert-choice").value = params.get("id");
    $("booking-content").hidden = false;
    status("load-status", "");
    $("call-mode").disabled = !demo;
    $("chat-label").textContent = demo
      ? "1시간 1:1 채팅 상담"
      : "1:1 채팅 상담";
    $("mode-note").textContent = demo
      ? ""
      : "현재 채팅 상담을 예약할 수 있어요. 통화 상담은 준비 중입니다. 시간별 소요 시간은 선택한 슬롯을 기준으로 합니다.";
    loadExpert();
    if (!demo) {
      try {
        const profile = await (await import("../api/auth.js")).getMyProfile();
        points = profile?.points ?? null;
        update();
      } catch {
        /* Profile failure does not hide availability. */
      }
    }
  } catch (e) {
    status("load-status", e.message || "불러오지 못했어요.", load);
  }
}
$("expert-choice").onchange = () => {
  $("booking-confirm").close();
  loadExpert();
};
$("booking-topic").oninput = update;
$("call-mode").onclick = () => {
  mode = "call";
  update();
};
$("chat-mode").onclick = () => {
  mode = "chat";
  update();
};
$("cancel-booking").onclick = () => $("booking-confirm").close();
$("book").onclick = () => {
  if (!slot || busy || complete) return;
  if (new Date(slot.start_at) <= new Date()) {
    status("booking-message", "선택한 시간이 지났어요. 다시 선택해주세요.");
    loadExpert();
    return;
  }
  $("confirm-text").textContent =
    `${expert.name}\n${date} ${clock(slot.start_at)} – ${clock(slot.end_at)}\n${mode === "call" ? "통화" : "채팅"} 상담 ${money(price())}P\n포인트가 차감되어 상담 완료 전까지 보관됩니다.`;
  $("confirm-error").textContent = "";
  $("booking-confirm").showModal();
};
$("confirm-booking").onclick = async () => {
  if (busy || complete || !slot) return;
  if (!$("booking-topic").value.trim()) {
    $("confirm-error").textContent = "상담 내용을 입력해주세요.";
    $("booking-topic").focus();
    return;
  }
  if (demo) {
    $("booking-confirm").close();
    notice(
      "예약 미리보기",
      `${expert.name} · ${date} ${clock(slot.start_at)}\n${mode === "call" ? "통화" : "채팅"} 상담 ${money(price())}P\n예시 데이터이므로 실제 예약이나 차감은 실행하지 않아요.`,
    );
    return;
  }
  busy = true;
  update();
  $("confirm-booking").disabled = true;
  try {
    const { getCurrentUser } = await import("../api/auth.js");
    if (!(await getCurrentUser())) throw new Error("로그인 후 예약해주세요.");
    if (new Date(slot.start_at) <= new Date())
      throw new Error("선택한 시간이 지났어요. 다시 선택해주세요.");
    const id = await (
      await import("../api/bookings.js")
    ).createBooking(slot.id, $("booking-topic").value.trim());
    complete = true;
    $("booking-confirm").close();
    $("expert-choice").disabled = true;
    $("booking-topic").disabled = true;
    $("date-strip").replaceChildren();
    $("booking-times").replaceChildren();
    $("chat-mode").disabled = true;
    status("booking-message", `예약이 완료됐어요. 예약 번호: ${id}`);
  } catch (e) {
    $("booking-confirm").close();
    status("booking-message", e.message || "예약하지 못했어요.");
  } finally {
    busy = false;
    $("confirm-booking").disabled = false;
    update();
  }
};
load();
