import { applyFinalMetrics } from "./reference-final-metrics.js?v=reference-1";
// Exact supplied examples are isolated from authenticated production data.
const params = new URLSearchParams(location.search);
const page = location.pathname.split("/").pop().replace(".html", "");
const link = (name, query = "") =>
  `${name}.html?demo=1${query ? "&" + query : ""}`;
const portrait = (who = "lee") => `../assets/home/expert-${who}.png`;
const icons = {
  back: '<path d="m14 5-6 7 6 7"/>',
  arrow: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6 3 6 3 8H3c0-2 3-2 3-8m6 10a2 2 0 0 1-4 0"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 11h18m-13 4h1m3 0h1m3 0h1m-9 3h1m3 0h1"/>',
  chat: '<path d="M4 4h16v13H9l-5 4V4Z M8 8h8M8 12h6"/>',
  lock: '<rect x="6" y="10" width="12" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
  paper: '<path d="M6 2h8l5 5v15H6V2Z M14 2v6h5M9 12h7M9 16h7"/>',
  phone:
    '<path d="M7 3 4 5c-2 5 8 17 13 15l3-3-5-4-2 2c-3-1-5-4-5-6l2-2-3-4Z"/>',
  shield:
    '<path d="m12 2 8 3v6c0 6-8 11-8 11S4 17 4 11V5l8-3Z m-4 9 3 3 5-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v7l4 2"/>',
  chevron: '<path d="m9 4 7 8-7 8"/>',
  down: '<path d="m5 9 7 6 7-6"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/>',
  bulb: '<path d="M8 17c0-3-4-4-4-8a8 8 0 0 1 16 0c0 4-4 5-4 8H8Zm0 3h8m-6 3h4M8 8q4 4 8 0"/>',
  box: '<path d="m12 2 10 5-10 5L2 7l10-5Zm0 10v10M2 7v10l10 5 10-5V7"/>',
};
export const icon = (name, cls = "") =>
  `<svg class="r-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.paper}</svg>`;
export const statusbar = () =>
  `<div class="r-statusbar" aria-hidden="true"><b>9:41</b><span><svg viewBox="0 0 20 16"><rect x="1" y="11" width="3" height="4" rx="1"/><rect x="6" y="8" width="3" height="7" rx="1"/><rect x="11" y="4" width="3" height="11" rx="1"/><rect x="16" y="1" width="3" height="14" rx="1"/></svg><svg viewBox="0 0 20 16"><path d="M1 5Q10-2 19 5M4 8Q10 3 16 8M7 11q3-3 6 0" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="10" cy="14" r="1.4"/></svg><svg class="battery" viewBox="0 0 28 14"><rect x=".5" y=".5" width="24" height="12" rx="3" fill="none" stroke="#888"/><rect x="2" y="2" width="21" height="9" rx="2"/><path d="M26 4v5" stroke="#888" stroke-width="2"/></svg></span></div>`;
const header = (title, back = "home", extra = "") =>
  `<header class="r-header"><a href="${link(back)}" aria-label="이전 화면">${icon("back")}</a><h1>${title}</h1>${extra}</header>`;
