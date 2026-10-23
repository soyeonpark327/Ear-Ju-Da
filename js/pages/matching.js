import { demo, init, route, notice, escape, avatar } from "./ui.js";
init();
const input = document.getElementById("concern");
const send = document.getElementById("send");
const conversation = document.getElementById("matching-conversation");
const intro = document.querySelector(".matching-intro");
const examples = [...document.querySelectorAll(".suggestions button")];
let busy = false;
const supplied = new URLSearchParams(location.search).get("keyword");
if (supplied) input.value = supplied.slice(0, 1000);
function update() {
  send.disabled = busy || !input.value.trim();
  send.setAttribute("aria-label", busy ? "베테랑을 찾는 중" : "베테랑 찾기");
  examples.forEach((b) =>
    b.setAttribute(
      "aria-pressed",
      String(input.value === b.textContent.trim()),
    ),
  );
}
examples.forEach(
  (b) =>
    (b.onclick = () => {
      input.value = b.textContent.trim();
      update();
      input.focus();
    }),
);
input.addEventListener("input", update);
document.getElementById("attach").onclick = () =>
  notice(
    "첨부 기능 준비 중",
    "현재는 글로 고민을 입력할 수 있어요. 첨부 파일은 아직 전송하지 않아요.",
  );
function searchKeyword(text) {
  const rules = [
    [/노무|채용|직원|근로|급여|퇴직/, "노무"],
    [/납품|단가|거래처/, "납품"],
    [/계약/, "계약"],
    [/지원금|지원사업|보조금/, "지원금"],
    [/세무|세금|부가세/, "세무"],
    [/마케팅|광고|홍보/, "마케팅"],
    [/수출|해외|무역/, "무역"],
  ];
  let keyword = rules.find(([pattern]) => pattern.test(text))?.[1] || text;
  if (demo) keyword = { 납품: "계약", 지원금: "자금" }[keyword] || keyword;
  return keyword;
}
function scrollToLatest() {
  conversation.scrollTop = conversation.scrollHeight;
}
function addUser(text) {
  const p = document.createElement("p");
  p.className = "user-message";
  p.textContent = text;
  conversation.append(p);
}
function addReply() {
  const row = document.createElement("article");
  row.className = "assistant-message";
  row.innerHTML =
    '<span class="assistant-avatar" aria-hidden="true">✦</span><div class="assistant-content"><p class="assistant-name">이어주다 AI</p><p class="assistant-bubble">관련 베테랑을 찾고 있어요…</p><div class="recommendations"></div></div>';
  conversation.append(row);
  return row;
}
function expertCard(expert) {
  const card = document.createElement("article");
  card.className = "matching-expert-card";
  const photo = demo ? expert.avatar_url : avatar(expert.avatar_url);
  const summary =
    expert.career_summary ||
    (expert.keywords || []).join(" · ") ||
    expert.headline ||
    "경력 정보는 프로필에서 확인해주세요.";
  card.innerHTML = `<div class="recommendation-heading"><div class="recommendation-avatar">${photo ? `<img src="${escape(photo)}" alt="">` : `<span aria-hidden="true">${escape((expert.name || "베")[0])}</span>`}</div><div class="recommendation-person"><h2>${escape(expert.name || "베테랑")}</h2><p>${escape(expert.headline || "")}</p></div><p class="recommendation-score"><strong>${escape(demo ? expert.review_count : expert.rating || "—")}</strong><small>${demo ? "매칭 예시" : "평점"}</small></p></div><p class="recommendation-summary">${escape(summary)}</p><div class="recommendation-actions"><a class="profile-action" href="${escape(route("expert-booking.html", { id: expert.id }))}">프로필 보기</a><a class="booking-action" href="${escape(route("booking.html", { id: expert.id }))}">상담 예약</a></div>`;
  const img = card.querySelector("img");
  if (img)
    img.onerror = () => {
      const span = document.createElement("span");
      span.textContent = (expert.name || "베")[0];
      img.replaceWith(span);
    };
  return card;
}
async function findExperts(text, reply) {
  busy = true;
  update();
  const bubble = reply.querySelector(".assistant-bubble");
  const cards = reply.querySelector(".recommendations");
  cards.replaceChildren();
  bubble.textContent = "관련 베테랑을 찾고 있어요…";
  conversation.setAttribute("aria-busy", "true");
  scrollToLatest();
  try {
    const keyword = searchKeyword(text);
    let rows;
    if (demo) {
      const data = await import("./demo-data.js");
      rows = data.experts.filter((e) =>
        `${e.name} ${e.headline} ${e.career_summary || ""} ${(e.keywords || []).join(" ")}`.includes(
          keyword,
        ),
      );
    } else {
      const { getExperts } = await import("../api/experts.js");
      rows = await getExperts({ keyword });
      // Older cached API modules used exact keyword matching. Recheck the
      // public list so a related compound keyword such as 지원금정산 is found.
      if (!rows.length) {
        const all = await getExperts();
        const words = keyword
          .toLocaleLowerCase("ko-KR")
          .split(/\s+/)
          .filter(Boolean);
        rows = all.filter((e) => {
          const searchable = [
            e.name,
            e.headline,
            e.industry,
            e.career_summary,
            e.search_text,
            ...(e.keywords || []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("ko-KR");
          return words.every((word) => searchable.includes(word));
        });
      }
    }
    if (!rows.length) {
      bubble.textContent =
        "관련 베테랑을 아직 찾지 못했어요. 계약, 노무, 지원금처럼 분야를 바꿔서 적어주세요.";
    } else {
      bubble.textContent =
        demo && keyword === "계약"
          ? "납품 단가 분쟁을 많이 다뤄본 베테랑을 찾았어요."
          : "입력한 내용의 키워드와 관련된 베테랑을 찾았어요.";
      rows.slice(0, 3).forEach((e) => cards.append(expertCard(e)));
    }
  } catch (e) {
    bubble.textContent = /fetch|network|load failed/i.test(e.message || "")
      ? "서버에 연결하지 못했어요. 연결을 확인하고 다시 시도해주세요."
      : e.message || "베테랑을 찾지 못했어요. 다시 시도해주세요.";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "matching-retry";
    retry.textContent = "다시 시도";
    retry.onclick = () => {
      if (!busy) findExperts(text, reply);
    };
    cards.append(retry);
  } finally {
    busy = false;
    conversation.setAttribute("aria-busy", "false");
    update();
    scrollToLatest();
  }
}
document.getElementById("matching-form").onsubmit = (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || busy) {
    update();
    return;
  }
  intro.hidden = true;
  conversation.hidden = false;
  document.querySelector(".matching-main").classList.add("has-results");
  input.value = "";
  input.placeholder = "메시지를 입력하세요";
  addUser(text);
  const reply = addReply();
  findExperts(text, reply);
};
update();
window.addEventListener("pageshow", update);
