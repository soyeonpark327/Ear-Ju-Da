import { demo, money, route, status, init, goLogin, notice } from "./ui.js";

init();
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const noteId = params.get("id");
const industries = ["제조", "유통", "세무", "인사·노무", "무역", "외식", "건설", "금융", "마케팅", "IT", "법무", "기타"];
const prices = Array.from({ length: 19 }, (_, index) => 1000 + index * 500);
let api = null;
let note = null;
let body = "";
let busy = false;
let dirty = false;
let confirmAction = null;

for (const price of prices) {
  const option = document.createElement("option");
  option.value = String(price);
  option.textContent = `${money(price)}P`;
  $("note-price-input").append(option);
}
const industrySelect = $("note-industry-input");

function setDirty() { dirty = true; }
for (const id of ["note-title-input", "note-summary-input", "note-industry-input", "note-keywords-input", "note-price-input", "note-body-input"]) $(id).addEventListener("input", setDirty);
$("note-summary-input").addEventListener("input", () => { $("summary-count").textContent = `${$("note-summary-input").value.length} / 200`; });
$("note-body-input").addEventListener("input", () => { $("body-count").textContent = `${$("note-body-input").value.length.toLocaleString("ko-KR")}자`; });
window.addEventListener("beforeunload", (event) => {
  if (!dirty || busy) return;
  event.preventDefault();
  event.returnValue = "";
});

function fill(value = {}) {
  $("note-title-input").value = value.title || "";
  $("note-summary-input").value = value.summary || "";
  if (value.industry && !industries.includes(value.industry)) industrySelect.append(new Option(value.industry, value.industry));
  industrySelect.value = value.industry || "";
  $("note-keywords-input").value = (value.keywords || []).join(", ");
  const price = prices.includes(Number(value.price_points)) ? Number(value.price_points) : 2000;
  $("note-price-input").value = String(price);
  $("note-body-input").value = body;
  $("summary-count").textContent = `${$("note-summary-input").value.length} / 200`;
  $("body-count").textContent = `${body.length.toLocaleString("ko-KR")}자`;
  $("note-form").hidden = false;
}

function values(is_published) {
  const keywords = [...new Set($("note-keywords-input").value.split(/[,，\n]/).map((word) => word.trim()).filter(Boolean))];
  if (keywords.length > 6) throw new Error("키워드는 6개까지 입력할 수 있어요.");
  if (!$("note-title-input").value.trim()) throw new Error("제목을 입력해주세요.");
  if (!$("note-summary-input").value.trim()) throw new Error("미리보기 요약을 입력해주세요.");
  if (!$("note-body-input").value.trim()) throw new Error("유료 본문을 입력해주세요.");
  if ($("note-title-input").value.trim().length > 60) throw new Error("제목은 60자까지 입력할 수 있어요.");
  if ($("note-summary-input").value.trim().length > 200) throw new Error("요약은 200자까지 입력할 수 있어요.");
  return {
    title: $("note-title-input").value.trim(),
    summary: $("note-summary-input").value.trim(),
    industry: $("note-industry-input").value || "기타",
    keywords,
    price_points: Number($("note-price-input").value),
    is_published,
    body: $("note-body-input").value.trim(),
  };
}

function showConfirm(title, message, action, label = "확인") {
  $("editor-confirm-title").textContent = title;
  $("editor-confirm-body").textContent = message;
  $("editor-confirm-ok").textContent = label;
  confirmAction = action;
  $("editor-confirm").showModal();
}
$("editor-confirm-cancel").onclick = () => $("editor-confirm").close();
$("editor-confirm-ok").onclick = async () => {
  if (!confirmAction || busy) return;
  const action = confirmAction;
  $("editor-confirm-ok").disabled = true;
  try { await action(); }
  catch (e) { status("editor-form-status", e.message || "요청을 처리하지 못했어요."); }
  finally {
    $("editor-confirm-ok").disabled = false;
    $("editor-confirm").close();
    confirmAction = null;
  }
};

function validate() {
  try { values(false); return true; }
  catch (e) { status("editor-form-status", e.message); return false; }
}

