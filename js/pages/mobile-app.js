// The actual application uses the same screen components as the supplied design.
// API values replace only data fields; preview data never reaches live actions.
import { icon } from "./mobile-views.js?v=app-2";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const page = location.pathname.split("/").pop().replace(".html", "");
const href = (p, values = {}) => {
  const url = new URL(p + ".html", location.href);
  Object.entries(values).forEach(
    ([k, v]) => v != null && url.searchParams.set(k, v),
  );
  return url.href;
};
const money = (x) => Number(x || 0).toLocaleString("ko-KR");
const text = (tag, value, cls) => {
  const e = document.createElement(tag);
  e.textContent = value ?? "";
  if (cls) e.className = cls;
  return e;
};
const dateKey = (d) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(d));
const clock = (d) =>
  new Date(d).toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
const week = (d) =>
  new Date(d + "T12:00:00+09:00").toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    weekday: "long",
  });
const say = (message) => {
  $("#r-notice-text").textContent = message;
  $("#r-notice").showModal();
};
async function confirmAction(message, label = "확인") {
  const dialog = $("#r-notice");
  $("#r-notice-text").textContent = message;
  const form = dialog.querySelector("form");
  form.replaceChildren();
  const cancel = text("button", "취소");
  cancel.value = "cancel";
  const ok = text("button", label, "r-primary");
  ok.value = "confirm";
  form.append(cancel, ok);
  dialog.returnValue = "";
  dialog.showModal();
  return new Promise((resolve) =>
    dialog.addEventListener(
      "close",
      () => {
        const approved = dialog.returnValue === "confirm";
        form.replaceChildren(text("button", "확인", "r-primary"));
        resolve(approved);
      },
      { once: true },
    ),
  );
}
function image(url, cls = "") {
  const host = document.createElement("span");
  host.className = cls || "r-avatar";
  let safe;
  try {
    const u = new URL(url);
    if (u.protocol === "https:") safe = u.href;
  } catch {}
  if (safe) {
    const img = document.createElement("img");
    img.src = safe;
    img.alt = "";
    img.onerror = () => {
      host.replaceChildren(text("span", "●", "r-portrait-empty"));
    };
    host.append(img);
  } else host.append(text("span", "●", "r-portrait-empty"));
  return host;
}
function changeImage(target, url) {
  const node = image(url);
  if (target) target.replaceWith(node);
  return node;
}
function errorPanel(host, message, retry) {
  host.replaceChildren();
  const panel = text("div", message, "r-app-message");
  panel.setAttribute("role", "status");
  if (retry) {
    const button = text("button", "다시 시도", "r-primary");
    button.onclick = retry;
    panel.append(button);
  }
  host.append(panel);
}
async function requireUser() {
  const auth = await import("../api/auth.js");
  const user = await auth.getCurrentUser();
  if (!user) {
    const main = $("#main");
    if (main) errorPanel(main, "로그인 화면으로 이동하고 있어요.");
    location.href = href("login", {
      next: location.pathname + location.search,
    });
    return null;
  }
  return { auth, user };
}
function expertCard(e, reason = null) {
  const a = document.createElement("a");
  a.className = "r-expert";
  a.href = href("expert-booking", { id: e.id });
  a.append(image(e.avatar_url, "r-live-portrait"));
  const info = document.createElement("div");
  info.className = "r-expert-info";
  info.append(text("h3", e.name), text("p", e.headline, "r-sub"));
  const career = document.createElement("div");
  career.className = "r-career";
  career.innerHTML =
    '<span class="r-bars" aria-hidden="true">' +
    Array.from(
      { length: 30 },
      (_, i) => `<i style="height:${5 + ((i * 7) % 13)}px"></i>`,
    ).join("") +
    "</span>";
  career.append(text("b", (e.career_years || 0) + "년"));
  info.append(
    career,
    text(
      "p",
      reason || e.career_summary || (e.keywords || []).join(" · "),
      "r-career-summary",
    ),
  );
  a.append(info);
  const score = document.createElement("div");
  score.className = "r-score";
  score.append(text("strong", e.rating ?? "—"), text("small", "평점"));
  a.append(score);
  return a;
}
function remember(e) {
  try {
    const rows = JSON.parse(localStorage.getItem("earjuda-recent") || "[]");
    localStorage.setItem(
      "earjuda-recent",
      JSON.stringify(
        [
          { id: e.id, name: e.name, keywords: e.keywords },
          ...rows.filter((x) => x.id !== e.id),
        ].slice(0, 7),
      ),
    );
  } catch {}
}
async function home() {
  const [expertsApi, notesApi] = await Promise.all([
    import("../api/experts.js"),
    import("../api/notes.js"),
  ]);
  const results = await Promise.allSettled([
    expertsApi.getExperts(),
    notesApi.getNotes({ sort: "popular" }),
  ]);
  const box = $("#r-experts");
  let limit = 3;
  const rows = results[0].status === "fulfilled" ? results[0].value : [];
  const more = $("#r-more");
  function render() {
    box.replaceChildren(
      ...rows.slice(0, limit).map((e) => {
        const a = expertCard(e);
        a.onclick = () => remember(e);
        return a;
      }),
    );
    if (!rows.length)
      errorPanel(
        box,
        results[0].status === "rejected"
          ? "베테랑을 불러오지 못했어요."
          : "등록된 베테랑이 없어요.",
        () => location.reload(),
      );
    more.hidden = rows.length <= 3;
    more.setAttribute("aria-expanded", String(limit > 3));
    more.innerHTML = `베테랑 ${limit > 3 ? "접기" : "더보기"} ${icon("down")}`;
  }
  render();
  more.onclick = () => {
    limit = limit > 3 ? 3 : rows.length;
    render();
  };
  $('.r-search input[name="demo"]').remove();
  $(".r-search").onsubmit = (e) => {
    e.preventDefault();
    location.href = href("matching", {
      keyword: $('.r-search input[name="keyword"]').value.trim(),
    });
  };
  const recent = $(".r-recent>div");
  recent.replaceChildren();
  try {
    const saved = JSON.parse(localStorage.getItem("earjuda-recent") || "[]");
    for (const r of saved) {
      const a = text("a", r.name);
      a.href = href("expert-booking", { id: r.id });
      recent.append(a);
    }
  } catch {}
  if (!recent.children.length)
    recent.append(text("p", "아직 둘러본 베테랑이 없어요."));
  const popular = $(".r-popular ol");
  popular.replaceChildren();
  if (results[1].status === "fulfilled") {
    for (const [i, n] of results[1].value.slice(0, 3).entries()) {
      const li = document.createElement("li");
      li.append(text("b", i + 1));
      const cover = document.createElement("img");
      cover.className = "r-paper-cover";
      cover.src =
        "../assets/home/paper-" + ["contract", "business", "tax"][i] + ".jpg";
      cover.alt = "";
      li.append(cover);
      const info = document.createElement("div");
      info.append(
        text("strong", n.author?.profiles?.name || "베테랑"),
        text("p", n.title),
        text("small", money(n.price_points) + "P"),
      );
      const a = text("a", "읽어보기");
      a.href = href("note-detail", { id: n.id });
      li.append(info, a);
      popular.append(li);
    }
    if (!popular.children.length)
      popular.append(text("li", "등록된 오답노트가 없어요."));
  } else
    errorPanel(popular, "오답노트를 불러오지 못했어요.", () =>
      location.reload(),
    );
}
async function loadExpert() {
  const api = await import("../api/experts.js");
  const id = params.get("id");
  if (!id) throw Error("베테랑을 먼저 선택해주세요.");
  const e = await api.getExpert(id);
  if (!e) throw Error("선택한 베테랑을 찾을 수 없어요.");
  return { api, e, id };
}
function fillProfile(e) {
  $(".r-profile-intro h2").textContent = e.name;
  $(".r-profile-intro p").textContent = e.headline;
  changeImage($(".r-profile-intro>img"), e.avatar_url);
  const years = Number(e.career_years || 0);
  const current = new Date().getFullYear();
  const axis = $(".r-experience>div");
  axis.replaceChildren(text("span", current - years), text("span", current));
  const tags = $(".r-tags");
  tags.replaceChildren(
    ...[e.trust_label, ...(e.keywords || []).slice(0, 3)]
      .filter(Boolean)
      .map((n) => text("span", n)),
  );
}
async function profile() {
  if (params.get("id") === "preview-lee") {
    document.body.classList.add("r-profile-preview");
    if (params.get("calendar") === "1") {
      const { bindReferenceCalendar } = await import(
        "./mobile-views.js?v=flow-1"
      );
      bindReferenceCalendar();
    }
    $(".r-tip-count").onclick = () => say("현재 공개된 답변을 보고 있어요.");
    const reviews = $(".r-profile-actions a:last-child");
    if (reviews)
      reviews.onclick = (event) => {
        event.preventDefault();
        say("아직 등록된 후기가 없어요.");
      };
    return;
  }

  const { api, e, id } = await loadExpert();
  fillProfile(e);
  const results = await Promise.allSettled([api.getTips(id), api.getSlots(id)]);
  const tips = results[0].status === "fulfilled" ? results[0].value : [];
  const content = $(".r-tip");
  const tipLabel = $(".r-tip-count");
  let expanded = false;
  function renderTips() {
    content.replaceChildren();
    const shown = expanded ? tips : tips.slice(0, 1);
    for (const t of shown) content.append(text("p", "“" + t.content + "”"));
    if (!shown.length)
      content.append(
        text(
          "p",
          results[0].status === "rejected"
            ? "조언을 불러오지 못했어요."
            : "등록된 조언이 없어요.",
        ),
      );
    tipLabel.textContent = expanded ? "접기" : tips.length + "개 ›";
    tipLabel.hidden = false;
    tipLabel.disabled = tips.length < 2;
  }
  renderTips();
  tipLabel.onclick = () => {
    expanded = !expanded;
    renderTips();
  };
  const actions = $(".r-profile-actions");
  if (actions) {
    actions.querySelector("a").href = href("expert-booking", {
      id,
      calendar: 1,
    });
    actions.querySelectorAll("a")[1].href = href("reviews", { expert: id });
  }
  if (!$("#r-calendar")) return;
  const slots = (
    results[1].status === "fulfilled" ? results[1].value : []
  ).filter((s) => new Date(s.start_at) > new Date());
  if (results[1].status === "rejected")
    throw Error("상담 가능한 시간을 불러오지 못했어요. 다시 시도해주세요.");
  let selected = "",
    month = new Date();
  if (slots.length) {
    month = new Date(slots[0].start_at);
    selected = dateKey(month);
  }
  const available = new Set(slots.map((s) => dateKey(s.start_at)));
  const reserve = $("#r-reserve");
  function draw() {
    const year = month.getFullYear(),
      m = month.getMonth();
    $("#r-month-label").textContent = `${year}년 ${m + 1}월`;
    const start = new Date(year, m, 1).getDay(),
      count = new Date(year, m + 1, 0).getDate(),
      prev = new Date(year, m, 0).getDate();
    const host = $("#r-calendar");
    host.replaceChildren();
    for (let i = 0; i < Math.ceil((start + count) / 7) * 7; i++) {
      const d = i - start + 1,
        key = `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const button = text(
        "button",
        d < 1 ? prev + d : d > count ? d - count : d,
      );
      button.disabled = d < 1 || d > count || !available.has(key);
      button.classList.toggle("selected", key === selected);
      button.setAttribute("aria-pressed", String(key === selected));
      if (key === dateKey(new Date())) {
        button.classList.add("today");
        button.append(text("small", "오늘"));
      }
      button.onclick = () => {
        selected = key;
        draw();
      };
      host.append(button);
    }
    reserve.href = selected ? href("booking", { id, date: selected }) : "#";
    reserve.setAttribute("aria-disabled", String(!selected));
    reserve.onclick = (event) => {
      if (!selected) {
        event.preventDefault();
        say("현재 예약 가능한 시간이 없어요.");
      }
    };
  }
  draw();
  $("#r-prev-month").onclick = () => {
    month = new Date(month.getFullYear(), month.getMonth() - 1, 1);
    draw();
  };
  $("#r-next-month").onclick = () => {
    month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    draw();
  };
}
async function booking() {
  if (params.get("id") === "preview-lee") {
    const { bindBookingSelection } = await import(
      "./mobile-views.js?v=booking-flow-1"
    );
    bindBookingSelection(() => say("예약 내용을 확인해주세요."));
    const selected = params.get("date");
    if (selected) {
      const date = new Date(selected + "T12:00:00+09:00");
      const day = date.getDate();
      const strip = $$(".r-date-strip button");
      if (!strip.some((button) => Number(button.dataset.date) === day)) {
        strip.forEach((button, i) => {
          const d = new Date(date);
          d.setDate(day + i);
          button.dataset.date = String(d.getDate());
          button.querySelector("span").textContent = "일월화수목금토"[
            d.getDay()
          ];
          button.querySelector("b").textContent = d.getDate();
        });
      }
      const button = strip.find(
        (button) => Number(button.dataset.date) === day,
      );
      if (button) button.click();
    }
    $("#r-book-submit").onclick = () =>
      say(
        "선택한 날짜·시간·상담 방식을 확인했어요. 이 프로필은 미리보기이므로 실제 예약이나 포인트 결제는 실행하지 않아요.",
      );
    return;
  }

  const { api, e, id } = await loadExpert();
  const [slots, auth] = await Promise.all([
    api.getSlots(id),
    import("../api/auth.js"),
  ]);
  const user = await auth.getMyProfile();
  const upcoming = slots.filter((s) => new Date(s.start_at) > new Date());
  let selectedDate = params.get("date"),
    slot = null,
    busy = false;
  if (!upcoming.some((s) => dateKey(s.start_at) === selectedDate))
    selectedDate = upcoming.length ? dateKey(upcoming[0].start_at) : "";
  const availableDates = new Set(upcoming.map((s) => dateKey(s.start_at)));
  const baseDate = new Date(
    (selectedDate || dateKey(new Date())) + "T12:00:00+09:00",
  );
  const days = [
    ...new Set([
      ...Array.from({ length: 5 }, (_, i) =>
        dateKey(new Date(baseDate.getTime() + i * 86400000)),
      ),
      ...availableDates,
    ]),
  ].sort();
  slot = upcoming.find((s) => dateKey(s.start_at) === selectedDate) || null;
  const button = $("#r-book-submit");
  const balance = $(".r-booking-footer>p");
  balance.textContent = user
    ? "보유 포인트 " + money(user.points) + "P"
    : "로그인 후 보유 포인트를 확인할 수 있어요.";
  const call = $('[data-mode="call"]'),
    chat = $('[data-mode="chat"]');
  call.classList.remove("selected");
  call.setAttribute("aria-pressed", "false");
  call.onclick = () =>
    say("통화 상담은 아직 지원되지 않아요. 채팅 상담을 선택해주세요.");
  chat.classList.add("selected");
  chat.setAttribute("aria-pressed", "true");
  chat.querySelector("strong").textContent = money(e.price_points) + "P";
  chat.onclick = () => {};
  function update() {
    button.disabled = busy || !slot;
    button.textContent = busy
      ? "예약 중…"
      : slot
        ? `${week(selectedDate)} ${clock(slot.start_at)}으로 예약하기`
        : "날짜와 시간을 선택해주세요";
  }
  function draw() {
    const strip = $(".r-date-strip");
    strip.replaceChildren();
    for (const d of days) {
      const b = document.createElement("button");
      b.append(
        text("span", week(d).slice(0, 1)),
        text("b", Number(d.slice(-2))),
      );
      b.classList.toggle("selected", d === selectedDate);
      b.setAttribute("aria-pressed", String(d === selectedDate));
      b.disabled = busy || !availableDates.has(d);
      b.onclick = () => {
        selectedDate = d;
        slot = upcoming.find((s) => dateKey(s.start_at) === d) || null;
        draw();
      };
      strip.append(b);
    }
    $("#r-day-heading").textContent = selectedDate
      ? week(selectedDate)
      : "예약 가능한 시간이 없어요.";
    const times = $(".r-times");
    times.replaceChildren();
    for (const s of upcoming.filter(
      (s) => dateKey(s.start_at) === selectedDate,
    )) {
      const b = text("button", clock(s.start_at));
      b.setAttribute("aria-pressed", String(slot?.id === s.id));
      b.disabled = busy;
      b.onclick = () => {
        slot = s;
        draw();
      };
      times.append(b);
    }
    update();
  }
  draw();
  const policy = $(".r-policies p:last-child>span:last-child");
  policy.textContent =
    "취소·환불 가능 여부는 상담 시작 시각과 서비스 정책에 따라 결정됩니다.";
  button.onclick = async () => {
    if (busy || !slot) return;
    const who = await requireUser();
    if (!who) return;
    const chosen = slot;
    if (
      !(await confirmAction(
        `${e.name} · ${selectedDate} ${clock(chosen.start_at)} · ${money(e.price_points)}P로 채팅 상담을 예약할까요?`,
        "예약 확정",
      ))
    )
      return;
    busy = true;
    draw();
    try {
      const api = await import("../api/bookings.js");
      const bookingId = await api.createBooking(
        chosen.id,
        sessionStorage.getItem("earjuda-concern") || "상담을 요청합니다.",
      );
      location.href = href("chat", { id: bookingId });
    } catch (error) {
      say(error.message);
      try {
        const fresh = await api.getSlots(id);
        upcoming.splice(
          0,
          upcoming.length,
          ...fresh.filter((s) => new Date(s.start_at) > new Date()),
        );
      } catch {}
      slot = null;
    } finally {
      busy = false;
      draw();
    }
  };
}
function matchCard(e, result) {
  const card = document.createElement("article");
  card.className = "r-match-card";
  const person = document.createElement("div");
  person.className = "r-match-person";
  person.append(image(e.avatar_url));
  const info = document.createElement("div");
  info.append(text("h2", e.name), text("small", e.headline));
  person.append(info);
  if (e.rating != null) {
    const score = document.createElement("span");
    score.append(text("b", e.rating), text("small", "평점"));
    person.append(score);
  }
  card.append(
    person,
    text(
      "p",
      e.reason || e.career_summary || "프로필에서 경력을 확인해주세요.",
    ),
  );
  const actions = document.createElement("div");
  actions.className = "r-match-actions";
  for (const [label, p] of [
    ["프로필 보기", "expert-booking"],
    ["상담 예약", "expert-booking"],
  ]) {
    const a = text("a", label);
    a.href = href(p, {
      id: e.expert_id || e.id,
      ...(label === "상담 예약" ? { calendar: 1 } : { ai: 1 }),
    });
    actions.append(a);
  }
  card.append(actions);
  return card;
}
async function preparePhoto(file) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw Error("JPG, PNG, WebP 사진을 5MB 이하로 선택해주세요.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(
      1,
      1600 / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
    if (data.length > 2_000_000)
      throw Error("더 작은 사진으로 다시 선택해주세요.");
    return { mimeType: "image/jpeg", data };
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function matching() {
  const input = $("#r-message"),
    form = $("#r-compose"),
    send = form.querySelector("[type=submit]"),
    attach = $("#r-attach"),
    file = $("#r-photo");
  let photo = null,
    busy = false,
    preparing = false;
  const update = () => {
    send.disabled = busy || preparing || (!input.value.trim() && !photo);
    attach.disabled = busy || preparing;
    input.readOnly = busy;
    const remove = $("#r-photo-preview button");
    if (remove) remove.disabled = busy || preparing;
  };
  const status = text("p", "", "r-match-status");
  status.setAttribute("role", "status");
  form.before(status);
  const supplied = params.get("keyword");
  if (supplied) input.value = supplied.slice(0, 1000);
  input.oninput = update;
  $$(".r-suggestions button").forEach(
    (b) =>
      (b.onclick = () => {
        input.value = b.textContent;
        update();
        input.focus();
      }),
  );
  attach.onclick = () => file.click();
  file.onchange = async () => {
    const selected = file.files[0];
    if (!selected) return;
    preparing = true;
    update();
    try {
      const data = await preparePhoto(selected);
      photo = data;
      const host = $("#r-photo-preview");
      host.replaceChildren();
      const img = new Image();
      img.src = "data:" + photo.mimeType + ";base64," + photo.data;
      img.alt = "첨부 사진 미리보기";
      const remove = text("button", "삭제");
      remove.type = "button";
      remove.onclick = () => {
        photo = null;
        host.replaceChildren();
        host.hidden = true;
        file.value = "";
        update();
      };
      host.append(img, remove);
      host.hidden = false;
    } catch (error) {
      say(error.message);
    } finally {
      file.value = "";
      preparing = false;
      update();
    }
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (busy || preparing || (!input.value.trim() && !photo)) return;
    const concern =
      input.value.trim() ||
      "첨부 사진의 창업 관련 고민을 확인하고 맞는 베테랑을 추천해주세요.";
    busy = true;
    update();
    status.textContent = "고민을 확인하고 있어요…";
    try {
      let result,
        source = "ai";
      try {
        const api = await import("../api/ai.js?v=photo-1");
        result = await api.aiMatch(concern, {}, photo ? [photo] : []);
      } catch (error) {
        if (photo)
          throw Error(
            "사진 분석을 완료하지 못했어요. 사진과 입력을 유지했으니 다시 시도해주세요.",
          );
        const api = await import("../api/experts.js");
        const patterns = [
          [/노무|채용|직원|근로|급여|퇴직/, "노무"],
          [/납품|단가|거래처/, "납품"],
          [/계약/, "계약"],
          [/지원금|지원사업|보조금/, "지원금"],
          [/세무|세금|부가세/, "세무"],
          [/마케팅|광고|홍보/, "마케팅"],
          [/수출|해외|무역/, "무역"],
        ];
        const keyword = patterns.find(([r]) => r.test(concern))?.[1] || concern;
        result = { matches: await api.getExperts({ keyword }) };
        source = "keyword";
      }
      if (!result.matches?.length) {
        status.textContent =
          "고민에 맞는 베테랑을 찾지 못했어요. 설명을 추가해 다시 보내주세요.";
        return;
      }
      const body = $("#r-match-body");
      const section = document.createElement("section");
      section.className = "r-match-thread";
      section.append(text("p", concern, "r-user-bubble"));
      const reply = document.createElement("div");
      reply.className = "r-ai-reply";
      reply.append(text("span", "✦", "r-ai-avatar"));
      const content = document.createElement("div");
      content.append(
        text("small", "이어주다 Ai"),
        text(
          "p",
          source === "ai"
            ? "고민과 관련된 베테랑을 찾았어요."
            : "키워드가 일치하는 베테랑을 찾았어요.",
        ),
      );
      for (const e of result.matches.slice(0, 3))
        content.append(matchCard(e, result));
      if (source === "keyword")
        content.append(
          text("small", "AI 연결을 완료하지 못해 글의 키워드로 찾은 결과예요."),
        );
      reply.append(content);
      section.append(reply);
      if (!$(".has-result")) body.replaceChildren();
      body.append(section);
      $(".r-matching").classList.add("has-result");
      input.placeholder = "메세지를 입력해주세요.";
      status.textContent = "";
      try {
        sessionStorage.setItem("earjuda-concern", concern);
        if (source === "ai")
          sessionStorage.setItem(
            "ear-ju-da:ai-match",
            JSON.stringify({ concern, ...result, source }),
          );
        else sessionStorage.removeItem("ear-ju-da:ai-match");
      } catch {}
      input.value = "";
      photo = null;
      $("#r-photo-preview").replaceChildren();
      $("#r-photo-preview").hidden = true;
      section.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } catch (error) {
      status.textContent = error.message;
    } finally {
      busy = false;
      update();
    }
  };
  update();
}
function noteCard(n) {
  const a = document.createElement("a");
  a.className = "r-note";
  a.href = href("note-detail", { id: n.id });
  const head = document.createElement("div");
  head.append(text("span", "×", "r-cross"));
  const content = document.createElement("section");
  content.append(text("h2", n.title));
  const author = text("p", n.author?.profiles?.name || "베테랑");
  author.append(text("span", " " + (n.author?.headline || "")));
  content.append(author);
  head.append(content);
  const footer = document.createElement("footer");
  footer.append(
    text("span", n.industry || ""),
    text("strong", n.price_points ? money(n.price_points) + " P" : "미리보기"),
  );
  a.append(head, footer);
  return a;
}
async function notes() {
  // These three public editorial previews are supplied in the approved design.
  // Their identifiers are kept separate from database notes and purchases.
  const cards = $$(".r-note");
  let published = [];
  const api = await import("../api/notes.js");
  try {
    published = await api.getNotes();
  } catch {
    /* Public previews remain available offline. */
  }
  const publishedCards = published.map(noteCard);
  $(".r-note-list").append(...publishedCards);
  const categories = ["계약", "자금", "판로"];
  cards.forEach((card, i) => {
    const url = new URL(card.href);
    url.searchParams.set(
      "id",
      ["preview-contract", "preview-funding", "preview-export"][i],
    );
    card.href = url.href;
  });
  const initial = params.get("category");
  function filter(category) {
    publishedCards.forEach((card, i) => {
      card.hidden =
        (category === "계약" || published[i].industry !== category) &&
        !(published[i].keywords || []).includes(category);
    });
    cards.forEach((card, i) => {
      card.hidden = category !== "계약" && categories[i] !== category;
    });
    $$(".r-note-filters button").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.textContent === category)),
    );
  }
  $$(".r-note-filters button").forEach(
    (b) => (b.onclick = () => filter(b.textContent)),
  );
  filter(initial || "계약");
}
async function detail() {
  const id = params.get("id");
  if (!id) throw Error("오답노트를 목록에서 선택해주세요.");
  if (id.startsWith("preview-")) {
    document.body.classList.add("r-editorial-preview");
    const key = id.replace("preview-", "demo-");
    const { notes: previews } = await import("./demo-data.js");
    const preview = previews.find((n) => n.id === key);
    if (!preview) throw Error("오답노트를 찾을 수 없어요.");
    if (key !== "demo-contract") {
      $(".r-category").textContent = preview.industry;
      $(".r-note-overview>h2").textContent = preview.title;
      $(".r-author").replaceChildren(
        text("div", preview.author.profiles.name),
        text("p", preview.author.headline),
      );
      $(".r-note-meta").textContent = "";
      $(".r-preview").replaceChildren(
        text("h2", "무료 미리보기"),
        text("p", preview.summary, "r-note-summary"),
      );
      $(".r-locked").replaceChildren(text("h2", "전체 오답노트"));
    }
    $(".r-purchase>div>b").textContent = money(preview.price_points) + "P";
    const auth = await import("../api/auth.js");
    const me = await auth.getMyProfile();
    $(".r-purchase small").textContent = me
      ? "보유 " + money(me.points) + "P"
      : "로그인 후 확인";
    $("#r-purchase").onclick = () =>
      say(
        "이 노트는 공개 미리보기입니다. 전체 열람은 판매 등록 후 이용할 수 있어요.",
      );
    return;
  }
  const api = await import("../api/notes.js");
  const note = await api.getNote(id);
  if (!note) throw Error("오답노트를 찾을 수 없어요.");
  $(".r-category").textContent = note.industry || "오답노트";
  $(".r-note-overview>h2").textContent = note.title;
  $(".r-author").replaceChildren(
    text("div", note.author?.profiles?.name || "베테랑"),
  );
  $(".r-author").append(text("p", note.author?.headline || ""));
  $(".r-note-meta").textContent = "";
  const preview = $(".r-preview");
  preview.replaceChildren(
    text("h2", "무료 미리보기"),
    text(
      "p",
      note.summary || "미리보기가 등록되지 않았어요.",
      "r-note-summary",
    ),
  );
  const locked = $(".r-locked");
  locked.replaceChildren(text("h2", "전체 오답노트"));
  const lock = text("div", "구매 후 전체 내용을 확인할 수 있어요.");
  lock.insertAdjacentHTML("beforeend", icon("lock"));
  locked.append(lock);
  $(".r-purchase>div>b").textContent = money(note.price_points) + "P";
  const auth = await import("../api/auth.js");
  const me = await auth.getMyProfile();
  $(".r-purchase small").textContent = me
    ? "보유 " + money(me.points) + "P"
    : "로그인 후 확인";
  const button = $("#r-purchase");
  let busy = false;
  async function owned() {
    const body = await api.getNoteBody(id);
    if (body === null) return false;
    locked.replaceChildren(
      text("h2", "전체 오답노트"),
      text("div", body, "r-owned-note"),
    );
    button.hidden = true;
    return true;
  }
  if (me && (await owned())) return;
  button.onclick = async () => {
    if (busy) return;
    if (!(await requireUser())) return;
    if (
      !(await confirmAction(
        `${note.title}\n${money(note.price_points)}P로 전체 열람할까요?`,
        "포인트로 구매",
      ))
    )
      return;
    busy = true;
    button.disabled = true;
    try {
      if (!(await owned())) {
        await api.purchaseNote(id);
        if (!(await owned()))
          throw Error(
            "구매 후 본문을 확인하지 못했어요. 보관함에서 다시 확인해주세요.",
          );
      }
    } catch (error) {
      say(error.message);
    } finally {
      busy = false;
      button.disabled = false;
    }
  };
}
async function mypage() {
  const session = await requireUser();
  if (!session) return;
  const me = await session.auth.getMyProfile();
  if (!me) throw Error("내 정보를 불러오지 못했어요.");
  const who = $(".r-my-profile");
  who
    .querySelector("h2")
    .replaceChildren(
      text("span", me.name),
      text("small", me.role === "veteran" ? "베테랑" : "스타터"),
    );
  who.querySelector("p").textContent =
    me.role === "veteran" ? "베테랑 프로필 관리" : "내 프로필 관리";
  const wallet = $(".r-my-points");
  wallet.querySelector(":scope>b").textContent = money(me.points) + "P";
  const results = await Promise.allSettled([
    import("../api/bookings.js").then((a) => a.getMyBookings()),
    import("../api/notes.js").then((a) => a.getMyPurchasedNotes()),
  ]);
  const bookings = results[0].status === "fulfilled" ? results[0].value : [];
  const held = bookings
    .filter((b) => b.status === "confirmed" && b.youth_id === me.id)
    .reduce((s, b) => s + Number(b.price_points || 0), 0);
  wallet.querySelector(":scope>p").replaceChildren();
  wallet
    .querySelector(":scope>p")
    .insertAdjacentHTML("afterbegin", icon("lock"));
  wallet
    .querySelector(":scope>p")
    .append(
      document.createTextNode(
        " 보관 중 " + money(held) + "P | 상담 완료 후 베테랑에게 전달",
      ),
    );
  const upcoming = $(".r-my-upcoming");
  upcoming.replaceChildren(text("h2", "다가오는 예약"));
  const next = bookings
    .filter(
      (b) =>
        b.status === "confirmed" && new Date(b.slot?.start_at) > new Date(),
    )
    .sort((a, b) => new Date(a.slot.start_at) - new Date(b.slot.start_at))[0];
  if (next) {
    const a = document.createElement("a");
    a.className = "r-upcoming-card";
    a.href = href("chat", { id: next.id });
    const when = new Date(next.slot.start_at);
    const h = text(
      "h3",
      when.toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
        month: "long",
        day: "numeric",
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
    const daysAway = Math.max(
      0,
      Math.ceil(
        (new Date(dateKey(when) + "T00:00:00+09:00") -
          new Date(dateKey(new Date()) + "T00:00:00+09:00")) /
          86400000,
      ),
    );
    h.prepend(text("span", daysAway ? "D-" + daysAway : "D-day"));
    a.append(h);
    const row = document.createElement("div");
    const info = document.createElement("section");
    info.append(
      text(
        "h3",
        next.youth_id === me.id
          ? next.expert?.profiles?.name
          : next.youth?.name,
      ),
      text("p", "1:1 채팅 상담"),
    );
    row.append(image(null), info, text("b", money(next.price_points) + "P"));
    a.append(row, text("footer", "상담방은 예약 시간에 열려요"));
    upcoming.append(a);
  } else
    upcoming.append(
      text(
        "p",
        results[0].status === "fulfilled"
          ? "다가오는 예약이 없어요."
          : "예약을 불러오지 못했어요. 내 상담에서 다시 확인해주세요.",
      ),
    );
  const purchased = $(".r-my-purchased");
  purchased.replaceChildren(text("h2", "구매한 오답노트"));
  if (results[1].status === "fulfilled" && results[1].value.length) {
    const n = results[1].value[0],
      a = document.createElement("a");
    a.href = href("note-detail", { id: n.id });
    a.innerHTML = "<span>" + icon("paper") + "</span>";
    const content = document.createElement("div");
    content.append(text("p", n.author?.profiles?.name), text("h3", n.title));
    a.append(content);
    purchased.append(a);
  } else
    purchased.append(
      text(
        "p",
        results[1].status === "fulfilled"
          ? "구매한 오답노트가 없어요."
          : "구매 내역을 불러오지 못했어요.",
      ),
    );
  who.onclick = () => {
    location.href = href("account-settings");
  };
  const menu = $(".r-my-menu");
  const settingsLink = menu.querySelectorAll("a")[1];
  settingsLink.href = href("account-settings");
  $('[data-action="support"]').onclick = () =>
    say("서비스 문의는 프로젝트 운영자에게 알려주세요.");
  $('[data-action="logout"]').onclick = async () => {
    if (await confirmAction("로그아웃할까요?", "로그아웃")) {
      await session.auth.signOut();
      location.href = href("home");
    }
  };
  if (me.role === "veteran") {
    for (const [label, p] of [
      ["베테랑 대시보드", "expert-dashboard"],
      ["일정 관리", "expert-schedule"],
      ["오답노트 관리", "my-notes"],
    ]) {
      const a = text("a", label);
      a.href = href(p);
      menu.prepend(a);
    }
  }
}
async function chat() {
  const id = params.get("id");
  if (!id) throw Error("내 상담에서 상담방을 선택해주세요.");
  const session = await requireUser();
  if (!session) return;
  const [bookingsApi, api] = await Promise.all([
    import("../api/bookings.js"),
    import("../api/chat.js"),
  ]);
  let booking = await bookingsApi.getBooking(id);
  if (
    !booking ||
    ![booking.youth_id, booking.expert_id].includes(session.user.id)
  )
    throw Error("이 상담방에 접근할 수 없어요.");
  const name =
    booking.youth_id === session.user.id
      ? booking.expert?.profiles?.name
      : booking.youth?.name;
  $(".r-header h1").textContent = name || "상담";
  $(".r-chat-subtitle").textContent = booking.expert?.headline || "";
  $(".r-chat-date").textContent = new Date(
    booking.slot.start_at,
  ).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  });
  const host = $("#r-chat-log");
  host.replaceChildren();
  const form = $("#r-compose"),
    input = $("#r-message"),
    send = form.querySelector("[type=submit]");
  let sending = false,
    uncertain = false,
    refreshing = false;
  const seen = new Map();
  const status = text("p", "", "r-chat-status");
  status.setAttribute("role", "status");
  form.before(status);
  const actions = document.createElement("div");
  actions.className = "r-chat-actions";
  const refresh = text("button", "새로고침");
  const complete = text("button", "상담 완료");
  const report = text("a", "보고서 보기");
  report.href = href("report", { id });
  actions.append(refresh, complete, report);
  form.before(actions);
  function allowed() {
    return (
      booking.status === "confirmed" &&
      api.getChatWindow(booking).state === "open"
    );
  }
  function update() {
    const window = api.getChatWindow(booking);
    send.disabled = sending || uncertain || !allowed() || !input.value.trim();
    input.disabled = sending || !allowed();
    const seconds = Math.max(
      0,
      Math.floor((new Date(booking.slot.end_at) - Date.now()) / 1000),
    );
    $(".r-time-left b").textContent =
      booking.status === "completed"
        ? "종료"
        : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    $(".r-time-left span").textContent =
      booking.status === "confirmed" ? "남은 시간" : "상담 상태";
    if (!sending && !uncertain)
      status.textContent = window.state === "open" ? "" : window.message;
    complete.hidden =
      booking.status !== "confirmed" || booking.youth_id !== session.user.id;
    complete.disabled =
      sending || uncertain || Date.now() < new Date(booking.slot.start_at);
    report.hidden = booking.status !== "completed";
  }
  function render() {
    const near =
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 250;
    host.replaceChildren();
    for (const m of [...seen.values()].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at),
    )) {
      const row = document.createElement("div");
      row.className =
        "r-chat-line" + (m.sender_id === session.user.id ? " mine" : "");
      const message = text("p", m.content);
      const time = text("small", clock(m.created_at));
      if (m.sender_id === session.user.id) row.append(time, message);
      else row.append(message, time);
      host.append(row);
    }
    if (!seen.size)
      host.append(
        text(
          "p",
          "아직 대화가 없어요. 상담 시간에 질문을 보내보세요.",
          "r-app-message",
        ),
      );
    if (near) host.lastElementChild?.scrollIntoView({ block: "nearest" });
  }
  function add(m) {
    if (m?.id == null || typeof m.content !== "string") return;
    seen.set(String(m.id), m);
    render();
  }
  async function reload() {
    if (refreshing) return;
    refreshing = true;
    try {
      const current = await bookingsApi.getBooking(id);
      if (
        !current ||
        ![current.youth_id, current.expert_id].includes(session.user.id)
      )
        throw Error("상담 접근 권한을 확인할 수 없어요.");
      booking = current;
      const rows = await api.getMessages(id);
      rows.forEach((m) => seen.set(String(m.id), m));
      render();
      update();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      refreshing = false;
    }
  }
  const stop = api.subscribeMessages(id, add);
  await reload();
  refresh.onclick = reload;
  input.oninput = update;
  $("#r-attach").onclick = () =>
    say(
      "이 상담방은 현재 글 메시지를 지원해요. 사진 분석은 AI 매칭 화면에서 이용할 수 있어요.",
    );
  form.onsubmit = async (event) => {
    event.preventDefault();
    const content = input.value.trim();
    if (!allowed() || sending || uncertain || !content) return;
    sending = true;
    const old = new Set(seen.keys());
    update();
    try {
      const sent = await api.sendMessage(id, content);
      add(sent);
      input.value = "";
    } catch (error) {
      try {
        const rows = await api.getMessages(id);
        const delivered = rows.find(
          (m) =>
            !old.has(String(m.id)) &&
            m.sender_id === session.user.id &&
            m.content === content,
        );
        rows.forEach((m) => seen.set(String(m.id), m));
        render();
        if (delivered) input.value = "";
        else say(error.message);
      } catch {
        uncertain = true;
        status.textContent =
          "전송 여부를 확인하지 못했어요. 중복 전송을 막기 위해 새로고침 후 확인해주세요.";
      }
    } finally {
      sending = false;
      update();
    }
  };
  complete.onclick = async () => {
    if (complete.disabled) return;
    if (
      !(await confirmAction(
        "상담을 완료하면 보관 중인 포인트가 베테랑에게 전달됩니다. 완료할까요?",
        "상담 완료",
      ))
    )
      return;
    complete.disabled = true;
    try {
      await bookingsApi.completeBooking(id);
      await reload();
    } catch (error) {
      say(error.message);
      await reload();
    }
  };
  const timer = setInterval(update, 1000),
    poll = setInterval(reload, 20000);
  window.addEventListener(
    "pagehide",
    () => {
      clearInterval(timer);
      clearInterval(poll);
      stop();
    },
    { once: true },
  );
  update();
}
export async function startApp() {
  const app = $(".r-app");
  const load = text("p", "불러오는 중…", "r-app-loading");
  document.body.append(load);
  try {
    const run = {
      home,
      "expert-booking": profile,
      booking,
      matching,
      notes,
      "note-detail": detail,
      mypage,
      chat,
    }[page];
    if (!run) throw Error("화면을 찾을 수 없어요.");
    await run();
    document.body.classList.add("mobile-live");
    const { applyFinalMetrics } = await import(
      "./mobile-design-tokens.js?v=nav-font-1"
    );
    await applyFinalMetrics().catch(() => {});
  } catch (error) {
    const main = $("#main");
    if (main)
      errorPanel(main, error.message || "화면을 불러오지 못했어요.", () =>
        location.reload(),
      );
    if (page === "chat") {
      $(".r-header h1").textContent = "상담 채팅";
      $(".r-chat-subtitle").textContent = "";
      $(".r-time-left").replaceChildren();
    }
  } finally {
    app.style.visibility = "";
    load.remove();
  }
}
