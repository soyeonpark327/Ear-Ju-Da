export const demo = new URLSearchParams(location.search).get("demo") === "1";
export const money = (value) => Number(value || 0).toLocaleString("ko-KR");
export const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function route(path, values = {}) {
  const url = new URL(path, location.href);
  if (demo) url.searchParams.set("demo", "1");
  Object.entries(values).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.href;
}
// 로그인 화면 주소. 로그인 후 지금 보던 화면으로 돌아온다.
export function loginUrl() {
  const url = new URL("login.html", location.href);
  url.searchParams.set("next", location.pathname + location.search);
  return url.href;
}
export function goLogin() {
  location.href = loginUrl();
}
export function notice(title, body) {
  document.querySelector("#notice-title").textContent = title;
  document.querySelector("#notice-body").textContent = body;
  document.querySelector("#notice").showModal();
}
export function status(id, message, retry) {
  const el = document.getElementById(id);
  el.textContent =
    /Failed to fetch|fetch dynamically imported|Load failed/i.test(message)
      ? "서버에 연결하지 못했어요. 네트워크 연결을 확인하고 다시 시도해주세요."
      : message;
  if (retry) {
    const b = document.createElement("button");
    b.textContent = "다시 시도";
    b.onclick = retry;
    el.append(b);
  }
}
export function init() {
  document
    .querySelectorAll("[data-route]")
    .forEach((a) => (a.href = route(a.getAttribute("href"))));
  document
    .querySelectorAll("[data-coming]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          notice(
            b.dataset.coming,
            "이 화면은 준비 중이에요. 베테랑과 오답노트를 먼저 둘러보세요.",
          )),
    );
  renderAccount();
  if (demo) {
    const banner = document.createElement("p");
    banner.className = "demo-banner";
    banner.textContent = "디자인 미리보기 · 예시 데이터입니다. ";
    const a = document.createElement("a");
    a.href = location.pathname;
    a.textContent = "실제 서비스 보기";
    banner.append(a);
    document.querySelector(".app").prepend(banner);
  }
}
// 헤더의 #account 링크: 로그인 전엔 "로그인", 후엔 "이름 · 포인트"
async function renderAccount() {
  const el = document.getElementById("account");
  if (!el) return;
  el.href = loginUrl();
  if (demo) return;
  try {
    const me = await (await import("../api/auth.js")).getMyProfile();
    if (me) {
      el.textContent = `${me.name} · ${money(me.points)}P`;
      el.setAttribute("aria-label", `내 계정: ${me.name}, 보유 포인트 ${money(me.points)}P`);
    }
  } catch {
    // 연결 실패 시 "로그인" 그대로 둔다
  }
}
export function avatar(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.href : "";
  } catch {
    return "";
  }
}
