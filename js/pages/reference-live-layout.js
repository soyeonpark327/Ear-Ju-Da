// Keep the existing API modules and transaction handlers. Only rearrange their UI.
import { icon } from "./reference-examples.js?v=reference-1";
const $ = (id) => document.getElementById(id);
const path = location.pathname.split("/").pop().replace(".html", "");
const q = new URLSearchParams(location.search);
function section(title) {
  const s = document.createElement("section");
  const h = document.createElement("h2");
  h.textContent = title;
  s.append(h);
  return s;
}
function text(tag, value) {
  const e = document.createElement(tag);
  e.textContent = value ?? "";
  return e;
}
function image(url) {
  const img = document.createElement("img");
  try {
    if (new URL(url).protocol === "https:") img.src = url;
  } catch {}
  img.alt = "";
  img.onerror = () => img.remove();
  return img;
}
function onChanges(root, fn) {
  let queued = false;
  const observer = new MutationObserver(() => {
    if (!queued) {
      queued = true;
      queueMicrotask(() => {
        observer.disconnect();
        try {
          fn();
        } finally {
          queued = false;
          observer.observe(root, { childList: true, subtree: true });
        }
      });
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  fn();
}
if (path === "home") {
  const title = $("popular")?.closest("section")?.querySelector("h2");
  if (title)
    title.innerHTML =
      '가장 많이 열람된 <a href="notes.html"><em>오답노트</em></a>';
  const match = document.querySelector(".search .match");
  if (match) match.innerHTML = 'Ai 매칭 <span aria-hidden="true">✦</span>';
  const bell = $("notifications");
  if (bell) bell.innerHTML = icon("bell");
}
if (path === "expert-booking") {
  document.querySelector(".page-header h1").textContent = "예약하기";
  const profile = document.querySelector(".profile-section"),
    calendar = document.querySelector(".booking-section");
  if (profile && calendar) {
    const actions = document.createElement("div");
    actions.className = "r-profile-actions";
    const date = document.createElement("a");
    date.href = `expert-booking.html?id=${encodeURIComponent(q.get("id") || "")}&calendar=1`;
    date.innerHTML = icon("calendar") + " 날짜 선택";
    const reviews = document.createElement("a");
    reviews.href = `reviews.html?expert=${encodeURIComponent(q.get("id") || "")}`;
    reviews.innerHTML = icon("chat") + " 후기 보기";
    actions.append(date, reviews);
    profile.append(actions);
    calendar.hidden = q.get("calendar") !== "1";
    actions.hidden = !calendar.hidden;
  }
}
if (path === "booking") {
  document.querySelector(".page-header h1").textContent = "예약하기";
  if (q.get("id"))
    document
      .querySelector(".booking-expert-panel")
      .classList.add("r-booking-context");
  const label = $("call-mode")?.querySelector("strong");
  if (label) {
    label.textContent = "1시간 1:1 통화 상담";
    $("call-mode").title =
      "통화 상담은 아직 예약할 수 없습니다. 기존 안내를 확인해주세요.";
  }
}
if (path === "matching") {
  document.querySelector(".page-header h1").textContent = "Ai 매칭";
  const intro = document.querySelector(".matching-intro>p");
  if (intro)
    intro.innerHTML =
      "상황을 편하게 적어주시면<br/>Ai가 딱 맞는 베테랑을 찾아드려요";
  $("concern").placeholder = "이어주다에게 말해주세요.";
  // Filters remain functional, but are secondary to the supplied single-input layout.
  const filters = $("ai-filters");
  if (filters) {
    const details = document.createElement("details");
    details.className = "r-live-filters";
    const summary = document.createElement("summary");
    summary.textContent = "추천 조건";
    details.append(summary);
    filters.before(details);
    details.append(filters);
  }
  const result = $("matching-results");
  if (result) {
    result.className = "matching-results r-match-thread";
    $("matching-concern").className = "r-user-bubble";
    const reply = document.createElement("div");
    reply.className = "r-ai-reply";
    const mark = document.createElement("span");
    mark.className = "r-ai-avatar";
    mark.textContent = "✦";
    const content = document.createElement("div");
    const title = text("small", "이어주다 Ai");
    const explanation = $("matching-explanation");
    content.append(
      title,
      $("matching-source"),
      $("matching-cards"),
      explanation,
    );
    reply.append(mark, content);
    result.append(reply);
  }
  $("concern").rows = 1;
}
if (path === "note-detail") {
  const detail = $("detail");
  if (detail) {
    const quote = detail.querySelector(".quote");
    quote.classList.add("r-live-note-overview");
    const category = text("span", "");
    category.className = "r-category";
    category.hidden = true;
    quote.prepend(category);
    const author = document.createElement("div");
    author.className = "r-author";
    quote.append(author);
    const locked = $("locked");
    locked.classList.add("r-live-locked");
    const footer = detail.querySelector(".purchase-footer");
    const price = document.createElement("div");
    price.className = "r-live-note-price";
    footer.prepend(price);
    const purchase = $("purchase");
    onChanges(purchase, () => {
      if (/^전체 열람하기\s+[\d,]+\s*P/.test(purchase.textContent)) {
        price.replaceChildren(
          text("b", purchase.textContent.match(/[\d,]+\s*P/)[0]),
        );
        purchase.textContent = "전체 열람하기";
      }
    });
    import("../api/notes.js")
      .then(async (api) => {
        const note = await api.getNote(q.get("id"));
        if (!note) return;
        category.textContent = note.industry || "";
        category.hidden = !note.industry;
        author.replaceChildren(
          text("b", note.author?.profiles?.name || ""),
          text("p", note.author?.headline || ""),
        );
      })
      .catch(() => {});
  }
}
if (path === "chat") {
  const info = document.querySelector(".consultation-chat-info");
  if (info) {
    info.classList.add("r-live-chat-info");
  }
  const composer = $("chat-form");
  if (composer) {
    const label = composer.querySelector("label");
    label.classList.add("sr-only");
    $("chat-input").rows = 1;
    $("chat-input").placeholder = "메세지를 입력해주세요.";
    onChanges($("chat-send"), () => {
      if ($("chat-send").textContent === "전송")
        $("chat-send").innerHTML = icon("arrow");
    });
  }
  const person = $("chat-person");
  if (person)
    onChanges(person, () => {
      const h = document.querySelector(".page-header h1");
      h.textContent = person.textContent || "상담 채팅";
    });
}
if (path === "mypage") {
  document.querySelector(".page-header h1").textContent = "마이페이지";
  // Personal data is loaded independently; never substitute the supplied sample balances.
  const wallet = document.querySelector(".my-points");
  if (wallet) {
    const topup = document.createElement("a");
    topup.href = "points.html";
    topup.className = "r-primary r-live-topup";
    topup.textContent = "포인트 충전";
    wallet.after(topup);
  }
  const host = $("my-content");
  if (host) {
    const reservations = section("다가오는 예약");
    reservations.className = "r-my-upcoming";
    const purchased = section("구매한 오답노트");
    purchased.className = "r-my-purchased";
    const nav = host.querySelector("nav");
    nav.before(reservations, purchased);
    Promise.all([
      import("../api/bookings.js"),
      import("../api/notes.js"),
      import("../api/auth.js"),
    ])
      .then(async ([bookingApi, noteApi, auth]) => {
        if (!(await auth.getCurrentUser())) return;
        const results = await Promise.allSettled([
          bookingApi.getMyBookings(),
          noteApi.getMyPurchasedNotes(),
        ]);
        if (results[0].status === "fulfilled") {
          const bookings = results[0].value
            .filter(
              (b) =>
                b.status === "confirmed" &&
                new Date(b.slot?.start_at) > new Date(),
            )
            .sort(
              (a, b) => new Date(a.slot.start_at) - new Date(b.slot.start_at),
            );
          for (const b of bookings.slice(0, 1)) {
            const a = document.createElement("a");
            a.className = "r-upcoming-card";
            a.href = "chat.html?id=" + encodeURIComponent(b.id);
            const date = new Date(b.slot.start_at);
            a.append(
              text(
                "h3",
                date.toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              ),
            );
            const row = document.createElement("div"),
              info = document.createElement("section");
            info.append(
              text("h3", b.expert?.profiles?.name || "베테랑"),
              text("p", "1:1 채팅 상담"),
            );
            row.append(
              info,
              text("b", Number(b.price_points).toLocaleString("ko-KR") + "P"),
            );
            const footer = text("footer", "상담방은 예약 시간에 열려요");
            a.append(row, footer);
            reservations.append(a);
          }
          if (!bookings.length)
            reservations.append(text("p", "다가오는 예약이 없어요."));
        } else
          reservations.append(
            text(
              "p",
              "예약을 불러오지 못했어요. 내 상담에서 다시 확인해주세요.",
            ),
          );
        if (results[1].status === "fulfilled") {
          for (const n of results[1].value.slice(0, 1)) {
            const a = document.createElement("a");
            a.href = "note-detail.html?id=" + encodeURIComponent(n.id);
            const mark = document.createElement("span");
            mark.innerHTML = icon("paper");
            const info = document.createElement("div");
            info.append(
              text("p", n.author?.profiles?.name),
              text("h3", n.title),
            );
            a.append(mark, info);
            purchased.append(a);
          }
          if (!results[1].value.length)
            purchased.append(text("p", "구매한 오답노트가 없어요."));
        } else
          purchased.append(
            text(
              "p",
              "구매 내역을 불러오지 못했어요. 보관함에서 다시 확인해주세요.",
            ),
          );
      })
      .catch(() => {});
  }
}
