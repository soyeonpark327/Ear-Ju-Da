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
export function avatar(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.href : "";
  } catch {
    return "";
  }
}
