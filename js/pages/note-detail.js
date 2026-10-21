import { demo, money, notice, status, init } from "./ui.js";
init();
const id = new URLSearchParams(location.search).get("id");
const button = document.querySelector("#purchase");
let note, api;
function showBody(body) {
  document.querySelector("#note-body").textContent = body;
  document.querySelector("#body-section").hidden = false;
  document.querySelector("#locked").hidden = true;
  button.hidden = true;
  document.querySelector("#purchase-status").textContent =
    "전체 내용을 열람하고 있어요.";
}
async function load() {
  document.querySelector("#detail").hidden = true;
  status("detail-status", "오답노트를 불러오고 있어요.");
  if (!id) {
    status(
      "detail-status",
      "선택한 오답노트가 없어요. 목록으로 돌아가 선택해주세요.",
    );
    return;
  }
  try {
    if (demo)
      note = (await import("./demo-data.js")).notes.find((n) => n.id === id);
    else {
      api = await import("../api/notes.js");
      note = await api.getNote(id);
    }
    if (!note) {
      status("detail-status", "삭제되었거나 공개되지 않은 오답노트예요.");
      return;
    }
    document.title = `${note.title} | 이어주다`;
    document.querySelector("#note-title").textContent =
      demo && id === "demo-contract"
        ? "“품질 기준은 추후 협의한다”"
        : note.title;
    document.querySelector("#note-summary").textContent =
      demo && id === "demo-contract"
        ? "이 한 줄로 잃은 돈 2천 5백만원"
        : note.summary;
    document.querySelector("#demo-preview").hidden = !(
      demo && id === "demo-contract"
    );
    button.textContent = `전체 열람하기  ${money(note.price_points)} P`;
    document.querySelector("#detail").hidden = false;
    status("detail-status", "");
    if (!demo) {
      try {
        const body = await api.getNoteBody(id);
        if (body !== null) showBody(body);
      } catch (e) {
        document.querySelector("#purchase-status").textContent = e.message;
      }
    }
  } catch (e) {
    status("detail-status", e.message || "오답노트를 불러오지 못했어요.", load);
  }
}
button.onclick = async () => {
  if (demo) {
    notice(
      "디자인 미리보기",
      "예시 노트는 구매할 수 없어요. 실제 서비스에서 로그인 후 이용해주세요.",
    );
    return;
  }
  if (!note || button.disabled) return;
  button.disabled = true;
  button.textContent = "열람 권한을 확인하고 있어요…";
  try {
    const { getCurrentUser } = await import("../api/auth.js");
    if (!(await getCurrentUser())) {
      notice(
        "로그인이 필요해요",
        "로그인 후 포인트로 오답노트를 구매할 수 있어요. 로그인 화면은 준비 중이에요.",
      );
      return;
    }
    await api.purchaseNote(id);
    const body = await api.getNoteBody(id);
    if (body !== null) showBody(body);
    else
      throw new Error(
        "구매는 완료됐지만 본문을 불러오지 못했어요. 새로고침하면 구매한 내용을 다시 확인할 수 있어요.",
      );
  } catch (e) {
    document.querySelector("#purchase-status").textContent =
      e.message || "구매하지 못했어요. 다시 시도해주세요.";
  } finally {
    button.disabled = false;
    button.textContent = `전체 열람하기  ${money(note.price_points)} P`;
  }
};
load();
