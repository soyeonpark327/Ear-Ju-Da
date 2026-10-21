import { demo, money, escape, route, status, init } from "./ui.js";
init();
const filters = [
  "전체",
  "계약",
  "노무",
  "세무",
  "자금",
  "판로",
  "마케팅",
  "인허가",
  "해외진출",
  "데이터",
  "지식재산",
];
let selected = new URLSearchParams(location.search).get("category") || "전체",
  version = 0;
if (!filters.includes(selected)) selected = "전체";
function renderFilters() {
  const box = document.querySelector("#filters");
  box.replaceChildren();
  filters.forEach((name) => {
    const b = document.createElement("button");
    b.textContent = name;
    b.setAttribute("aria-pressed", String(selected === name));
    b.onclick = () => {
      selected = name;
      const url = new URL(location.href);
      url.searchParams.set("category", name);
      history.replaceState(null, "", url);
      renderFilters();
      load();
    };
    box.append(b);
  });
}
async function load() {
  const current = ++version;
  const box = document.querySelector("#notes");
  box.replaceChildren();
  status("list-status", "오답노트를 불러오고 있어요.");
  try {
    let rows = demo
      ? (await import("./demo-data.js")).notes
      : await (await import("../api/notes.js")).getNotes();
    if (current !== version) return;
    if (selected !== "전체")
      rows = rows.filter(
        (n) => n.industry === selected || (n.keywords || []).includes(selected),
      );
    box.innerHTML = rows
      .map(
        (n) =>
          `<a class="note-card" href="${escape(route("note-detail.html", { id: n.id }))}"><div class="note-top"><span class="cross" aria-hidden="true">×</span><div><h2>${escape(n.title)}</h2><p class="note-author">${escape(n.author?.profiles?.name || "베테랑")}<span>${escape(n.author?.headline || "")}</span></p></div></div><div class="note-bottom">${n.loss ? `<span>${escape(n.loss)} <span class="loss">${escape(n.amount)}</span></span>` : ""}<strong>${n.price_points ? `${money(n.price_points)} P` : "미리보기"}</strong></div></a>`,
      )
      .join("");
    status(
      "list-status",
      rows.length ? "" : "이 분야의 오답노트가 아직 없어요.",
    );
  } catch (e) {
    if (current === version)
      status("list-status", e.message || "목록을 불러오지 못했어요.", load);
  }
}
renderFilters();
load();
