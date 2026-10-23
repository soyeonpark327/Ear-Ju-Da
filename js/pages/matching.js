import {
  demo,
  init,
  route,
  notice,
  avatar,
  money,
} from "./ui.js?v=engagement-2";

// AI 매칭 결과를 결과 화면(expert-booking)에 넘길 때 쓰는 저장 키
const AI_KEY = "ear-ju-da:ai-match";
init();
const input = document.getElementById("concern");
const send = document.getElementById("send");
const examples = [...document.querySelectorAll(".suggestions button")];
let exampleKeyword = "";
let submitting = false;
let attachment = null;
let preparingPhoto = false;
const photoInput = document.getElementById("matching-photo");
const photoPreview = document.getElementById("photo-preview");
function removePhoto() {
  attachment = null;
  photoInput.value = "";
  photoPreview.hidden = true;
  document.getElementById("photo-thumbnail").removeAttribute("src");
  update();
}
document.getElementById("photo-remove").onclick = removePhoto;
photoInput.onchange = async () => {
  const file = photoInput.files[0];
  if (!file) return;
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  ) {
    notice(
      "사진을 확인해주세요",
      "JPG, PNG, WebP 사진을 5MB 이하로 선택해주세요.",
    );
    photoInput.value = "";
    return;
  }
  preparingPhoto = true;
  update();
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(
      1,
      1600 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    const data = dataUrl.split(",")[1];
    if (data.length > 2_000_000)
      throw new Error("사진이 너무 커요. 더 작은 사진을 선택해주세요.");
    attachment = { mimeType: "image/jpeg", data };
    document.getElementById("photo-thumbnail").src = dataUrl;
    document.getElementById("photo-name").textContent = file.name;
    photoPreview.hidden = false;
    document.getElementById("matching-status").textContent =
      "사진을 첨부했어요. 전송하면 AI가 사진과 고민을 함께 확인해요.";
  } catch {
    notice(
      "사진을 읽지 못했어요",
      "다른 JPG, PNG 또는 WebP 사진으로 다시 선택해주세요.",
    );
  } finally {
    URL.revokeObjectURL(url);
    preparingPhoto = false;
    photoInput.value = "";
    update();
  }
};
const selectedFilters = {};
const DRAFT_KEY = `ear-ju-da:matching-draft:${demo ? "demo" : "live"}`;
let savedResult = null;
let conversationHistory = [];
function saveDraft() {
  try {
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        concern: input.value,
        filters: selectedFilters,
        result: savedResult,
        history: conversationHistory,
      }),
    );
  } catch {
    /* Storage is optional. */
  }
}
function restoreDraft() {
  if (supplied) return;
  try {
    const data = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
    if (!data || typeof data.concern !== "string") return;
    input.value = data.concern.slice(0, 1000);
    if (data.filters && typeof data.filters === "object")
      Object.assign(selectedFilters, data.filters);
    conversationHistory = Array.isArray(data.history)
      ? data.history.filter(
          (r) => typeof r?.concern === "string" && Array.isArray(r.matches),
        )
      : [];
    renderHistory();
    if (Array.isArray(data.result?.matches) && data.result.matches.length) {
      savedResult = data.result;
      renderResults(savedResult, false);
    }
  } catch {
    /* Invalid or blocked storage must not stop matching. */
  }
}
function renderResults(result, scroll = true) {
  const source =
    result.source === "ai"
      ? "AI 추천"
      : demo
        ? "예시 키워드 검색"
        : "키워드 검색";
  document.getElementById("matching-concern").textContent = result.concern;
  document.getElementById("matching-source").textContent = source;
  document.getElementById("matching-explanation").textContent =
    result.source === "ai"
      ? "AI가 정리한 추천 근거예요. 실제 상담 가능 범위는 프로필에서 확인해주세요."
      : `${result.fallback ? "AI 추천을 완료하지 못해 키워드로 찾았어요. 선택한 필터는 적용하지 못했어요. " : ""}문장 전체를 이해한 AI 추천이 아니라, 등록된 소개와 키워드가 일치한 결과예요.`;
  const cards = document.getElementById("matching-cards");
  cards.replaceChildren();
  for (const match of result.matches) cards.append(buildCard(match, result));
  renderHistory();
  document.getElementById("matching-conversation").hidden = false;
  document.getElementById("matching-results").hidden = false;
  document.getElementById("matching-status").textContent =
    "추천 근거와 상담 범위를 확인해주세요.";
  if (scroll)
    document
      .getElementById("matching-results")
      .scrollIntoView({ block: "start", behavior: "smooth" });
}
function scopeCaution(concern, match) {
  const profile = `${match.headline || ""} ${(match.keywords || []).join(" ")} ${match.reason || ""}`;
  if (
    /지원금|지원사업|보조금/.test(concern) &&
    /신청|처음/.test(concern) &&
    /정산/.test(profile)
  )
    return "지원금 신청과 정산은 다른 업무예요. 정산 경력이 신청 자격·서류 상담까지 포함하는지는 예약 전에 확인해주세요.";
  return "등록된 경력과 고민의 세부 분야가 다를 수 있어요. 상담 가능 범위를 먼저 확인해주세요.";
}
function finishResults(result) {
  if (savedResult) conversationHistory.push(savedResult);
  savedResult = result;
  if (result.source === "ai") {
    try {
      sessionStorage.setItem(AI_KEY, JSON.stringify(result));
    } catch {
      /* optional */
    }
  }
  if (result.source !== "ai") {
    try {
      sessionStorage.removeItem(AI_KEY);
    } catch {
      /* optional */
    }
  }
  saveDraft();
  renderResults(result);
}

