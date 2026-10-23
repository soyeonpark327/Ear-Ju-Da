import { demo, money, status, init, goLogin, route } from "./ui.js";
init();
const $ = (id) => document.getElementById(id);

const slotTime = (value) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
const day = (value) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" }).format(new Date(value));
const pts = (n) => `${money(n)}P`;

// 데모 모드(?demo=1)용 예시. API를 부르지 않는다.
const DEMO = {
  registered: true,
  profile: { name: "이정훈", verification: "approved", trust_grade: "gold", trust_label: "최고 신뢰", rating: 5, review_count: 2, no_show_count: 0 },
  bookings: { today: 1, this_week: 3, upcoming: 3, completed: 12, no_show: 0 },
  next_booking: { id: 0, start_at: new Date(Date.now() + 3 * 36e5).toISOString(), topic: "첫 양산 계약 단가 조항 검토", youth_name: "김대표" },
  points: { balance: 52000, pending: 9000, earned_total: 64000, earned_this_month: 18000 },
  notes: { published: 2, drafts: 1, sold_count: 14, sales_total: 28000 },
  recent_reviews: [
    { rating: 5, content: "단가 조항을 고치라는 조언 덕분에 불리한 계약을 피했습니다.", youth_name: "김대표", created_at: new Date().toISOString() },
  ],
};

function banner(profile) {
  const el = $("dash-banner");
  const messages = {
    pending: "관리자가 경력 증명서를 확인하고 있어요. 승인되면 베테랑 목록에 노출돼요.",
    rejected: "증명서로 경력을 확인하지 못했어요. 새 증명서를 올리면 다시 검토해요.",
  };
  const text = messages[profile.verification];
  el.hidden = !text;
  if (!text) return;
  el.textContent = `${text} `;
  const link = document.createElement("a");
  link.href = route("expert-setup.html");
  link.textContent = profile.verification === "rejected" ? "증명서 다시 올리기" : "프로필 확인하기";
  el.append(link);
}

function renderNext(next) {
  const box = $("dash-next-body");
  if (!next) {
    const p = document.createElement("p");
    p.className = "dash-empty";
    p.textContent = "예정된 상담이 없어요.";
    box.replaceChildren(p);
    return;
  }
  const when = document.createElement("p");
  when.className = "dash-next-when";
  when.textContent = slotTime(next.start_at);
  const who = document.createElement("p");
  who.className = "dash-next-who";
  who.textContent = `${next.youth_name}님과 상담`;
  const topic = document.createElement("p");
  topic.className = "dash-next-topic";
  topic.textContent = next.topic;
  const go = document.createElement("a");
  go.className = "primary";
  go.href = route("chat.html", { id: demo ? "demo-active" : next.id });
  go.textContent = "채팅방 가기";
  box.replaceChildren(when, who, topic, go);
}

function renderReviews(reviews) {
  $("dash-reviews-empty").hidden = reviews.length > 0;
  $("dash-reviews").replaceChildren(
    ...reviews.map((r) => {
      const li = document.createElement("li");
      const head = document.createElement("p");
      head.className = "dash-review-head";
      const stars = document.createElement("span");
      stars.className = "dash-review-stars";
      stars.textContent = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
      stars.setAttribute("aria-label", `별점 ${r.rating}점`);
      const meta = document.createElement("span");
      meta.textContent = `${r.youth_name} · ${day(r.created_at)}`;
      head.append(stars, meta);
      li.append(head);
      if (r.content) {
        const body = document.createElement("p");
        body.className = "dash-review-body";
        body.textContent = r.content;
        li.append(body);
      }
      return li;
    }),
  );
}

function render(d) {
  const p = d.profile;
  banner(p);
  $("dash-name").textContent = `${p.name}님, 안녕하세요`;
  const trust = $("dash-trust");
  trust.className = p.trust_grade ? `trust trust-${p.trust_grade}` : "";
  trust.textContent = p.trust_label ?? "";
  trust.hidden = !p.trust_label;
  $("dash-rating").textContent = p.review_count ? `★ ${p.rating} (후기 ${p.review_count}개)` : "아직 후기가 없어요";
  $("dash-noshow").hidden = !p.no_show_count;
  $("dash-noshow").textContent = `노쇼 ${p.no_show_count}회 — 신뢰 등급에 반영돼요.`;
  renderNext(d.next_booking);
  $("dash-today").textContent = `${d.bookings.today}건`;
  $("dash-week").textContent = `${d.bookings.this_week}건`;
  $("dash-completed").textContent = `${d.bookings.completed}건`;
  $("dash-month").textContent = pts(d.points.earned_this_month);
  $("dash-pending").textContent = pts(d.points.pending);
  $("dash-earned").textContent = pts(d.points.earned_total);
  $("dash-balance").textContent = pts(d.points.balance);
  $("dash-notes-published").textContent = `${d.notes.published}개`;
  $("dash-notes-drafts").textContent = `${d.notes.drafts}개`;
  $("dash-notes-sold").textContent = `${d.notes.sold_count}건 · ${pts(d.notes.sales_total)}`;
  renderReviews(d.recent_reviews);
  $("dash-content").hidden = false;
}

function setupNeeded() {
  status("dash-status", "먼저 베테랑 프로필을 등록해 주세요.");
  const link = document.createElement("a");
  link.className = "primary dash-setup-link";
  link.href = route("expert-setup.html");
  link.textContent = "베테랑 프로필 등록하기";
  $("dash-status").append(link);
}

async function load() {
  status("dash-status", "대시보드를 불러오고 있어요.");
  if (demo) {
    render(DEMO);
    status("dash-status", "");
    return;
  }
  try {
    const { getMyProfile } = await import("../api/auth.js");
    const me = await getMyProfile();
    if (!me) {
      goLogin();
      return;
    }
    if (me.role !== "veteran") {
      status("dash-status", "베테랑 회원만 이용할 수 있어요.");
      return;
    }
    const { getMyDashboard } = await import("../api/experts.js");
    const d = await getMyDashboard();
    if (!d.registered) {
      setupNeeded();
      return;
    }
    render(d);
    status("dash-status", "");
  } catch (e) {
    status("dash-status", e.message || "대시보드를 불러오지 못했어요.", load);
  }
}
load();
