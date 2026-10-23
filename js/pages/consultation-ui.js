import { demo, money, route, status, goLogin } from "./ui.js";
export const $ = (id) => document.getElementById(id);
export const dateTime = (value) => {
  if (!value || !Number.isFinite(new Date(value).getTime()))
    return "시간 정보가 없어요";
  return new Date(value).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  });
};
export const schedule = (booking) =>
  `${dateTime(booking.slot?.start_at)} ~ ${dateTime(booking.slot?.end_at)} · 한국 시간`;
export const stateLabel = (state) =>
  ({
    confirmed: "예약된 상담",
    completed: "상담 완료",
    cancelled: "취소된 상담",
  })[state] || "상태 확인 필요";
export const person = (booking, me) =>
  booking.youth_id === me.id
    ? booking.expert?.profiles?.name || "베테랑"
    : booking.youth?.name || "청년 창업가";
export const isParticipant = (booking, me) =>
  booking && [booking.youth_id, booking.expert_id].includes(me.id);
export async function services() {
  if (demo) return import("./consultation-demo.js");
  const [auth, bookings, chat] = await Promise.all([
    import("../api/auth.js"),
    import("../api/bookings.js"),
    import("../api/chat.js"),
  ]);
  return { ...auth, ...bookings, ...chat };
}
export function loginRequired(id) {
  status(id, "로그인하면 내 상담과 보고서를 확인할 수 있어요.");
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "로그인하기";
  button.onclick = goLogin;
  $(id).append(button);
}
export function showBookingContext(booking, me, prefix) {
  $(prefix + "-person").textContent = `${person(booking, me)} 님과의 상담`;
  $(prefix + "-schedule").textContent = schedule(booking);
  $(prefix + "-topic").textContent =
    booking.topic || "등록된 상담 내용이 없어요.";
  $(prefix + "-booking-status").textContent = stateLabel(booking.status);
}
export function card(booking, me) {
  const article = document.createElement("article");
  article.className = "consultation-card";
  for (const [tag, text] of [
    ["span", stateLabel(booking.status)],
    ["h2", `${person(booking, me)} 님과의 상담`],
    ["p", schedule(booking)],
    ["p", booking.topic || "상담 내용이 없어요."],
    ["p", `${money(booking.price_points)}P`],
  ]) {
    const el = document.createElement(tag);
    el.textContent = text;
    if (tag === "span") el.className = "consultation-badge";
    article.append(el);
  }
  const actions = document.createElement("div");
  actions.className = "consultation-actions";
  const chat = document.createElement("a");
  chat.href = route("chat.html", { id: booking.id });
  chat.className = "outline";
  chat.textContent =
    booking.status === "confirmed" ? "채팅방 보기" : "대화 내역 보기";
  actions.append(chat);
  // 시작 전 예약: 시간 바꾸기·취소 화면으로
  if (booking.status === "confirmed" && new Date(booking.slot?.start_at) > new Date()) {
    const manage = document.createElement("a");
    manage.href = route("booking-manage.html", { id: booking.id });
    manage.className = "outline";
    manage.textContent = "일정 변경·취소";
    actions.append(manage);
  }
  if (booking.status === "completed") {
    const report = document.createElement("a");
    report.href = route("report.html", { id: booking.id });
    report.className = "primary";
    report.textContent = "보고서 보기";
    actions.append(report);
  }
  article.append(actions);
  return article;
}
