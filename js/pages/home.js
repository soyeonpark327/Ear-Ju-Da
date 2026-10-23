import {
  demo,
  money,
  escape,
  route,
  notice,
  status,
  init,
  avatar,
} from "./ui.js?v=header-links-1";
init();
const categories = [
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
const icons = new Set([
  "계약",
  "노무",
  "세무",
  "자금",
  "마케팅",
  "인허가",
  "데이터",
]);
document.querySelector("#categories").innerHTML = categories
  .map(
    (name, i) =>
      `<a class="category" href="${escape(route("notes.html", { category: name }))}">${icons.has(name) ? `<img src="../assets/home/${name}.svg" alt="">` : `<span class="symbol" aria-hidden="true">${["◇", "◎", "✧"][i === 4 ? 0 : i === 7 ? 1 : 2]}</span>`}${name}</a>`,
  )
  .join("");
document.querySelector("#notifications").onclick = () =>
  notice("알림", "새로운 알림이 없어요.");
let allExperts = [],
  limit = 3,
  request = 0;
function remember(expert) {
  try {
    const old = JSON.parse(localStorage.getItem("earjuda-recent") || "[]");
    const rows = Array.isArray(old) ? old : [];
    localStorage.setItem(
      "earjuda-recent",
      JSON.stringify(
        [
          { id: expert.id, name: expert.name },
          ...rows.filter((e) => e.id !== expert.id),
        ].slice(0, 6),
      ),
    );
  } catch {
    /* Storage is optional. */
  }
  renderRecent();
}
function renderRecent() {
  const box = document.querySelector("#recent");
  box.replaceChildren();
  let rows = [];
  try {
    const value = JSON.parse(localStorage.getItem("earjuda-recent") || "[]");
    rows = Array.isArray(value) ? value : [];
  } catch {
    /* Storage is optional. */
  }
  box.closest(".recent").hidden = !rows.length;
  if (!rows.length) return;
  rows.forEach((row) => {
    const b = document.createElement("button");
    b.textContent = row.name;
    b.onclick = () => {
      const e = allExperts.find((e) => e.id === row.id);
      if (e) openExpert(e);
      else notice(row.name, "검색에서 이 베테랑을 다시 찾아보세요.");
    };
    box.append(b);
  });
}
function openExpert(e) {
  remember(e);
  location.href = route("expert-booking.html", { id: e.id });
}
document.querySelector("#reserve-nav").onclick = () => {
  location.href = route("booking.html");
};
// 신뢰 등급 뱃지 (gold / silver / bronze). 예시 데이터에는 없어서 표시하지 않는다.
const trustBadge = (e) =>
  e.trust_label
    ? ` <span class="trust trust-${escape(e.trust_grade)}">${escape(e.trust_label)}</span>`
    : "";
// Fictional AI portraits are illustrative placeholders, never identity photos.
function expertPortrait(expert) {
  const files = ["man-v1.jpg", "woman-v1.jpg", "senior-v1.jpg"];
  const examples = { "demo-lee": 0, "demo-park": 1, "demo-jung": 2 };
  // The repository seed personas have fixed illustrative portraits.
  const seedPersonas = {
    이정훈: 0,
    최동수: 2,
    김영숙: 1,
    박미경: 1,
    정성호: 2,
    한상철: 0,
    오명수: 2,
  };
  const hash = [...String(expert.id || expert.name || "expert")].reduce(
    (n, c) => (n * 31 + c.charCodeAt(0)) >>> 0,
    0,
  );
  const fallback = `../assets/home/ai-portraits/${files[examples[expert.id] ?? seedPersonas[expert.name] ?? hash % files.length]}`;
  const frame = document.createElement("span");
  frame.className = "expert-portrait-frame";
  const img = document.createElement("img");
  img.className = "portrait";
  img.loading = "lazy";
  img.decoding = "async";
  img.width = 64;
  img.height = 84;
  const label = document.createElement("span");
  label.className = "expert-portrait-label";
  label.textContent = "AI 예시";
  let illustrative = false;
  const useExample = () => {
    illustrative = true;
    img.alt = "AI로 생성한 예시 인물 사진 · 실제 베테랑의 모습이 아니에요";
    label.hidden = false;
    img.src = fallback;
  };
  img.onerror = () => {
    if (!illustrative) {
      useExample();
      return;
    }
    const initial = document.createElement("span");
    initial.className = "portrait initial";
    initial.setAttribute("aria-hidden", "true");
    initial.textContent = (expert.name || "베")[0];
    img.replaceWith(initial);
    label.hidden = true;
  };
  const original = demo ? "" : avatar(expert.avatar_url);
  if (original) {
    img.alt = "";
    label.hidden = true;
    img.src = original;
  } else useExample();
  frame.append(img, label);
  return frame;
}
function renderExperts() {
  const box = document.querySelector("#experts");
  box.replaceChildren();
  allExperts.slice(0, limit).forEach((e) => {
    const b = document.createElement("button");
    b.className = "expert";
    b.innerHTML = `<div class="expert-info"><div class="expert-top"><div><h3>${escape(e.name)}${trustBadge(e)}</h3><p class="sub">${escape(e.headline)}</p></div><div class="rating">${escape(e.rating || "-")}<small>평점</small></div></div><div class="career"><span class="bars" aria-hidden="true">${Array.from({ length: 22 }, (_, i) => `<i style="height:${6 + ((i * 7) % 17)}px"></i>`).join("")}</span>${escape(e.career_years || 0)}년</div><p class="career-summary">${escape(e.career_summary || (e.keywords || []).join(" · "))}</p></div>`;
    b.onclick = () => openExpert(e);
    b.prepend(expertPortrait(e));
    box.append(b);
  });
  document.querySelector("#more").hidden = allExperts.length <= limit;
}
async function loadExperts(keyword = "") {
  const version = ++request;
  allExperts = [];

  status("expert-status", "베테랑을 불러오고 있어요.");
  document.querySelector("#experts").replaceChildren();
  document.querySelector("#more").hidden = true;
  try {
    let rows;
    if (demo) {
      const data = await import("./demo-data.js");
      rows = data.experts.filter((e) =>
        `${e.name} ${e.headline} ${e.keywords.join(" ")}`.includes(keyword),
      );
    } else {
      const { getExperts } = await import("../api/experts.js");
      rows = await getExperts({ keyword });
    }
    if (version !== request) return;
    allExperts = rows;
    limit = 3;
    renderExperts();
    status(
      "expert-status",
      rows.length
        ? keyword
          ? `“${keyword}” 검색 결과 ${rows.length}명`
          : ""
        : "검색 결과가 없어요. 다른 키워드로 찾아보세요.",
    );
  } catch (e) {
    if (version === request)
      status("expert-status", e.message || "베테랑을 불러오지 못했어요.", () =>
        loadExperts(keyword),
      );
  }
}
document.querySelector("#more").onclick = () => {
  limit += 3;
  renderExperts();
};
document.querySelector("#search-form").onsubmit = (e) => {
  e.preventDefault();
  location.href = route("matching.html", {
    keyword: document.querySelector("#keyword").value.trim(),
  });
};
async function loadNotes() {
  status("note-status", "오답노트를 불러오고 있어요.");
  try {
    const rows = demo
      ? (await import("./demo-data.js")).notes
      : await (await import("../api/notes.js")).getNotes({ sort: "popular" });
    document.querySelector("#popular").innerHTML = rows
      .slice(0, 2)
      .map(
        (n, i) =>
          `<li><a href="${escape(route("note-detail.html", { id: n.id }))}"><strong>${i + 1}</strong><span class="paper" aria-hidden="true"></span><div><p class="author">${escape(n.author?.profiles?.name || "베테랑")}</p><h3>${escape(n.title)}</h3><small>${money(n.price_points)} P</small></div><span class="read">읽어보기</span></a></li>`,
      )
      .join("");
    status("note-status", rows.length ? "" : "아직 등록된 오답노트가 없어요.");
  } catch (e) {
    status(
      "note-status",
      e.message || "오답노트를 불러오지 못했어요.",
      loadNotes,
    );
  }
}
renderRecent();
loadExperts();
loadNotes();
