import {
  renderReference,
  statusbar,
} from "./reference-examples.js?v=reference-1";
const params = new URLSearchParams(location.search);
const page = location.pathname
  .split("/")
  .pop()
  .replace(/\.html$/, "");
const scripts = JSON.parse(document.body.dataset.referenceScripts || "[]");
if (params.get("demo") === "1" && renderReference()) {
  document.title = `${{ home: "메인", matching: "Ai 매칭", chat: "상담 채팅", mypage: "마이페이지" }[page] || "이어주다"} | 디자인 예시`;
} else {
  document.body.classList.add("reference-design", "r-page-" + page);
  document.querySelector(".app")?.insertAdjacentHTML("afterbegin", statusbar());
  const modules = scripts.length ? scripts : [`../js/pages/${page}.js`];
  for (const script of modules)
    await import(new URL(script, document.baseURI).href);
  await import("./reference-live-layout.js?v=reference-1");
}