const supplied = new URLSearchParams(location.search).get("keyword");
if (supplied) input.value = supplied.slice(0, 1000);
function update() {
  send.disabled =
    submitting || preparingPhoto || (!input.value.trim() && !attachment);
  document.getElementById("attach").disabled = submitting || preparingPhoto;
  document.getElementById("photo-remove").disabled =
    submitting || preparingPhoto;
  examples.forEach((b) =>
    b.setAttribute(
      "aria-pressed",
      String(input.value.trim() === b.textContent.trim()),
    ),
  );
}
examples.forEach(
  (b) =>
    (b.onclick = () => {
      input.value = b.textContent.trim();
      exampleKeyword = b.dataset.keyword;
      update();
      saveDraft();
      input.focus();
    }),
);
input.addEventListener("input", () => {
  exampleKeyword = "";
  saveDraft();
  update();
});
document.getElementById("attach").onclick = () => photoInput.click();
document.getElementById("matching-form").onsubmit = async (e) => {
  e.preventDefault();
  const text =
    input.value.trim() ||
    (attachment
      ? "첨부 사진의 창업 관련 고민을 확인하고 맞는 베테랑을 추천해주세요."
      : "");
  if (!text || submitting || preparingPhoto) {
    update();
    return;
  }
  if (demo && attachment) {
    notice(
      "사진 분석은 실제 모드에서 가능해요",
      "데모에서는 사진을 전송하지 않아요. 실제 매칭 화면에서 다시 시도해주세요.",
    );
    return;
  }
  submitting = true;
  // 1순위: Gemini AI 매칭. 실패하면 아래 키워드 매칭으로 넘어간다.
  if (!demo) {
    send.disabled = true;
    input.readOnly = true;
    setFilterBusy(true);
    const statusEl = document.getElementById("matching-status");
    statusEl.textContent =
      "AI가 딱 맞는 베테랑을 찾고 있어요. 보통 2~4초 정도 걸려요…";
    try {
      const { aiMatch, AI_MATCH_KEY } = await import("../api/ai.js?v=photo-1");
      const result = await aiMatch(
        text,
        { ...selectedFilters },
        attachment ? [attachment] : [],
      );
      if (result.filtered_count === 0) {
        statusEl.textContent =
          "조건에 맞는 베테랑이 없어요. 필터를 줄여보세요.";
        clearResults();
        submitting = false;
        return;
      }
      if (result.matches?.length) {
        try {
          sessionStorage.setItem(
            AI_MATCH_KEY,
            JSON.stringify({ concern: text, ...result }),
          );
        } catch {
          /* 저장이 안 돼도 1순위 베테랑 화면은 보여준다 */
        }
        finishResults({ concern: text, ...result, source: "ai" });
        submitting = false;
        return;
      }
      if (attachment) {
        clearResults();
        statusEl.textContent =
          "사진과 고민에 맞는 베테랑을 찾지 못했어요. 설명을 추가해 다시 보내주세요.";
        submitting = false;
        return;
      }
      statusEl.textContent = "딱 맞는 베테랑을 찾지 못해 키워드로 찾아볼게요.";
    } catch {
      if (attachment) {
        statusEl.textContent =
          "사진 분석을 완료하지 못했어요. 사진과 입력은 유지했으니 다시 전송해주세요.";
        submitting = false;
        return;
      }
      statusEl.textContent = "AI 연결이 원활하지 않아 키워드로 찾아볼게요.";
    } finally {
      input.readOnly = false;
      setFilterBusy(false);
      update();
    }
  }
  const rules = [
    [/노무|채용|직원|근로|급여|퇴직/, "노무"],
    [/납품|단가|거래처/, "납품"],
    [/계약/, "계약"],
    [/지원금|지원사업|보조금/, "지원금"],
    [/세무|세금|부가세/, "세무"],
    [/마케팅|광고|홍보/, "마케팅"],
    [/수출|해외|무역/, "무역"],
  ];
  let keyword =
    exampleKeyword ||
    rules.find(([pattern]) => pattern.test(text))?.[1] ||
    text;
  if (demo) keyword = { 납품: "계약", 지원금: "자금" }[keyword] || keyword;
  try {
    let rows = demo
      ? (await import("./demo-data.js")).experts.filter((e) =>
          `${e.name} ${e.headline} ${(e.keywords || []).join(" ")}`.includes(
            keyword,
          ),
        )
      : await (await import("../api/experts.js")).getExperts({ keyword });
    if (!demo && !rows.length) {
      const all = await (await import("../api/experts.js")).getExperts();
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
    if (!rows.length) {
      clearResults();
      document.getElementById("matching-status").textContent =
        "관련 베테랑이 없어요. 위의 계약·채용·지원금 예시를 선택하거나 필터를 줄여 다시 보내주세요.";
      return;
    }
    finishResults({
      concern: text,
      source: "keyword",
      fallback: !demo,
      matches: rows.slice(0, 3).map((e) => ({
        ...e,
        expert_id: e.id,
        reason: `검색어 ‘${keyword}’로 등록된 소개·키워드를 검색해 찾았어요. 이 검색만으로 세부 업무 경력을 확인한 것은 아니에요.`,
      })),
    });
  } catch {
    const el = document.getElementById("matching-status");
    el.textContent = "추천을 불러오지 못했어요. 입력 내용은 유지했어요. ";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "다시 시도";
    retry.onclick = () =>
      document.getElementById("matching-form").requestSubmit();
    el.append(retry);
  } finally {
    submitting = false;
    input.readOnly = false;
    setFilterBusy(false);
    update();
    saveDraft();
  }
};
update();
// Re-enable submission when returning from a result through browser history.
window.addEventListener("pageshow", () => {
  submitting = false;
  input.readOnly = false;
  setFilterBusy(false);
  update();
});

function setFilterBusy(value) {
  document
    .querySelectorAll("#ai-filters button, .suggestions button")
    .forEach((button) => (button.disabled = value));
}
function renderFilterGroup(containerId, key, values) {
  const container = document.getElementById(containerId);
  container.replaceChildren();
  values.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ai-filter-chip";
    button.textContent = option.label;
    button.setAttribute(
      "aria-pressed",
      String(selectedFilters[key] === option.value),
    );
    button.onclick = () => {
      if (selectedFilters[key] === option.value) delete selectedFilters[key];
      else selectedFilters[key] = option.value;
      saveDraft();
      [...container.children].forEach((child, index) =>
        child.setAttribute(
          "aria-pressed",
          String(selectedFilters[key] === values[index].value),
        ),
      );
    };
    container.append(button);
  });
}
async function loadFilters() {
  // Demo mode must not call the AI/filter API or initialize its dependencies.
  if (demo) return;
  try {
    const { getMatchFilterOptions, STAGES, BUDGETS } = await import(
      "../api/ai.js"
    );
    const options = await getMatchFilterOptions();
    renderFilterGroup(
      "ai-filter-industry",
      "industry",
      options.industries.map((value) => ({ value, label: value })),
    );
    renderFilterGroup("ai-filter-stage", "stage", STAGES);
    renderFilterGroup("ai-filter-budget", "max_price", BUDGETS);
    const soon = document.getElementById("ai-filter-soon");
    soon.setAttribute("aria-pressed", String(!!selectedFilters.available_soon));
    soon.onclick = () => {
      if (selectedFilters.available_soon) delete selectedFilters.available_soon;
      else selectedFilters.available_soon = true;
      saveDraft();
      soon.setAttribute(
        "aria-pressed",
        String(!!selectedFilters.available_soon),
      );
    };
    document.getElementById("ai-filters").hidden = false;
    setFilterBusy(submitting);
  } catch {
    document.getElementById("ai-filters").hidden = true;
    Object.keys(selectedFilters).forEach((key) => delete selectedFilters[key]);
  }
}
loadFilters();

