// Preview data only; this module never imports backend APIs.
const KEY = "earjuda-engagement-demo";
let memory = {};
function read() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "null") || memory;
  } catch {
    return memory;
  }
}
function write(data) {
  memory = data;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* Optional preview storage. */
  }
}
const when = new Date().toISOString();
const notifications = [
  {
    id: "demo-notice-booking",
    type: "booking_confirmed",
    title: "상담 예약이 확정됐어요",
    body: "이승호 위원과의 상담을 확인해주세요.\n상담 시간에 채팅방이 열려요.",
    data: { booking_id: "demo-active" },
    created_at: when,
  },
  {
    id: "demo-notice-report",
    type: "report_ready",
    title: "상담 보고서가 준비됐어요",
    body: "핵심 조언과 실행할 일을 확인해보세요.",
    data: { booking_id: "demo-completed" },
    created_at: when,
  },
  {
    id: "demo-notice-note",
    type: "note_sold",
    title: "오답노트가 판매됐어요",
    body: "오답노트를 확인해보세요.",
    data: { note_id: "demo-contract" },
    created_at: when,
  },
  {
    id: "demo-notice-review",
    type: "review_new",
    title: "새 후기가 도착했어요",
    body: "상담 후기를 확인해보세요.",
    data: {},
    created_at: when,
  },
  {
    id: "demo-notice-verification",
    type: "verification_changed",
    title: "경력 인증 상태가 바뀌었어요",
    body: "등록 화면에서 확인해주세요.",
    data: {},
    created_at: when,
  },
];
export async function getCurrentUser() {
  return { id: "demo-youth" };
}
export async function getNotifications() {
  const s = read();
  return notifications.map((n) => ({ ...n, read_at: s.read?.[n.id] || null }));
}
export async function getUnreadCount() {
  return (await getNotifications()).filter((n) => !n.read_at).length;
}
export async function markNotificationRead(id) {
  const s = read();
  s.read = { ...s.read, [id]: new Date().toISOString() };
  write(s);
}
export async function markAllNotificationsRead() {
  for (const n of notifications) await markNotificationRead(n.id);
}
export async function subscribeNotifications() {
  return () => {};
}
const reviews = [
  {
    id: "demo-review-1",
    booking_id: "demo-completed",
    expert_id: "demo-lee",
    rating: 5,
    content: "계약에서 확인할 부분을 구체적으로 짚어주셨어요.",
    created_at: when,
    youth: { name: "김대표" },
    expert: {
      industry: "제조",
      headline: "자동차 부품사 구매팀",
      profiles: { name: "이승호 위원" },
    },
  },
  {
    id: "demo-review-2",
    expert_id: "demo-lee",
    rating: 4,
    content: "협의할 기준을 준비하는 데 도움이 됐어요.",
    created_at: when,
    youth: { name: "박청년" },
    expert: { industry: "제조", profiles: { name: "이승호 위원" } },
  },
];
export async function getMyReview(id) {
  return read().reviews?.[id] || null;
}
export async function addReview(id, rating, content) {
  if (await getMyReview(id)) throw new Error("이미 후기를 작성했어요.");
  const row = {
    id: "demo-written-" + id,
    booking_id: id,
    expert_id: "demo-lee",
    rating,
    content,
    created_at: new Date().toISOString(),
    youth: { name: "예시 사용자" },
    expert: reviews[0].expert,
  };
  const s = read();
  s.reviews = { ...s.reviews, [id]: row };
  write(s);
  return row;
}
export async function getRecentReviews() {
  return [...Object.values(read().reviews || {}), ...reviews];
}
export async function getReviews(id) {
  return (await getRecentReviews()).filter((r) => r.expert_id === id);
}