async function save(published) {
  if (busy || !validate()) return;
  if (demo) return notice("예시 화면", "실제 서비스에서 노트가 저장돼요.");
  const submitDraft = $("save-draft");
  const submitPublish = $("publish-note");
  busy = true;
  submitDraft.disabled = true;
  submitPublish.disabled = true;
  status("editor-form-status", published ? "노트를 공개하고 있어요." : "임시 저장하고 있어요.");
  try {
    const next = values(published);
    if (noteId) {
      await api.updateNote(noteId, next);
      note = { ...note, ...next };
    } else {
      note = await api.createNote(next);
      history.replaceState(null, "", route("note-editor.html", { id: note.id }));
    }
    dirty = false;
    status("editor-form-status", published ? "노트를 공개했어요." : "임시 저장했어요.");
    $("editor-heading").textContent = "오답노트 수정";
    $("delete-note").hidden = false;
    $("delete-note").textContent = Number(note.purchase_count || 0) > 0 ? "비공개로 돌리기" : "삭제하기";
    $("view-note").hidden = !published;
    if (published) {
      $("view-note").href = route("note-detail.html", { id: note.id });
      $("view-note").hidden = false;
      $("publish-note").textContent = "공개 내용 저장";
    }
  } catch (e) {
    status("editor-form-status", e.message || "저장하지 못했어요.");
  } finally {
    busy = false;
    submitDraft.disabled = false;
    submitPublish.disabled = false;
  }
}

$("save-draft").onclick = () => save(false);
$("publish-note").onclick = () => {
  if (!validate()) return;
  showConfirm("노트를 공개할까요?", "공개하면 누구나 미리보기를 볼 수 있고 포인트로 구매할 수 있어요.", () => save(true), "공개하기");
};

$("delete-note").onclick = () => {
  const sold = Number(note?.purchase_count || 0) > 0;
  showConfirm(sold ? "노트를 비공개로 바꿀까요?" : "노트를 삭제할까요?", sold ? "새로운 사람은 구매할 수 없고, 이미 구매한 사람은 계속 볼 수 있어요." : "삭제한 노트는 복구할 수 없어요.", async () => {
    if (demo) return notice("예시 화면", "실제 서비스에서 노트를 관리할 수 있어요.");
    busy = true;
    $("delete-note").disabled = true;
    try {
      if (sold) await api.updateNote(note.id, { is_published: false });
      else await api.deleteNote(note.id);
      dirty = false;
      location.href = route("my-notes.html");
    } finally { busy = false; $("delete-note").disabled = false; }
  }, sold ? "비공개로 바꾸기" : "삭제하기");
};

async function load() {
  status("editor-status", "오답노트 작성 화면을 준비하고 있어요.");
  if (demo) {
    const { notes } = await import("./demo-data.js");
    note = noteId ? notes.find((item) => String(item.id) === noteId) || null : null;
    body = note ? "실패 상황\n납품 단가를 일방적으로 낮추자는 요구를 받았어요.\n\n원인\n가격 조정 기준과 재협의 시점을 계약서에 적지 않았어요.\n\n극복 방법\n원자재 가격 변동에 따른 조정 기준과 합의 기한을 문서로 정했어요.\n\n체크리스트\n• 단가 조정 조건\n• 협의 결렬 시 기준 가격\n• 적용 시점" : "";
    $("editor-heading").textContent = note ? "오답노트 수정" : "새 오답노트";
    fill(note || {});
    $("delete-note").hidden = !note;
    if (note?.price_points && !prices.includes(Number(note.price_points))) {
      $("note-price-input").append(new Option(`${money(note.price_points)}P`, note.price_points));
      $("note-price-input").value = String(note.price_points);
    }
    status("editor-status", "");
    return;
  }
  try {
    const { getMyProfile } = await import("../api/auth.js");
    const me = await getMyProfile();
    if (!me) return goLogin();
    if (me.role !== "veteran") return status("editor-status", "베테랑 회원만 이용할 수 있어요.");
    api = await import("../api/notes.js");
    if (noteId) {
      const mine = await api.getMyNotes();
      note = mine.find((item) => String(item.id) === noteId) || null;
      if (!note) return status("editor-status", "내가 작성한 노트를 찾을 수 없어요.");
      body = await api.getNoteBody(noteId) || "";
    }
    $("editor-heading").textContent = note ? "오답노트 수정" : "새 오답노트";
    fill(note || {});
    $("delete-note").hidden = !note;
    $("delete-note").textContent = Number(note?.purchase_count || 0) > 0 ? "비공개로 돌리기" : "삭제하기";
    if (note?.is_published) {
      $("view-note").href = route("note-detail.html", { id: note.id });
      $("view-note").hidden = false;
    }
    status("editor-status", "");
  } catch (e) { status("editor-status", e.message || "노트를 불러오지 못했어요.", load); }
}
load();