document.getElementById("matching-new").onclick = () => {
  savedResult = null;
  conversationHistory = [];
  document.getElementById("matching-history").replaceChildren();
  document.getElementById("matching-conversation").hidden = true;
  input.value = "";
  removePhoto();
  exampleKeyword = "";
  Object.keys(selectedFilters).forEach((key) => delete selectedFilters[key]);
  document
    .querySelectorAll("#ai-filters button")
    .forEach((b) => b.setAttribute("aria-pressed", "false"));
  document.getElementById("matching-results").hidden = true;
  try {
    sessionStorage.removeItem(AI_KEY);
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* optional */
  }
  document.getElementById("matching-status").textContent =
    "새 고민을 입력해주세요.";
  update();
  input.focus();
};
restoreDraft();
update();

function clearResults() {
  if (savedResult) conversationHistory.push(savedResult);
  savedResult = null;
  renderHistory();
  document.getElementById("matching-results").hidden = true;
  saveDraft();
}

// Mobile browsers resize the visual viewport when the software keyboard opens.
window.visualViewport?.addEventListener("resize", () => {
  if (document.activeElement === input)
    input.scrollIntoView({ block: "nearest" });
});

function buildCard(match, result) {
  const card = document.createElement("article");
  card.className = "matching-result-card r-match-card";
  const person = document.createElement("div");
  person.className = "r-match-person";
  const imageUrl = demo ? match.avatar_url : avatar(match.avatar_url);
  if (imageUrl) {
    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = "";
    img.onerror = () => img.remove();
    person.append(img);
  }
  const info = document.createElement("div");
  const name = document.createElement("h3");
  name.textContent = match.name;
  const headline = document.createElement("small");
  headline.textContent = match.headline;
  info.append(name, headline);
  person.append(info);
  if (Number.isFinite(Number(match.rating)) && match.rating != null) {
    const score = document.createElement("span");
    const value = document.createElement("b");
    value.textContent = match.rating;
    const label = document.createElement("small");
    label.textContent = "평점";
    score.append(value, label);
    person.append(score);
  }
  card.append(person);
  const reason = document.createElement("p");
  reason.textContent = match.reason || "프로필에서 경력을 확인해주세요.";
  card.append(reason);
  const actions = document.createElement("div");
  actions.className = "r-match-actions";
  for (const [label, path] of [
    ["프로필 보기", "expert-booking.html"],
    ["상담 예약", "booking.html"],
  ]) {
    const a = document.createElement("a");
    a.textContent = label;
    a.href = route(path, {
      id: match.expert_id,
      ...(result.source === "ai" && path === "expert-booking.html"
        ? { ai: "1" }
        : {}),
    });
    a.onclick = () => {
      try {
        if (result.source === "ai")
          sessionStorage.setItem(AI_KEY, JSON.stringify(result));
        else sessionStorage.removeItem(AI_KEY);
      } catch {
        /* Storage is optional. */
      }
    };
    actions.append(a);
  }
  card.append(actions);
  const caution = scopeCaution(result.concern, match);
  if (caution) {
    const details = document.createElement("details");
    details.className = "r-result-details";
    const summary = document.createElement("summary");
    summary.textContent = "상담 범위 확인";
    const text = document.createElement("p");
    text.textContent = caution;
    details.append(summary, text);
    card.append(details);
  }
  return card;
}

function renderHistory() {
  const host = document.getElementById("matching-history");
  host.replaceChildren();
  for (const item of conversationHistory) {
    const section = document.createElement("section");
    section.className = "matching-history-item";
    const concern = document.createElement("p");
    concern.className = "matching-concern";
    concern.textContent = item.concern;
    const title = document.createElement("h2");
    title.textContent =
      item.source === "ai"
        ? "AI 추천"
        : "키워드 검색 · 등록 정보가 일치한 결과예요";
    section.append(concern, title);
    for (const match of item.matches) section.append(buildCard(match, item));
    host.append(section);
  }
  if (conversationHistory.length)
    document.getElementById("matching-conversation").hidden = false;
}
