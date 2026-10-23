import { statusbar, icon } from "./mobile-views.js?v=fix-5";
const rows = [
  {
    initial: "박",
    name: "박*연",
    job: "스타터 · 식품 제조",
    date: "10.12",
    stars: 5,
    mode: "call",
    body: "납품 계약서 초안을 화면 공유로 같이 보면서 조항을 하나씩 짚어주셨어요. ‘품질 기준은 추후 협의’ 문구를 그 자리에서 고쳐서 다시 보냈어요.",
    tag: "계약서를 같이 봐 줘요",
    count: 24,
  },
  {
    initial: "최",
    name: "최*우",
    job: "예비 창업 · 자동차 부품",
    date: "10.05",
    stars: 5,
    mode: "chat",
    body: "첫 발주 수량을 어떻게 정할지 막막했는데, 최소 주문 수량을 협상하는 순서를 단계별로 정리해 주셨어요. 답장도 빨랐어요.",
    tag: "바로 써먹을 수 있어요",
    count: 11,
  },
  {
    initial: "이",
    name: "이*준",
    job: "스타터 · 금속 가공",
    date: "09.28",
    stars: 4,
    mode: "call",
    body: "단가 협상 때 먼저 꺼내면 안 되는 말을 알게 됐어요. 할 얘기가 많아서 1시간이 짧게 느껴졌어요. 다음엔 오답노트를 먼저 읽고 가려고요.",
    tag: "실무 경험이 풍부해요",
    count: 8,
  },
  {
    initial: "정",
    name: "정*아",
    job: "스타터 · 화장품",
    date: "09.20",
    stars: 5,
    mode: "chat",
    body: "OEM 업체와 계약하기 전에 꼭 확인할 항목을 목록으로 받아서 그대로 썼어요. 상담 끝나고 받은 AI 전략 보고서도 도움이 됐어요.",
    tag: "바로 써먹을 수 있어요",
    count: 6,
  },
];
document.body.className = "mobile-design mobile-ui r-reviews-page";
document.body.innerHTML = `<div class="app r-app">${statusbar()}<header class="v-header"><a href="expert-booking.html?id=preview-lee" aria-label="이전 화면">${icon("back")}</a><h1>위원 프로필</h1></header><main><section class="v-profile"><div class="v-person"><span class="v-avatar">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="7" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/></svg>'}</span><div><h2>이승호 위원 <small>♧ 경력 인증</small></h2><p>자동차 부품사 구매팀 32년</p></div></div><div class="v-tags"><span>계약</span><span>구매·조달</span><span>품질 관리</span></div><div class="v-stats"><div>상담<b>146회</b></div><div>다시 찾은 창업가<b>38%</b></div><div>평균 응답<b>2시간</b></div></div></section><nav class="v-tabs"><a href="expert-booking.html?id=preview-lee">소개</a><span aria-current="page">후기 <em>128</em></span><a href="notes.html">오답노트 5</a></nav><section class="v-summary"><div><span class="v-stars">★★★★★</span><b>4.9</b><small>후기 128개</small></div><p>이런 점이 좋았어요</p>${[
  ["실무 경험이 풍부해요", 112],
  ["계약서를 같이 봐 줘요", 86],
  ["바로 써먹을 수 있어요", 74],
]
  .map(
    ([label, n]) =>
      `<div class="v-bar" style="--fill:${(n / 128) * 100}%"><span>${label}</span><small>${n}</small></div>`,
  )
  .join(
    "",
  )}</section><section class="v-list"><div class="v-filters"><button data-filter="all" aria-pressed="true">전체 128</button><button data-filter="call" aria-pressed="false">통화 상담 84</button><button data-filter="chat" aria-pressed="false">채팅 상담 44</button><button class="v-sort" aria-label="후기 정렬">최신순⌄</button></div><div id="v-rows">${rows.map((r, i) => `<article data-mode="${r.mode}" data-index="${i}"><header><span class="v-initial">${r.initial}</span><div><b>${r.name}</b><p>${r.job}</p></div><time>${r.date}</time></header><div class="v-rating"><span class="v-stars">${"★".repeat(r.stars)}<i>${"★".repeat(5 - r.stars)}</i></span><span>${r.mode === "call" ? "♧ 1시간 통화 상담" : "⌕ 채팅 상담"}</span></div><p class="v-body">${r.body}</p><footer><span>${r.tag}</span><button aria-pressed="false" data-count="${r.count}">${icon("like")} 도움돼요 ${r.count}</button></footer></article>`).join("")}</div><button class="v-more">후기 124개 더 보기</button><p id="v-status" role="status" hidden></p></section></main><footer class="v-book"><div><b>12,000P</b><small>1시간 통화 상담</small></div><a href="expert-booking.html?id=preview-lee&calendar=1">상담 예약하기</a></footer></div>`;
document.querySelectorAll("[data-filter]").forEach(
  (button) =>
    (button.onclick = () => {
      document
        .querySelectorAll("[data-filter]")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      document
        .querySelectorAll("#v-rows article")
        .forEach(
          (row) =>
            (row.hidden =
              button.dataset.filter !== "all" &&
              row.dataset.mode !== button.dataset.filter),
        );
    }),
);
document.querySelectorAll("article footer button").forEach(
  (button) =>
    (button.onclick = () => {
      const active = button.getAttribute("aria-pressed") !== "true";
      button.setAttribute("aria-pressed", String(active));
      button.lastChild.textContent = ` 도움돼요 ${Number(button.dataset.count) + (active ? 1 : 0)}`;
    }),
);
document.querySelector(".v-sort").onclick = (event) => {
  const reverse = event.currentTarget.textContent === "최신순⌄";
  event.currentTarget.textContent = reverse ? "오래된순⌄" : "최신순⌄";
  const host = document.querySelector("#v-rows");
  [...host.children]
    .sort((a, b) =>
      reverse
        ? b.dataset.index - a.dataset.index
        : a.dataset.index - b.dataset.index,
    )
    .forEach((row) => host.append(row));
};
document.querySelector(".v-more").onclick = () => {
  const status = document.querySelector("#v-status");
  status.hidden = false;
  status.textContent = "현재 공개된 후기 4개를 모두 표시하고 있어요.";
};
