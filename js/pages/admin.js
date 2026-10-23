import { demo, money, notice, status, init, goLogin } from "./ui.js";
init();
const $ = (id) => document.getElementById(id);

const LABEL = { pending: "승인 대기", approved: "승인", rejected: "반려" };
const REASONS = [
  "증명서에 회사명과 근무 기간이 보이지 않아요.",
  "프로필의 경력 연수와 증명서 내용이 달라요.",
  "본인 이름이 증명서에 없어요.",
  "파일이 흐려서 내용을 읽을 수 없어요.",
];
const day = (value) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" }).format(new Date(value));

let api = null;
let current = "pending";
let rejecting = null;
let busy = false;

// ---------- 데모 ----------
const DEMO_STATS = { users: 10, youth: 3, veterans: 7, experts_pending: 1, experts_approved: 6, bookings_upcoming: 1, bookings_completed: 9, bookings_no_show: 0, notes_published: 6, note_sales: 10 };
const DEMO_LIST = [
  {
    id: "oh",
    name: "오명수",
    email: "oh@example.com",
    headline: "건설사 현장소장 26년",
    industry: "건설",
    career_years: 26,
    career_summary: "중견 건설사 현장소장 26년\n하도급 계약 및 공정 관리",
    keywords: ["건설", "하도급", "공정관리"],
    price_points: 3000,
    verification: "pending",
    rejection_reason: null,
    certificate_path: "demo.pdf",
    created_at: new Date().toISOString(),
  },
];

