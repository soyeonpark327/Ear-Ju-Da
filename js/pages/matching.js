import { demo, init, route, notice } from "./ui.js";

// AI 매칭 결과를 결과 화면(expert-booking)에 넘길 때 쓰는 저장 키
const AI_KEY = "ear-ju-da:ai-match";
init();
const input = document.getElementById("concern");
const send = document.getElementById("send");
const examples = [...document.querySelectorAll(".suggestions button")];
let exampleKeyword = "";
const supplied = new URLSearchParams(location.search).get("keyword");
if (supplied) input.value = supplied.slice(0, 1000);
function update() {
  send.disabled = !input.value.trim();
  examples.forEach((b) =>
    b.setAttribute("aria-pressed", String(input.value === b.textContent)),
  );
}
examples.forEach(
  (b) =>
    (b.onclick = () => {
      input.value = b.textContent;
      exampleKeyword = b.dataset.keyword;
      update();
      input.focus();
    }),
);
input.addEventListener("input", () => {
  exampleKeyword = "";
  update();
});
document.getElementById("attach").onclick = () =>
  notice(
    "첨부 기능 준비 중",
    "현재는 글로 고민을 입력할 수 있어요. 첨부 파일은 아직 전송하지 않아요.",
  );
document.getElementById("matching-form").onsubmit = async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) {
    update();
    return;
  }
  // 1순위: Gemini AI 매칭. 실패하면 아래 키워드 매칭으로 넘어간다.
  if (!demo) {
    send.disabled = true;
    input.readOnly = true;
    const statusEl = document.getElementById("matching-status");
    statusEl.textContent = "AI가 고민을 읽고 딱 맞는 베테랑을 찾고 있어요…";
    try {
      const { aiMatch } = await import("../api/ai.js");
      const result = await aiMatch(text);
      if (result.matches.length) {
        try {
          sessionStorage.setItem(AI_KEY, JSON.stringify({ concern: text, ...result }));
        } catch {
          /* 저장이 안 돼도 1순위 베테랑 화면은 보여준다 */
        }
        location.href = route("expert-booking.html", { id: result.matches[0].expert_id, ai: "1" });
        return;
      }
      statusEl.textContent = "딱 맞는 베테랑을 찾지 못해 키워드로 찾아볼게요.";
    } catch {
      statusEl.textContent = "AI 연결이 원활하지 않아 키워드로 찾아볼게요.";
    } finally {
      input.readOnly = false;
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
  send.disabled = true;
  location.href = route("expert-booking.html", { keyword });
};
update();
// Re-enable submission when returning from a result through browser history.
window.addEventListener("pageshow", update);
