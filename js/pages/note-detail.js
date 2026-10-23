import { demo, money, notice, status, init, goLogin } from "./ui.js?v=engagement-2";
init();
const id = new URLSearchParams(location.search).get("id");
const button = document.querySelector("#purchase");
let note,
  api,
  owned = false,
  accessChecked = false,
  busy = false,
  balance = null;
const $ = (id) => document.getElementById(id);
const confirmation = $("note-purchase-confirm");
function updatePurchase() {
  button.disabled = busy;
  button.textContent = busy
    ? "확인하고 있어요…"
    : owned
      ? "본문 다시 불러오기"
      : !accessChecked
        ? "열람 권한 다시 확인하기"
        : `전체 열람하기  ${money(note?.price_points)} P`;
}
async function readOwnedBody() {
  const body = await api.getNoteBody(id);
  if (body === null)
    throw new Error(
      "구매한 본문을 불러오지 못했어요. ‘본문 다시 불러오기’를 눌러주세요.",
    );
  showBody(body);
}
async function verifyAccess() {
  const body = await api.getNoteBody(id);
  if (body !== null) {
    owned = true;
    accessChecked = true;
    showBody(body);
    return;
  }
  const purchases = await api.getMyPurchasedNotes();
  owned = purchases.some((item) => String(item.id) === String(id));
  accessChecked = true;
  if (owned) await readOwnedBody();
}
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
        await verifyAccess();
      } catch (e) {
        document.querySelector("#purchase-status").textContent = e.message;
      } finally {
        updatePurchase();
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
  if (!note || busy) return;
  busy = true;
  updatePurchase();
  try {
    if (owned) {
      await readOwnedBody();
      return;
    }
    const auth = await import("../api/auth.js");
    if (!(await auth.getCurrentUser())) {
      goLogin();
      return;
    }
    // Recheck ownership before displaying a purchase confirmation, including retries.
    await verifyAccess();
    if (owned) return;
    const profile = await auth.getMyProfile();
    if (!profile || !Number.isFinite(Number(profile.points)))
      throw new Error("보유 포인트를 확인하지 못했어요. 다시 시도해주세요.");
    balance = Number(profile.points);
    $("note-purchase-question").textContent =
      `${money(note.price_points)}P를 사용해 ‘${note.title}’를 구매할까요?`;
    $("note-purchase-balance").textContent =
      balance >= note.price_points
        ? `보유 ${money(balance)}P · 구매 후 잔액 ${money(balance - note.price_points)}P`
        : `보유 ${money(balance)}P · 필요 ${money(note.price_points)}P`;
    const shortage = Math.max(0, note.price_points - balance);
    $("note-purchase-error").textContent = shortage
      ? `${money(shortage)}P 부족해요. 포인트를 준비한 뒤 다시 시도해주세요.`
      : "구매하면 포인트가 차감돼요.";
    $("note-purchase-submit").disabled = shortage > 0;
    confirmation.showModal();
  } catch (e) {
    $("purchase-status").textContent = owned
      ? "구매는 확인됐어요. ‘본문 다시 불러오기’를 눌러주세요."
      : e.message ||
        "열람 권한과 포인트를 확인하지 못했어요. 다시 시도해주세요.";
  } finally {
    busy = false;
    updatePurchase();
  }
};
$("note-purchase-cancel").onclick = () => confirmation.close();
confirmation.addEventListener("cancel", (e) => {
  if (busy) e.preventDefault();
});
$("note-purchase-submit").onclick = async () => {
  if (busy || owned || balance === null || balance < Number(note.price_points))
    return;
  busy = true;
  updatePurchase();
  $("note-purchase-submit").disabled = true;
  $("note-purchase-cancel").disabled = true;
  try {
    await api.purchaseNote(id);
    owned = true;
    accessChecked = true;
    confirmation.close();
    await readOwnedBody();
  } catch (e) {
    confirmation.close();
    if (!owned) accessChecked = false; // An ambiguous response requires ownership verification before another purchase.
    $("purchase-status").textContent = owned
      ? "구매는 완료됐어요. 본문 조회만 실패했으니 ‘본문 다시 불러오기’를 눌러주세요."
      : `${e.message || "구매 결과를 확인하지 못했어요."} 열람 권한을 다시 확인해주세요.`;
  } finally {
    busy = false;
    $("note-purchase-cancel").disabled = false;
    updatePurchase();
  }
};
load();
