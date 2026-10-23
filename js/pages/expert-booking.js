import {
  demo,
  money,
  escape,
  notice,
  status,
  init,
  avatar,
} from "./ui.js";
init();
const $ = (id) => document.getElementById(id);
const id = new URLSearchParams(location.search).get("id");
const dateKey = (value) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
const time = (value) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
const today = dateKey(new Date());
let expert,
  slots = [],
  selectedDate = "",
  selectedSlot = null,
  tips = [],
  showAll = false,
  busy = false,
  completed = false;
const currentMonth = () =>
  Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7)) - 1;
let monthIndex = currentMonth();
function updateButton() {
  $("reserve").disabled =
    busy || completed || !selectedSlot || !$("topic").value.trim();
}
function renderCalendar() {
  const year = Math.floor(monthIndex / 12),
    mon = monthIndex % 12;
  $("month-label").textContent = `${year}년 ${mon + 1}월`;
  $("previous-month").disabled = monthIndex <= currentMonth();
  const first = new Date(Date.UTC(year, mon, 1)).getUTCDay(),
    days = new Date(Date.UTC(year, mon + 1, 0)).getUTCDate();
  const box = $("calendar");
  box.replaceChildren();
  for (let i = 0; i < first; i++) {
    const spacer = document.createElement("span");
    spacer.setAttribute("aria-hidden", "true");
    box.append(spacer);
  }
  const available = new Set(
    slots
      .filter((s) => new Date(s.start_at) > new Date())
      .map((s) => dateKey(s.start_at)),
  );
  for (let day = 1; day <= days; day++) {
    const key = `${year}-${String(mon + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const b = document.createElement("button");
    b.type = "button";
    b.disabled = !available.has(key) || key < today || completed;
    b.className = [
      (first + day - 1) % 7 === 0 ? "sunday" : "",
      key === today ? "today" : "",
      available.has(key) ? "available" : "",
    ].join(" ");
    b.setAttribute(
      "aria-label",
      `${year}년 ${mon + 1}월 ${day}일${key === today ? " 오늘" : ""}`,
    );
    b.setAttribute("aria-pressed", String(key === selectedDate));
    if (key === today) b.setAttribute("aria-current", "date");
    b.textContent = day;
    if (key === today) {
      const small = document.createElement("small");
      small.textContent = "오늘";
      b.append(small);
    }
    b.onclick = () => {
      selectedDate = key;
      selectedSlot = null;
      renderCalendar();
      renderTimes();
    };
    box.append(b);
  }
}
function renderTimes() {
  const box = $("times");
  box.replaceChildren();
  const rows = slots.filter(
    (s) =>
      dateKey(s.start_at) === selectedDate && new Date(s.start_at) > new Date(),
  );
  $("selected-date").textContent = selectedDate
    ? `${selectedDate} · 상담 시간을 선택해주세요.`
    : "날짜를 선택해주세요.";
  rows.forEach((s) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `${time(s.start_at)} – ${time(s.end_at)}`;
    b.setAttribute("aria-pressed", String(selectedSlot?.id === s.id));
    b.onclick = () => {
      selectedSlot = s;
      renderTimes();
    };
    box.append(b);
  });
  $("booking-summary").textContent = selectedSlot
    ? `${selectedDate} ${time(selectedSlot.start_at)} · ${money(expert.price_points)} P`
    : `상담 ${money(expert.price_points)} P`;
  updateButton();
}
function renderTips() {
  $("tips").innerHTML = tips
    .slice(0, showAll ? tips.length : 1)
    .map(
      (t) =>
        `<article class="tip-card"><blockquote>“${escape(t.content)}”</blockquote></article>`,
    )
    .join("");
  $("more-tips").hidden = tips.length < 2;
  $("more-tips").textContent = showAll ? "접기" : `${tips.length}개 보기 ›`;
}
async function loadSlots() {
  status("slots-status", "예약 가능한 시간을 불러오고 있어요.");
  selectedSlot = null;
  selectedDate = "";
  slots = [];
  renderCalendar();
  renderTimes();
  try {
    if (demo) {
      const base = new Date(today + "T12:00:00+09:00");
      slots = Array.from({ length: 5 }, (_, i) => {
        const day = new Date(base.getTime() + (i + 1) * 86400000);
        const key = dateKey(day);
        return ["10:00", "14:00"].map((t, j) => ({
          id: `demo-${i}-${j}`,
          start_at: `${key}T${t}:00+09:00`,
          end_at: `${key}T${j ? "14:30" : "10:30"}:00+09:00`,
        }));
      }).flat();
    } else {
      slots = await (await import("../api/experts.js")).getSlots(id);
    }
    slots = slots
      .filter((s) => new Date(s.start_at) > new Date())
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
    if (slots.length) {
      const first = dateKey(slots[0].start_at);
      monthIndex =
        Number(first.slice(0, 4)) * 12 + Number(first.slice(5, 7)) - 1;
    }
    status(
      "slots-status",
      slots.length ? "" : "현재 예약 가능한 시간이 없어요.",
    );
    renderCalendar();
    renderTimes();
  } catch (e) {
    status("slots-status", e.message || "시간을 불러오지 못했어요.", loadSlots);
  }
}
async function load() {
  status("expert-load", "베테랑 정보를 불러오고 있어요.");
  if (!id) {
    status("expert-load", "메인에서 상담할 베테랑을 먼저 선택해주세요.");
    return;
  }
  try {
    expert = demo
      ? (await import("./demo-data.js")).experts.find((e) => e.id === id)
      : await (await import("../api/experts.js")).getExpert(id);
    if (!expert) {
      status("expert-load", "찾을 수 없거나 공개되지 않은 베테랑이에요.");
      return;
    }
    if (demo) expert = { ...expert, price_points: 10000 };
    $("expert-name").textContent = expert.name;
    $("expert-headline").textContent = expert.headline;
    let url = demo ? expert.avatar_url : avatar(expert.avatar_url);
    const fallback = () => {
      const span = document.createElement("span");
      span.className = "profile-avatar";
      span.textContent = (expert.name || "베")[0];
      $("expert-avatar").replaceChildren(span);
    };
    if (url) {
      const img = document.createElement("img");
      img.alt = "";
      img.src = url;
      img.onerror = fallback;
      $("expert-avatar").replaceChildren(img);
    } else fallback();
    $("career-summary").textContent =
      `경력 ${expert.career_years || 0}년 · ${expert.career_summary || expert.headline || ""}`;
    $("experience-bars").innerHTML = Array.from(
      { length: 64 },
      (_, i) => `<i style="height:${7 + ((i * 13) % 27)}px"></i>`,
    ).join("");
    $("expert-tags").innerHTML = [
      `경력 ${expert.career_years || 0}년`,
      ...(expert.keywords || []),
    ]
      .map((k) => `<li>${escape(k)}</li>`)
      .join("");
    $("profile-content").hidden = false;
    status("expert-load", "");
    document.title = `${expert.name} 상담 예약 | 이어주다`;
    loadSlots();
    try {
      tips = demo
        ? [
            {
              content:
                "계약서에서 제일 위험한 건 불리한 조항이 아니라, 아무 말도 안 적혀 있는 칸입니다.",
            },
            { content: "협의가 결렬됐을 때 적용할 기준도 미리 정해두세요." },
          ]
        : await (await import("../api/experts.js")).getTips(id);
      renderTips();
      status(
        "tips-status",
        tips.length ? "" : "아직 등록된 한 줄 조언이 없어요.",
      );
    } catch (e) {
      status("tips-status", e.message || "조언을 불러오지 못했어요.");
    }
  } catch (e) {
    status("expert-load", e.message || "정보를 불러오지 못했어요.", load);
  }
}
$("previous-month").onclick = () => {
  if (monthIndex > currentMonth()) {
    monthIndex--;
    renderCalendar();
  }
};
$("next-month").onclick = () => {
  monthIndex++;
  renderCalendar();
};
$("more-tips").onclick = () => {
  showAll = !showAll;
  renderTips();
};
$("topic").oninput = updateButton;
$("booking-form").onsubmit = (e) => {
  e.preventDefault();
  if (!selectedSlot || busy || completed) return;
  if (new Date(selectedSlot.start_at) <= new Date()) {
    status(
      "booking-status",
      "선택한 시간이 지났어요. 다른 시간을 선택해주세요.",
    );
    loadSlots();
    return;
  }
  if (demo) {
    notice(
      "예약 미리보기",
      `${selectedDate} ${time(selectedSlot.start_at)} · ${expert.name}\n예시 데이터이므로 실제 예약이나 포인트 차감은 실행되지 않아요.`,
    );
    return;
  }
  $("confirm-details").textContent =
    `${expert.name}\n${selectedDate} ${time(selectedSlot.start_at)} – ${time(selectedSlot.end_at)}\n${money(expert.price_points)} P\n상담 내용: ${$("topic").value.trim()}`;
  $("confirm-booking").showModal();
};
$("cancel-confirm").onclick = () => $("confirm-booking").close();
$("submit-booking").onclick = async () => {
  if (busy || completed || !selectedSlot) return;
  busy = true;
  updateButton();
  $("submit-booking").disabled = true;
  let bookingId;
  try {
    const { getCurrentUser } = await import("../api/auth.js");
    if (!(await getCurrentUser()))
      throw new Error(
        "로그인 후 예약할 수 있어요. 로그인 화면은 준비 중이에요.",
      );
    if (new Date(selectedSlot.start_at) <= new Date())
      throw new Error("선택한 시간이 지났어요. 다른 시간을 선택해주세요.");
    bookingId = await (
      await import("../api/bookings.js")
    ).createBooking(selectedSlot.id, $("topic").value.trim());
    completed = true;
    $("confirm-booking").close();
    $("reserve").textContent = "예약 완료";
    $("topic").disabled = true;
    $("times").replaceChildren();
    renderCalendar();
    status("booking-status", `예약이 완료됐어요. 예약 번호: ${bookingId}`);
  } catch (e) {
    $("confirm-booking").close();
    status(
      "booking-status",
      e.message || "예약하지 못했어요. 다시 시도해주세요.",
    );
  } finally {
    busy = false;
    $("submit-booking").disabled = false;
    updateButton();
  }
};
load();
