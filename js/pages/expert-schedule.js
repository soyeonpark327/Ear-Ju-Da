import { demo, notice, status, init, goLogin, route } from "./ui.js";
init();
const $ = (id) => document.getElementById(id);

// 날짜는 모두 한국 날짜 문자열 '2026-11-03'으로 다룬다
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (value) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(value));
const utc = (key) => new Date(`${key}T00:00:00Z`);
const addDays = (key, n) => {
  const d = utc(key);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const kstStart = (key, time = "00:00") => new Date(`${key}T${time}:00+09:00`);
const hm = (value) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(value),
  );
const dayTitle = (key) => {
  const d = utc(key);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAYS[d.getUTCDay()]})`;
};

const today = keyOf(Date.now());
const lastOpenDay = addDays(today, 89); // 90일 안으로만 열 수 있음
let month = today.slice(0, 7); // '2026-11'
let selected = today;
let byDay = {};
let api = null;
let busy = false;
let pendingDelete = null;

const STATE = {
  open: "예약 가능",
  confirmed: "예약됨",
  completed: "완료",
  no_show: "노쇼",
};

// ---------- 데모 데이터 ----------
function demoSlots() {
  const rows = [];
  const at = (days, time, min, state, extra = {}) => {
    const key = addDays(today, days);
    const start = kstStart(key, time);
    rows.push({
      slot_id: rows.length + 1,
      start_at: start.toISOString(),
      end_at: new Date(start.getTime() + min * 60000).toISOString(),
      state,
      booking_id: state === "open" ? null : rows.length + 1,
      youth_name: extra.who ?? null,
      topic: extra.topic ?? null,
    });
  };
  at(-6, "19:00", 60, "completed", { who: "김대표", topic: "첫 양산 계약 단가 조항 검토" });
  at(-2, "14:00", 60, "completed", { who: "박청년", topic: "공장 견적 비교하는 법" });
  at(0, "19:00", 60, "confirmed", { who: "김대표", topic: "금형 소유권 조항 다시 보기" });
  for (const d of [1, 3, 5, 8, 10, 12]) {
    at(d, "14:00", 60, d === 3 ? "confirmed" : "open", d === 3 ? { who: "이창업", topic: "MOQ 협상" } : {});
    at(d, "15:00", 60, "open");
  }
  return rows;
}
let demoRows = demo ? demoSlots() : [];

// ---------- 달력 ----------
function gridRange() {
  const first = `${month}-01`;
  const start = addDays(first, -utc(first).getUTCDay());
  const d = utc(first);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const next = d.toISOString().slice(0, 10);
  const lastDay = addDays(next, -1);
  const end = addDays(lastDay, 6 - utc(lastDay).getUTCDay());
  return { start, end };
}

function shiftMonth(n) {
  const d = utc(`${month}-01`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}

function dotsFor(slots) {
  const kinds = new Set(
    slots.map((s) =>
      s.state === "open" ? (new Date(s.start_at) > new Date() ? "open" : null) : s.state === "confirmed" ? "booked" : "done",
    ),
  );
  kinds.delete(null);
  return ["open", "booked", "done"].filter((k) => kinds.has(k));
}

function renderGrid() {
  const [y, m] = month.split("-").map(Number);
  $("sch-month").textContent = `${y}년 ${m}월`;
  $("sch-next").disabled = shiftMonth(1) > lastOpenDay.slice(0, 7);
  const { start, end } = gridRange();
  const cells = [];
  for (let key = start; key <= end; key = addDays(key, 1)) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-selected", String(key === selected));
    if (!key.startsWith(month)) button.classList.add("sch-other");
    else if (key < today) button.classList.add("sch-past");
    if (key === today) button.classList.add("sch-today");
    const num = document.createElement("span");
    num.textContent = Number(key.slice(8));
    const dots = document.createElement("span");
    dots.className = "sch-dots";
    const kinds = dotsFor(byDay[key] ?? []);
    for (const k of kinds) {
      const dot = document.createElement("i");
      dot.className = `sch-dot sch-${k}`;
      dots.append(dot);
    }
    const count = (byDay[key] ?? []).length;
    button.setAttribute("aria-label", `${dayTitle(key)}${count ? `, 시간 ${count}개` : ""}`);
    button.append(num, dots);
    button.onclick = () => {
      selected = key;
      if (!key.startsWith(month)) {
        month = key.slice(0, 7);
        loadMonth();
      } else {
        renderGrid();
        renderDay();
      }
    };
    cells.push(button);
  }
  $("sch-grid").replaceChildren(...cells);
}

// ---------- 고른 날 ----------
function renderDay() {
  $("sch-day-title").textContent = dayTitle(selected);
  const slots = byDay[selected] ?? [];
  $("sch-day-empty").hidden = slots.length > 0;
  $("sch-day-list").replaceChildren(
    ...slots.map((s) => {
      const li = document.createElement("li");
      const main = document.createElement("div");
      main.className = "sch-slot-main";
      const time = document.createElement("p");
      time.className = "sch-slot-time";
      time.textContent = `${hm(s.start_at)} ~ ${hm(s.end_at)}`;
      const passed = s.state === "open" && new Date(s.start_at) <= new Date();
      const badge = document.createElement("span");
      badge.className = `sch-slot-state is-${passed ? "completed" : s.state}`;
      badge.textContent = passed ? "지난 시간" : STATE[s.state] ?? s.state;
      time.append(badge);
      main.append(time);
      if (s.youth_name) {
        const who = document.createElement("p");
        who.className = "sch-slot-who";
        who.textContent = `${s.youth_name}님 · ${s.topic ?? ""}`;
        main.append(who);
      }
      li.append(main);
      if (s.state === "open" && !passed) {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "outline";
        del.textContent = "닫기";
        del.setAttribute("aria-label", `${hm(s.start_at)} 시간 닫기`);
        del.onclick = () => askDelete(s);
        li.append(del);
      } else if (s.booking_id && s.state !== "open") {
        const go = document.createElement("a");
        go.className = "outline";
        go.href = route("chat.html", { id: demo ? "demo-active" : s.booking_id });
        go.textContent = s.state === "confirmed" ? "채팅방" : "기록";
        li.append(go);
      }
      return li;
    }),
  );
  const canAdd = selected >= today && selected <= lastOpenDay;
  $("sch-add").hidden = !canAdd;
  status("sch-add-status", canAdd ? "" : selected < today ? "지난 날짜에는 시간을 열 수 없어요." : "90일 안의 날짜만 열 수 있어요.");
}

// ---------- 불러오기 ----------
async function fetchRange(start, end) {
  if (demo) return demoRows.filter((r) => keyOf(r.start_at) >= start && keyOf(r.start_at) <= end);
  return api.getMyCalendar(kstStart(start), kstStart(addDays(end, 1)));
}

async function loadMonth() {
  const { start, end } = gridRange();
  status("sch-status", "일정을 불러오고 있어요.");
  try {
    byDay = api ? api.groupByDay(await fetchRange(start, end)) : groupLocal(await fetchRange(start, end));
    renderGrid();
    renderDay();
    status("sch-status", "");
  } catch (e) {
    status("sch-status", e.message || "일정을 불러오지 못했어요.", loadMonth);
  }
}

function groupLocal(rows) {
  return rows.reduce((days, r) => ((days[keyOf(r.start_at)] ??= []).push(r), days), {});
}

// ---------- 시간 열기 ----------
function fillTimes(select, from, to, value) {
  const options = [];
  for (let m = from; m <= to; m += 30) {
    const t = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
    options.push(new Option(t, t, false, t === value));
  }
  select.replaceChildren(...options);
}
function fillLengths(select) {
  select.replaceChildren(
    ...[30, 60, 90, 120].map((m) => new Option(m < 60 ? `${m}분` : m % 60 ? `1시간 30분` : `${m / 60}시간`, m, false, m === 60)),
  );
}

$("sch-add").onsubmit = async (e) => {
  e.preventDefault();
  if (busy) return;
  if (demo) return notice("예시 화면", "실제 서비스에서는 이 날 상담 시간을 열 수 있어요.");
  const start = kstStart(selected, $("sch-add-start").value);
  const end = new Date(start.getTime() + Number($("sch-add-length").value) * 60000);
  if (start <= new Date()) return status("sch-add-status", "이미 지난 시각이에요. 다른 시각을 골라 주세요.");
  busy = true;
  status("sch-add-status", "시간을 열고 있어요…");
  try {
    await api.addSlot(start, end);
    await loadMonth();
    status("sch-add-status", `${hm(start)} ~ ${hm(end)} 시간을 열었어요.`);
  } catch (err) {
    status("sch-add-status", err.message || "시간을 열지 못했어요.");
  } finally {
    busy = false;
  }
};

// ---------- 닫기 ----------
function askDelete(slot) {
  pendingDelete = slot;
  $("sch-confirm-text").textContent = `${dayTitle(keyOf(slot.start_at))} ${hm(slot.start_at)} ~ ${hm(slot.end_at)}\n청년들이 더 이상 이 시간을 예약할 수 없어요.`;
  $("sch-confirm").showModal();
}
$("sch-confirm-cancel").onclick = () => $("sch-confirm").close();
$("sch-confirm-ok").onclick = async () => {
  if (busy || !pendingDelete) return;
  if (demo) {
    $("sch-confirm").close();
    return notice("예시 화면", "실제 서비스에서는 이 시간이 닫혀요.");
  }
  busy = true;
  $("sch-confirm-ok").disabled = true;
  try {
    await api.deleteSlot(pendingDelete.slot_id);
    await loadMonth();
    status("sch-add-status", "시간을 닫았어요.");
  } catch (err) {
    status("sch-add-status", err.message || "시간을 닫지 못했어요.");
    await loadMonth();
  } finally {
    $("sch-confirm").close();
    $("sch-confirm-ok").disabled = false;
    busy = false;
    pendingDelete = null;
  }
};

// ---------- 매주 반복 ----------
$("sch-weekly-days").replaceChildren(
  ...WEEKDAYS.map((name, i) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = i;
    input.setAttribute("aria-label", `${name}요일`);
    const span = document.createElement("span");
    span.textContent = name;
    label.append(input, span);
    return label;
  }),
);

$("sch-weekly").onsubmit = async (e) => {
  e.preventDefault();
  if (busy) return;
  const weekdays = [...$("sch-weekly-days").querySelectorAll("input:checked")].map((i) => Number(i.value));
  const start = $("sch-weekly-start").value;
  const end = $("sch-weekly-end").value;
  const minutes = Number($("sch-weekly-length").value);
  const weeks = Number($("sch-weekly-weeks").value);
  if (!weekdays.length) return status("sch-weekly-status", "요일을 하나 이상 골라 주세요.");
  if (end <= start) return status("sch-weekly-status", "끝나는 시각이 시작 시각보다 늦어야 해요.");
  if (demo) return notice("예시 화면", `실제 서비스에서는 매주 ${weekdays.map((d) => WEEKDAYS[d]).join("·")}요일 ${start}~${end} 시간을 ${weeks}주 동안 열어요.`);
  busy = true;
  status("sch-weekly-status", "반복 일정을 만들고 있어요…");
  try {
    const r = await api.addWeeklySlots({ weekdays, start, end, minutes, weeks });
    const skipped = [r.skipped_overlap && `겹쳐서 ${r.skipped_overlap}개`, r.skipped_past && `지난 시간 ${r.skipped_past}개`].filter(Boolean);
    await loadMonth();
    status(
      "sch-weekly-status",
      r.created
        ? `${r.created}개 시간을 열었어요.${skipped.length ? ` (${skipped.join(", ")} 건너뜀)` : ""}`
        : `새로 연 시간이 없어요.${skipped.length ? ` (${skipped.join(", ")} 건너뜀)` : ""}`,
    );
  } catch (err) {
    status("sch-weekly-status", err.message || "반복 일정을 만들지 못했어요.");
  } finally {
    busy = false;
  }
};

$("sch-prev").onclick = () => {
  month = shiftMonth(-1);
  selected = `${month}-01`;
  loadMonth();
};
$("sch-next").onclick = () => {
  month = shiftMonth(1);
  selected = `${month}-01`;
  loadMonth();
};

// ---------- 시작 ----------
async function start() {
  fillTimes($("sch-add-start"), 6 * 60, 22 * 60, "14:00");
  fillLengths($("sch-add-length"));
  fillTimes($("sch-weekly-start"), 6 * 60, 22 * 60, "14:00");
  fillTimes($("sch-weekly-end"), 6 * 60 + 30, 23 * 60, "18:00");
  fillLengths($("sch-weekly-length"));
  status("sch-status", "일정을 불러오고 있어요.");
  if (demo) {
    $("sch-content").hidden = false;
    return loadMonth();
  }
  try {
    const { getMyProfile } = await import("../api/auth.js");
    const me = await getMyProfile();
    if (!me) return goLogin();
    if (me.role !== "veteran") return status("sch-status", "베테랑 회원만 이용할 수 있어요.");
    api = await import("../api/experts.js");
    if (!(await api.getMyExpert())) {
      status("sch-status", "먼저 베테랑 프로필을 등록해 주세요.");
      const link = document.createElement("a");
      link.className = "primary sch-setup-link";
      link.href = route("expert-setup.html");
      link.textContent = "베테랑 프로필 등록하기";
      $("sch-status").append(link);
      return;
    }
    $("sch-content").hidden = false;
    await loadMonth();
  } catch (e) {
    status("sch-status", e.message || "일정을 불러오지 못했어요.", start);
  }
}
start();