const bars = (n = 48) =>
  `<span class="r-bars" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i style="height:${[6, 6, 6, 6, 6, 8, 17, 10, 6, 10, 6, 13, 17, 6, 8, 14, 6, 6, 8, 13, 5, 8, 11, 18, 6, 5, 5, 6, 12, 11, 6, 6, 14, 17, 6, 10, 9, 14, 16, 14, 6, 7, 16, 5, 8, 7, 9, 6][i % 48]}px"></i>`).join("")}</span>`;
const composer = (placeholder = "메세지를 입력해주세요.") =>
  `<form class="r-composer" id="r-compose"><button type="button" id="r-attach" aria-label="사진 첨부">＋</button><input id="r-message" placeholder="${placeholder}" aria-label="${placeholder}" maxlength="1000"/><button type="submit" class="r-send" aria-label="전송">${icon("arrow")}</button><input type="file" id="r-photo" accept="image/jpeg,image/png,image/webp" hidden/><div id="r-photo-preview" hidden></div></form>`;
const expertIntro = () =>
  `<div class="r-profile-intro"><img src="${portrait()}" alt=""/><div><h2>이승호 위원</h2><p>자동차 부품사 구매팀 | 2024년 정년퇴임</p></div></div><div class="r-experience"><p>현장에서 보낸 시간</p>${bars(66)}<div><span>1994</span><span>2024　 2027</span></div></div><div class="r-tags"><span>근속 30년 인증</span><span>납품 계약</span><span>단가협상</span><span>답변채택 128건</span></div><button class="r-tip-count" data-action="tips">12개 ›</button><h2 class="r-tip-title">누군가의 질문, 모두의 답</h2><div class="r-tip"><p>“계약서에서 제일 위험한 건 불리한 조항이 아니라, 아무 말도 안 적혀있는 칸입니다.”</p><small>단기 조정 질문에 대한 답변 <em>채택됨</em></small></div>`;
const expertCard = (e) =>
  `<a class="r-expert" href="${link("expert-booking", "id=" + e.id)}"><img src="${portrait(e.photo)}" alt=""/><div class="r-expert-info"><h3>${e.name}</h3><p class="r-sub">${e.headline}</p><div class="r-career">${bars(33)}<b>${e.years}년</b></div><p class="r-career-summary">${e.summary}</p></div><div class="r-score"><strong>${e.score}</strong><small>매칭</small></div></a>`;
const people = [
  {
    id: "demo-lee",
    photo: "lee",
    name: "이승호 위원",
    headline: "자동차 부품사 구매팀",
    years: 32,
    score: 94,
    summary: "발주처 계약 실무 30년, 납품 단가 분쟁 47건 대응",
  },
  {
    id: "demo-park",
    photo: "park",
    name: "박정미 대표",
    headline: "중소 제조 창업 · 폐업 경험",
    years: 26,
    score: 71,
    summary: "제조업 창업부터 폐업까지, 현장 실무 경험",
  },
  {
    id: "demo-jung",
    photo: "jung",
    name: "정광일 노무사",
    headline: "제조업 노무 · 산업 안전",
    years: 22,
    score: 71,
    summary: "제조업 현장을 이해하는 노무·산업안전 전문가",
  },
];
function home() {
  return `${statusbar()}<header class="r-home-header"><a href="${link("notifications")}" aria-label="알림">${icon("bell")}</a></header><main id="main"><div class="r-home-top"><form class="r-search" action="matching.html"><input name="demo" value="1" type="hidden"/><label>${icon("search")}<input name="keyword" placeholder="무슨 문제를 겪고 계신가요?" aria-label="고민 검색"/></label><button>Ai 매칭 <span class="r-spark">✦</span></button></form><nav class="r-categories">${["계약", "노무", "세무", "자금", "판로", "마케팅", "인허가", "해외진출", "데이터", "지식재산"].map((n, i) => `<a href="${link("notes", "category=" + encodeURIComponent(n))}">${[0, 1, 2, 3, 5, 6, 8].includes(i) ? `<img src="../assets/home/${n}.svg" alt=""/>` : icon(["", "", "", "", "box", "", "", "globe", "", "bulb"][i])}<span>${n}</span></a>`).join("")}</nav></div><section class="r-home-experts"><h2>경력으로 증명된 베테랑</h2><div id="r-experts">${people.map(expertCard).join("")}</div><button class="r-more" id="r-more" aria-expanded="false">베테랑 더보기 ${icon("down")}</button></section><section class="r-recent"><h2>내가 둘러본 베테랑</h2><div>${["마케팅", "인허가", "지식재산", "창업", "경제", "자금", "해외진출"].map((n) => `<a href="${link("notes", "category=" + encodeURIComponent(n))}">${n}</a>`).join("")}</div></section><section class="r-popular"><h2>가장 많이 열람된 <a href="${link("notes")}">오답노트</a></h2><ol>${[
    {
      name: "김수현",
      title: "사업 망하기 전에 읽었어야 할 오답노트",
      count: 168,
      paper: "contract",
    },
    {
      name: "최희은",
      title: "계약서 한 줄 몰라서 2억 날린 공장 사장의 오답노트",
      count: 120,
      paper: "business",
    },
    {
      name: "강진욱",
      title: "세금 신고 한번 잘못해서 수천만원 토해낸 사람의 오답노트",
      count: 97,
      paper: "tax",
    },
  ]
    .map(
      (n, i) =>
        `<li><b>${i + 1}</b><img src="../assets/home/paper-${n.paper}.jpg" alt=""/><div><strong>${n.name}</strong><p>${n.title}</p><small>총 ${n.count}명 열람</small></div><a href="${link("note-detail", "id=demo-contract")}">읽어보기</a></li>`,
    )
    .join("")}</ol></section></main>`;
}
function profile() {
  const cal = params.get("calendar") === "1";
  return `${statusbar()}${header("예약하기")}<main id="main" class="r-profile">${expertIntro()}${cal ? calendar() : `<div class="r-profile-actions"><a href="${link("expert-booking", "id=demo-lee&calendar=1")}">${icon("calendar")} 날짜 선택</a><a href="${link("reviews", "expert=demo-lee")}">${icon("chat")} 후기 보기</a></div>`}</main>`;
}
function calendar() {
  return `<section class="r-calendar-section"><h2>${icon("calendar")} 날짜와 시간을 선택해주세요</h2><div class="r-month"><button id="r-prev-month" aria-label="이전 달">‹</button><b id="r-month-label">2026년 10월</b><button id="r-next-month" aria-label="다음 달">›</button></div><div class="r-weekdays">${"일월화수목금토"
    .split("")
    .map((n) => `<span>${n}</span>`)
    .join(
      "",
    )}</div><div class="r-calendar" id="r-calendar"></div><a class="r-primary" id="r-reserve" href="${link("booking", "id=demo-lee&date=2026-10-24")}">상담 예약하기</a></section>`;
}
function booking() {
  return `${statusbar()}${header("예약하기")}<main id="main" class="r-booking"><div class="r-date-strip">${["토", "일", "월", "화", "수"].map((n, i) => `<button class="${i === 2 ? "selected" : ""}" data-date="${24 + i}" aria-pressed="${i === 2}"><span>${n}</span><b>${24 + i}</b></button>`).join("")}</div><h2 id="r-day-heading">목요일</h2><div class="r-times"><button aria-pressed="true">14:00</button><button aria-pressed="false">16:00</button><button disabled>18:00 마감</button></div><div class="r-modes"><button class="r-mode selected" data-mode="call" aria-pressed="true"><span class="r-mode-icon">${icon("phone")}</span><span><b>1시간 1:1 통화 상담</b><small>자료를 공유하고 베테랑의 피드백까지</small></span><strong>12,000P</strong><i>추천</i></button><button class="r-mode" data-mode="chat" aria-pressed="false"><span class="r-mode-icon">${icon("chat")}</span><span><b>1시간 1:1 채팅 상담</b><small>채팅으로 편하게 질문</small></span><strong>10,000P</strong></button></div><div class="r-policies"><p>${icon("shield")}<span>결제한 포인트는 <b>상담이 끝난 뒤</b>에 베테랑에게 전달됩니다. 그 전까지는 플랫폼이 보관합니다.</span></p><p><span class="r-red-cross">×</span><span>상대방이 응답하지 않을 경우 <b>포인트는 환급되지 않으며, 신뢰 등급이 하락</b>합니다.</span></p></div><footer class="r-booking-footer"><button class="r-primary" id="r-book-submit">목요일 14:00으로 예약하기</button><p>보유 포인트 <b>31,500P</b></p></footer></main>`;
}
const question =
  "거래처가 납품 단가를 갑자기 낮추자고 해요. 어떻게 대응해야 할지 모르겠어요.";
function matchResult(text = question) {
  return `<section class="r-match-thread"><p class="r-user-bubble">${text}</p><div class="r-ai-reply"><span class="r-ai-avatar">✦</span><div><small>이어주다 Ai</small><p>납품 단가 분쟁을 많이 다뤄본 베테랑을 찾았어요.</p><article class="r-match-card"><div class="r-match-person"><img src="${portrait()}" alt=""/><div><h2>이승호 위원</h2><small>자동차 부품사 구매팀 | 2024년 정년퇴임</small></div><span><b>94</b><small>매칭</small></span></div><p>발주처 계약 실무 30년, 납품 단가 분쟁 47건 대응</p><div class="r-match-actions"><a href="${link("expert-booking", "id=demo-lee")}">프로필 보기</a><a href="${link("expert-booking", "id=demo-lee&calendar=1")}">상담 예약</a></div></article></div></div></section>`;
}
function matching() {
  const result = params.get("result") === "1";
  return `${statusbar()}${header("Ai 매칭")}<main id="main" class="r-matching ${result ? "has-result" : ""}"><div id="r-match-body">${result ? matchResult() : `<section class="r-match-intro"><span class="r-spark">✦</span><h2>어떤 문제를 겪고 계신가요?</h2><p>상황을 편하게 적어주시면<br/>Ai가 딱 맞는 베테랑을 찾아드려요</p><div class="r-suggestions">${["거래처가 남품 단가 인하를 요구해요", "첫 직원 채용, 근로계약서가 궁금해요", "정부 지원금 신청이 처음이에요"].map((n) => `<button>${n}</button>`).join("")}</div></section>`}</div>${composer(result ? "메세지를 입력해주세요." : "이어주다에게 말해주세요.")}</main>`;
}
const noteItems = [
  {
    title: "제조사 계약, 놓치면 손해 보는 조항 5가지",
    name: "이승호 위원",
    job: "자동차 부품사 구매팀",
    loss: "막을 수 있었던 손실",
    amount: "2천 5백만원",
    price: "5,900 P",
  },
  {
    title: "정부 지원사업 정신에서 다들 하는 실수",
    name: "김수현 사업가",
    job: "정부 지원사업 사업가",
    loss: "환수액",
    amount: "3,100만",
    price: "7,900 P",
  },
  {
    title: "해외 판로 개척에서 당한 사기 3가지 유형",
    name: "한종석",
    job: "무역 26년 담당",
    loss: "",
    amount: "",
    price: "미리보기",
  },
];
function notes() {
  return `${statusbar()}${header("오답노트")}<main id="main" class="r-notes"><nav class="r-note-filters">${["계약", "노무", "세무", "자금", "판로"].map((n, i) => `<button aria-pressed="${i === 0}">${n}</button>`).join("")}</nav><div class="r-note-list">${noteItems.map((n, i) => `<a class="r-note" href="${link("note-detail", "id=" + ["demo-contract", "demo-funding", "demo-export"][i])}"><div><span class="r-cross">×</span><section><h2>${n.title}</h2><p>${n.name} <span>${n.job}</span></p></section></div><footer><span>${n.loss} <b>${n.amount}</b></span><strong>${n.price}</strong></footer></a>`).join("")}</div></main>`;
}
function detail() {
  return `${statusbar()}${header("오답노트", "notes")}<main id="main" class="r-detail"><section class="r-note-overview"><span class="r-category">계약</span><h2>초보 창업가가 제조사 계약 시 놓치면 100% 손해<br class="r-wide-break"/>보는 조항 5가지</h2><div class="r-author"><img src="${portrait()}" alt=""/><div><b>이승호 위원</b><p>자동차 부품사 구매팀 32년</p></div></div><p class="r-note-meta">오답 5개 | 계약서 서식 1종 | 214명 열람</p></section><section class="r-preview"><h2>무료 미리보기 <span>오답 3 / 5</span></h2><div class="r-timeline"><div class="r-timeline-row"><span>${icon("paper")}</span><section><small>문제</small><h3>”품질 기준은 추후 협의한다”</h3></section></div><div class="r-timeline-row"><span class="bad">×</span><section><small>당시 판단</small><p>’추후 협의’라고 적혀 있으니 나중에 우리 의견도<br/>반영되겠지. 일단 계약부터 따내자.</p></section></div><div class="r-timeline-row"><span class="bad">!</span><section><small>결과</small><p>거래처가 정한 기준으로 불량 판정을 받아 반품·재작업<br/>비용 <b class="red">2,500만 원</b>을 떠안았어요.</p></section></div><div class="r-timeline-row"><span class="good">✓</span><section><small class="cyan">정답</small><div class="r-answer">’합의 전까지는 KS 규격을 따른다’처럼 <em>임시기준<br/>이라도 계약서에 꼭 적어놓으세요.</em></div></section></div></div></section><section class="r-locked"><h2>나머지 오답 4개 <span>계약서 서식 포함</span></h2>${[1, 2, 4, 5].map((n, i) => `<div>오답 ${n}<i style="width:${[193, 148, 193, 167][i]}px"></i>${icon("lock")}</div>`).join("")}<div>${icon("paper")} 계약서 서식 1종 ${icon("lock")}</div></section><footer class="r-purchase"><div><b>5,900P</b><small>보유 18,000P</small></div><button class="r-primary" id="r-purchase">전체 열람하기</button></footer></main>`;
}
function chat() {
  return `${statusbar()}${header("이승호 위원", "mypage", `<span class="r-chat-subtitle">자동차 부품사 구매팀</span><div class="r-time-left"><b>46:20</b><span>남은 시간</span></div>`)}<main id="main" class="r-chat"><p class="r-chat-date">10월 23일 금요일 오후 9:34</p><div class="r-chat-log" id="r-chat-log"><div class="r-chat-line mine"><small>9:34</small><div class="r-file">${icon("paper")}<span>계약서_3조_단가_조항.pdf<br/>PDF</span></div></div><div class="r-chat-line"><p>계약서 3조 단가 조항, pdf로 보내주신 것<br/>확인했습니다.</p><small>9:40</small></div><div class="r-chat-line mine"><small>9:41</small><p>공장에서 이정도는 관행이라는데 그냥 싸인해<br/>도 될까요?</p></div><aside class="r-advice"><b>핵심조언</b><p>이 조항은 나중에 단가 인하 압박의 빌미가 됩니다. 서명 전에<br/>반드시 수정하세요. ”추후 협의”를 지우고 <strong>’조정상한 3%’</strong>를<br/>숫자로 박아두면 됩니다.</p><a href="${link("report", "id=demo-completed")}">↳ 전략 리포트에 담김</a></aside><div class="r-chat-line"><p>그리고 검수 기준 조항도 같이 보시죠.<br/>거기가 더 위험합니다.</p><small>9:45</small></div></div>${composer("메세지를 입력해주세요.")}</main>`;
}
function mypage() {
  return `${statusbar()}<header class="r-my-header"><h1>마이페이지</h1></header><main id="main" class="r-mypage"><button class="r-my-profile" data-action="account"><span class="r-person-icon"><i></i></span><div><h2>최강은 <small>스타터</small></h2><p>첫 창업 준비 중 | 제조 분야</p></div>${icon("chevron")}</button><section class="r-my-points"><h2>보유 포인트 <a href="${link("points")}">이용 내역 ${icon("chevron")}</a></h2><b>18,000P</b><p>${icon("lock")} 보관 중 12,000P | 상담 완료 후 베테랑에게 전달</p><a class="r-primary" href="${link("points")}">포인트 충전</a></section><section class="r-my-upcoming"><h2>다가오는 예약</h2><a class="r-upcoming-card" href="${link("chat", "id=demo-active")}"><h3><span>D-3</span>10월 26일 월요일 14:00</h3><div><img src="${portrait()}" alt=""/><section><h3>이승호 위원</h3><p>1시간 1:1 통화 상담</p></section><b>12,000P</b></div><footer>${icon("clock")} 상담방은 예약 시간에 열려요</footer></a></section><section class="r-my-purchased"><h2>구매한 오답노트</h2><a href="${link("note-detail", "id=demo-contract")}"><span>${icon("paper")}</span><div><p>이승호 위원</p><h3>초보 창업가가 제조사 계약 시 놓치면<br/>100% 손해보는 조항 5가지</h3></div></a></section><nav class="r-my-menu">${[
    ["포인트 이용 내역", "points"],
    ["계정 설정", "mypage"],
    ["알림 설정", "notifications"],
    ["고객센터", "support"],
  ]
    .map(
      ([n, p]) =>
        `<a ${p === "support" ? 'data-action="support"' : `href="${link(p)}"`}>${n}${icon("chevron")}</a>`,
    )
    .join("")}<button data-action="logout">로그아웃</button></nav></main>`;
}
export function renderReference() {
  document.body.className = "reference-design reference-example r-page-" + page;
  const renderers = {
    home,
    "expert-booking": profile,
    booking,
    matching,
    notes,
    "note-detail": detail,
    chat,
    mypage,
  };
  const render = renderers[page];
  if (!render) return false;
  document.body.innerHTML = `<div class="app r-app">${render()}</div><dialog id="r-notice"><h2>디자인 예시 화면</h2><p id="r-notice-text"></p><form method="dialog"><button class="r-primary">확인</button></form></dialog>`;
  const say = (text) => {
    document.getElementById("r-notice-text").textContent = text;
    document.getElementById("r-notice").showModal();
  };
  document
    .querySelectorAll("[data-action]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          say(
            "디자인 확인용 예시입니다. 실제 계정이나 포인트는 변경하지 않아요.",
          )),
    );
  if (page === "home") {
    const more = document.getElementById("r-more");
    more.onclick = () => {
      const expanded = more.getAttribute("aria-expanded") === "true";
      more.setAttribute("aria-expanded", String(!expanded));
      more.innerHTML = `베테랑 ${expanded ? "더보기" : "접기"} ${icon("down")}`;
      // The final source contains exactly these three sample people. Never invent
      // or duplicate experts to simulate extra records in the design preview.
      say(
        "최종 시안의 예시 베테랑 3명을 모두 표시하고 있어요. 실제 서비스에서는 등록된 베테랑을 더 보고 접을 수 있어요.",
      );
    };
  }
  if (page === "expert-booking" && params.get("calendar") === "1") {
    let month = 9;
    const year = 2026;
    function draw() {
      document.getElementById("r-month-label").textContent =
        `${year}년 ${month + 1}월`;
      const start = new Date(year, month, 1).getDay(),
        count = new Date(year, month + 1, 0).getDate(),
        prev = new Date(year, month, 0).getDate();
      document.getElementById("r-calendar").innerHTML = Array.from(
        { length: Math.ceil((start + count) / 7) * 7 },
        (_, i) => {
          const d = i - start + 1;
          return `<button ${d < 24 || d > count ? "disabled" : ""} class="${d === 24 ? "selected" : ""} ${d === 23 ? "today" : ""}" data-day="${d}" aria-pressed="${d === 24}">${d < 1 ? prev + d : d > count ? d - count : d}${d === 23 ? "<small>오늘</small>" : ""}</button>`;
        },
      ).join("");
      document.querySelectorAll("#r-calendar button:not(:disabled)").forEach(
        (b) =>
          (b.onclick = () => {
            document.querySelectorAll("#r-calendar button").forEach((x) => {
              x.classList.remove("selected");
              x.setAttribute("aria-pressed", "false");
            });
            b.classList.add("selected");
            b.setAttribute("aria-pressed", "true");
            document.getElementById("r-reserve").href = link(
              "booking",
              `id=demo-lee&date=${year}-${String(month + 1).padStart(2, "0")}-${b.dataset.day}`,
            );
          }),
      );
    }
    draw();
    document.getElementById("r-prev-month").onclick = () => {
      month = Math.max(0, month - 1);
      draw();
    };
    document.getElementById("r-next-month").onclick = () => {
      month = Math.min(11, month + 1);
      draw();
    };
  }
  if (page === "booking") {
    let day = "목요일",
      time = "14:00";
    const update = () =>
      (document.getElementById("r-book-submit").textContent =
        `${day} ${time}으로 예약하기`);
    document.querySelectorAll(".r-date-strip button").forEach(
      (b, i) =>
        (b.onclick = () => {
          document.querySelectorAll(".r-date-strip button").forEach((x) => {
            x.classList.remove("selected");
            x.setAttribute("aria-pressed", "false");
          });
          b.classList.add("selected");
          b.setAttribute("aria-pressed", "true");
          day = ["토요일", "일요일", "월요일", "화요일", "수요일"][i];
          document.getElementById("r-day-heading").textContent = day;
          update();
        }),
    );
    document.querySelectorAll(".r-times button:not(:disabled)").forEach(
      (b) =>
        (b.onclick = () => {
          document
            .querySelectorAll(".r-times button")
            .forEach((x) => x.setAttribute("aria-pressed", "false"));
          b.setAttribute("aria-pressed", "true");
          time = b.textContent;
          update();
        }),
    );
    document.querySelectorAll(".r-mode").forEach(
      (b) =>
        (b.onclick = () => {
          document.querySelectorAll(".r-mode").forEach((x) => {
            x.classList.remove("selected");
            x.setAttribute("aria-pressed", "false");
          });
          b.classList.add("selected");
          b.setAttribute("aria-pressed", "true");
        }),
    );
    document.getElementById("r-book-submit").onclick = () =>
      say(
        "시안 확인용 예약입니다. 실제 예약이나 포인트 결제는 실행하지 않아요.",
      );
  }
  if (page === "notes")
    document.querySelectorAll(".r-note-filters button").forEach(
      (b) =>
        (b.onclick = () => {
          document
            .querySelectorAll(".r-note-filters button")
            .forEach((x) => x.setAttribute("aria-pressed", "false"));
          b.setAttribute("aria-pressed", "true");
          const filter = b.textContent;
          document
            .querySelectorAll(".r-note")
            .forEach(
              (x, i) =>
                (x.hidden = !(
                  { 계약: [0, 1, 2], 노무: [], 세무: [], 자금: [1], 판로: [2] }[
                    filter
                  ] || []
                ).includes(i)),
            );
        }),
    );
  if (page === "note-detail")
    document.getElementById("r-purchase").onclick = () =>
      say("시안 확인용 미리보기입니다. 실제 포인트는 차감하지 않아요.");
  if (page === "matching" || page === "chat") {
    const form = document.getElementById("r-compose"),
      input = document.getElementById("r-message");
    document.querySelectorAll(".r-suggestions button").forEach(
      (b) =>
        (b.onclick = () => {
          input.value = b.textContent;
          input.focus();
        }),
    );
    form.onsubmit = (e) => {
      e.preventDefault();
      if (!input.value.trim()) return;
      if (page === "matching") {
        const text = input.value.trim();
        document.getElementById("r-match-body").innerHTML = matchResult();
        document.querySelector(".r-user-bubble").textContent = text;
        document.querySelector(".r-matching").classList.add("has-result");
        applyFinalMetrics().catch(() => {});
        input.placeholder = "메세지를 입력해주세요.";
      } else {
        const row = document.createElement("div");
        row.className = "r-chat-line mine";
        const p = document.createElement("p");
        p.textContent = input.value;
        row.append(p);
        document.getElementById("r-chat-log").append(row);
        row.scrollIntoView({ block: "nearest" });
      }
      input.value = "";
    };
    document.getElementById("r-attach").onclick = () =>
      document.getElementById("r-photo").click();
    document.getElementById("r-photo").onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 5 * 1024 * 1024
      ) {
        say("JPG, PNG, WebP 사진을 5MB 이하로 선택해주세요.");
        return;
      }
      const host = document.getElementById("r-photo-preview");
      host.replaceChildren();
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.src = url;
      image.onload = () => URL.revokeObjectURL(url);
      image.alt = "첨부 사진 미리보기";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "삭제";
      remove.onclick = () => {
        host.replaceChildren();
        host.hidden = true;
        e.target.value = "";
      };
      host.append(image, remove);
      host.hidden = false;
      say(
        "사진은 이 기기의 미리보기에만 표시됩니다. 디자인 예시에서는 AI에 전송하지 않아요.",
      );
    };
  }
  applyFinalMetrics().catch(() => {});
  return true;
}