// ---------- 그리기 ----------
function renderStats(s) {
  const items = [
    ["승인 대기", `${s.experts_pending}명`, s.experts_pending > 0],
    ["승인된 베테랑", `${s.experts_approved}명`],
    ["전체 회원", `${s.users}명`],
    ["예정 상담", `${s.bookings_upcoming}건`],
    ["완료 상담", `${s.bookings_completed}건`],
    ["노트 판매", `${money(s.note_sales)}건`],
  ];
  $("adm-stats").replaceChildren(
    ...items.map(([label, value, alert]) => {
      const li = document.createElement("li");
      if (alert) li.className = "is-alert";
      const span = document.createElement("span");
      span.textContent = label;
      const strong = document.createElement("strong");
      strong.textContent = value;
      li.append(span, strong);
      return li;
    }),
  );
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function button(text, className, onclick, disabled = false) {
  const b = el("button", className, text);
  b.type = "button";
  b.disabled = disabled;
  b.onclick = onclick;
  return b;
}

function renderList(rows) {
  status("adm-list-status", rows.length ? "" : current === "pending" ? "승인을 기다리는 베테랑이 없어요." : "해당하는 베테랑이 없어요.");
  $("adm-list").replaceChildren(
    ...rows.map((x) => {
      const li = document.createElement("li");
      const head = el("div", "adm-head");
      head.append(el("h3", null, x.name), el("span", `adm-badge is-${x.verification}`, LABEL[x.verification]));
      li.append(head, el("p", "adm-email", x.email ?? "이메일 없음 (소셜 가입)"));
      li.append(el("p", "adm-headline", x.headline));
      li.append(el("p", "adm-meta", `${x.industry} · 경력 ${x.career_years}년 · 상담 ${money(x.price_points)}P · 신청 ${day(x.created_at)}`));
      if (x.career_summary) li.append(el("p", "adm-summary", x.career_summary));
      if (x.keywords?.length) {
        const ul = el("ul", "adm-keywords");
        ul.append(...x.keywords.map((k) => el("li", null, `#${k}`)));
        li.append(ul);
      }
      if (x.verification === "rejected" && x.rejection_reason) li.append(el("p", "adm-reason", `반려 사유: ${x.rejection_reason}`));

      const actions = el("div", "adm-actions");
      actions.append(
        button(x.certificate_path ? "증명서 보기" : "증명서 없음", "outline", () => openCertificate(x), !x.certificate_path),
        button("승인", "primary", () => approve(x), x.verification === "approved"),
        button("반려", "adm-danger", () => askReject(x), x.verification === "rejected"),
      );
      li.append(actions);
      return li;
    }),
  );
}

// ---------- 동작 ----------
async function openCertificate(x) {
  if (demo) return notice("예시 화면", "실제 서비스에서는 증명서 파일이 새 창에서 열려요. (1분 동안만 열 수 있는 링크)");
  // 팝업 차단을 피하려고 창을 먼저 열고 주소를 넣는다
  const win = window.open("", "_blank");
  try {
    const url = await api.getCertificateUrl(x.certificate_path);
    if (win) {
      win.opener = null;
      win.location.href = url;
    } else location.href = url;
  } catch (e) {
    win?.close();
    notice("증명서", e.message || "증명서를 열지 못했어요.");
  }
}

async function approve(x) {
  if (busy) return;
  if (demo) return notice("예시 화면", `실제 서비스에서는 ${x.name}님이 승인되고, 베테랑 목록에 노출돼요.`);
  busy = true;
  try {
    await api.setVerification(x.id, "approved");
    notice("승인했어요", `${x.name}님에게 알림이 갔고, 이제 베테랑 목록에 보여요.`);
    await reload();
  } catch (e) {
    notice("승인하지 못했어요", e.message);
  } finally {
    busy = false;
  }
}

function askReject(x) {
  rejecting = x;
  $("adm-reject-who").textContent = `${x.name} · ${x.headline}`;
  $("adm-reject-reason").value = "";
  $("adm-reject").showModal();
}
$("adm-reasons").replaceChildren(
  ...REASONS.map((r) =>
    button(r.replace(/\.$/, ""), null, () => {
      $("adm-reject-reason").value = r;
      $("adm-reject-reason").focus();
    }),
  ),
);
$("adm-reject-cancel").onclick = () => $("adm-reject").close();
$("adm-reject-form").onsubmit = async (e) => {
  e.preventDefault();
  if (busy || !rejecting) return;
  const reason = $("adm-reject-reason").value.trim();
  if (!reason) return $("adm-reject-reason").focus();
  if (demo) {
    $("adm-reject").close();
    return notice("예시 화면", "실제 서비스에서는 반려되고, 사유가 베테랑에게 알림으로 가요.");
  }
  busy = true;
  try {
    await api.setVerification(rejecting.id, "rejected", reason);
    $("adm-reject").close();
    notice("반려했어요", `${rejecting.name}님에게 사유와 함께 알림이 갔어요. 새 증명서를 올리면 다시 승인 대기로 돌아와요.`);
    await reload();
  } catch (err) {
    notice("반려하지 못했어요", err.message);
  } finally {
    busy = false;
    rejecting = null;
  }
};

document.querySelectorAll("[data-status]").forEach((b) => {
  b.onclick = () => {
    current = b.dataset.status;
    document.querySelectorAll("[data-status]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    loadList();
  };
});

// ---------- 불러오기 ----------
async function loadList() {
  status("adm-list-status", "불러오고 있어요.");
  $("adm-list").replaceChildren();
  try {
    const rows = demo ? DEMO_LIST.filter((x) => !current || x.verification === current) : await api.getExpertsForReview(current || null);
    renderList(rows);
  } catch (e) {
    status("adm-list-status", e.message || "목록을 불러오지 못했어요.", loadList);
  }
}

// ---------- 신고 ----------
const TARGET = { user: "회원", note: "오답노트", booking: "상담" };
async function loadReports() {
  status("adm-reports-status", "불러오고 있어요.");
  try {
    const rows = demo ? [] : await api.getReports("open");
    status("adm-reports-status", rows.length ? "" : "처리할 신고가 없어요.");
    $("adm-reports").replaceChildren(
      ...rows.map((r) => {
        const li = document.createElement("li");
        const head = el("div", "adm-head");
        head.append(el("h3", null, r.target_label ?? `${TARGET[r.target_type]} #${r.target_id}`), el("span", "adm-badge", TARGET[r.target_type]));
        li.append(head, el("p", "adm-meta", `신고한 사람 ${r.reporter_name} · ${day(r.created_at)}`), el("p", "adm-summary", r.reason));
        const actions = el("div", "adm-actions");
        const done = (st) => async () => {
          try {
            await api.resolveReport(r.id, st);
            await loadReports();
          } catch (e) {
            notice("신고 처리", e.message);
          }
        };
        actions.append(button("조치함", "primary", done("resolved")), button("문제없음", "outline", done("dismissed")));
        li.append(actions);
        return li;
      }),
    );
  } catch (e) {
    status("adm-reports-status", e.message || "신고를 불러오지 못했어요.", loadReports);
  }
}

async function reload() {
  renderStats(demo ? DEMO_STATS : await api.getAdminStats());
  await Promise.all([loadList(), loadReports()]);
}

async function start() {
  status("adm-status", "확인하고 있어요.");
  try {
    if (!demo) {
      const { getMyProfile } = await import("../api/auth.js");
      const me = await getMyProfile();
      if (!me) return goLogin();
      if (!me.is_admin) return status("adm-status", "관리자만 이용할 수 있어요.");
      api = await import("../api/admin.js");
    }
    $("adm-content").hidden = false;
    status("adm-status", "");
    await reload();
  } catch (e) {
    status("adm-status", e.message || "불러오지 못했어요.", start);
  }
}
start();
