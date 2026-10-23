import { demo, money, status, init, goLogin, route } from "./ui.js";
init();
const $ = (id) => document.getElementById(id);
let busy = false;
let pending = 0;

const when = (value) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
const signed = (n) => `${n > 0 ? "+" : n < 0 ? "-" : ""}${money(Math.abs(n))}P`;

// 데모 모드(?demo=1)용 예시 데이터. API를 부르지 않는다.
const DEMO = {
  balance: 48000,
  options: [5000, 10000, 30000],
  history: [
    { id: 3, label: "오답노트 구매", amount: -2000, balance_after: 48000, ref: {}, created_at: new Date().toISOString() },
    { id: 2, label: "이벤트 보너스", amount: 40000, balance_after: 50000, ref: {}, created_at: new Date(Date.now() - 864e5).toISOString() },
    { id: 1, label: "가입 보너스", amount: 10000, balance_after: 10000, ref: {}, created_at: new Date(Date.now() - 864e5).toISOString() },
  ],
};

function renderBalance(points) {
  $("points-balance").textContent = `${money(points)}P`;
}

function renderHistory(rows) {
  $("points-history-empty").hidden = rows.length > 0;
  $("points-history-list").replaceChildren(
    ...rows.map((row) => {
      const li = document.createElement("li");
      li.className = "points-history-item";
      // 관련 상담·노트가 있으면 눌러서 이동
      const href = demo
        ? ""
        : row.ref?.booking_id
          ? route("chat.html", { id: row.ref.booking_id })
          : row.ref?.note_id
            ? route("note-detail.html", { id: row.ref.note_id })
            : "";
      const box = document.createElement(href ? "a" : "div");
      if (href) box.href = href;
      const label = document.createElement("span");
      label.className = "points-history-label";
      label.textContent = row.label;
      const amount = document.createElement("span");
      amount.className = `points-history-amount${row.amount > 0 ? " points-plus" : ""}`;
      amount.textContent = signed(row.amount);
      const time = document.createElement("span");
      time.className = "points-history-time";
      time.textContent = when(row.created_at);
      const after = document.createElement("span");
      after.className = "points-history-after";
      after.textContent = `잔액 ${money(row.balance_after)}P`;
      box.append(label, amount, time, after);
      li.append(box);
      return li;
    }),
  );
}

function renderOptions(options) {
  $("points-charge-options").replaceChildren(
    ...options.map((amount) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `+${money(amount)}P`;
      button.onclick = () => askCharge(amount);
      return button;
    }),
  );
}

function askCharge(amount) {
  if (busy) return;
  pending = amount;
  $("points-confirm-text").textContent = demo
    ? `예시 화면이에요. 실제 서비스에서 ${money(amount)}P를 충전할 수 있어요.`
    : `${money(amount)}P를 충전할까요?\n데모용 충전이라 실제 결제는 이뤄지지 않아요.`;
  $("points-confirm-ok").hidden = demo;
  $("points-confirm").showModal();
}

$("points-confirm-cancel").onclick = () => $("points-confirm").close();
$("points-confirm-ok").onclick = async () => {
  if (busy || demo) return;
  busy = true;
  $("points-confirm-ok").disabled = true;
  status("points-charge-status", "충전하고 있어요…");
  try {
    const api = await import("../api/points.js");
    const balance = await api.chargePoints(pending);
    renderBalance(balance);
    renderHistory(await api.getPointHistory());
    status("points-charge-status", `${money(pending)}P가 충전됐어요.`);
  } catch (e) {
    status("points-charge-status", e.message || "충전하지 못했어요. 다시 시도해주세요.");
  } finally {
    $("points-confirm").close();
    $("points-confirm-ok").disabled = false;
    busy = false;
  }
};

async function load() {
  status("points-status", "포인트를 불러오고 있어요.");
  if (demo) {
    renderBalance(DEMO.balance);
    renderOptions(DEMO.options);
    renderHistory(DEMO.history);
    $("points-content").hidden = false;
    status("points-status", "");
    return;
  }
  try {
    const { getMyProfile } = await import("../api/auth.js");
    const me = await getMyProfile();
    if (!me) {
      goLogin();
      return;
    }
    const api = await import("../api/points.js");
    renderBalance(me.points);
    renderOptions(api.CHARGE_OPTIONS);
    renderHistory(await api.getPointHistory());
    $("points-content").hidden = false;
    status("points-status", "");
  } catch (e) {
    status("points-status", e.message || "포인트를 불러오지 못했어요.", load);
  }
}
load();
