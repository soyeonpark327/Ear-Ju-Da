import { demo, money, route, status, init, goLogin, notice } from "./ui.js";

init();
const $ = (id) => document.getElementById(id);
const sampleTips = [
  { id: "tip-sample-1", content: "납품 단가를 정할 때는 원자재 가격이 바뀌는 기준과 재협상 시점을 계약서에 함께 적어두세요.", created_at: "2026-10-20T09:00:00+09:00" },
  { id: "tip-sample-2", content: "첫 거래일수록 구두 약속을 메일로 한 번 더 확인하면 나중에 생길 오해를 줄일 수 있어요.", created_at: "2026-10-18T09:00:00+09:00" },
];
let api = null;
let notes = [];
let tips = [];
let busy = false;
let confirmAction = null;

function formatDate(value) {
  if (!value) return "날짜 정보 없음";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(new Date(value));
}

function confirm(title, message, action, label = "확인") {
  $("manage-confirm-title").textContent = title;
  $("manage-confirm-body").textContent = message;
  $("manage-confirm-ok").textContent = label;
  confirmAction = action;
  $("manage-confirm").showModal();
}

$("manage-confirm-cancel").onclick = () => $("manage-confirm").close();
$("manage-confirm-ok").onclick = async () => {
  if (!confirmAction || busy) return;
  const action = confirmAction;
  $("manage-confirm-ok").disabled = true;
  try {
    await action();
    $("manage-confirm").close();
  } catch (e) {
    status("my-notes-status", e.message || "요청을 처리하지 못했어요.");
    $("manage-confirm").close();
  } finally {
    $("manage-confirm-ok").disabled = false;
    confirmAction = null;
  }
};

function renderNotes() {
  const box = $("my-notes-list");
  box.replaceChildren(...notes.map((note) => {
    const card = document.createElement("article");
    card.className = "managed-note";
    const title = document.createElement("h3");
    title.textContent = note.title || "제목 없는 노트";
    const meta = document.createElement("p");
    meta.className = "managed-note-meta";
    meta.textContent = `${note.is_published ? "공개 중" : "작성 중"} · ${money(note.price_points)}P · 판매 ${money(note.purchase_count)}건`;
    const date = document.createElement("p");
    date.className = "managed-note-date";
    date.textContent = `작성일 ${formatDate(note.created_at)}`;
    const actions = document.createElement("div");
    actions.className = "managed-note-actions";
    const edit = document.createElement("a");
    edit.className = "outline";
    edit.href = route("note-editor.html", { id: note.id });
    edit.textContent = "수정";
    actions.append(edit);
    if (demo) {
      const preview = document.createElement("a");
      preview.className = "outline";
      preview.href = route("note-detail.html", { id: note.id });
      preview.textContent = "미리보기";
      actions.append(preview);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "outline";
    const sold = Number(note.purchase_count || 0) > 0;
    remove.textContent = sold ? "비공개로 돌리기" : "삭제하기";
    remove.onclick = () => confirm(
      sold ? "노트를 비공개로 바꿀까요?" : "노트를 삭제할까요?",
      sold ? "새로운 사람이 더는 구매할 수 없어요. 이미 구매한 사람은 계속 볼 수 있어요." : "삭제한 노트는 복구할 수 없어요.",
      async () => {
        if (demo) return notice("예시 화면", "실제 서비스에서 노트를 관리할 수 있어요.");
        busy = true;
        try {
          if (sold) await api.updateNote(note.id, { is_published: false });
          else await api.deleteNote(note.id);
          await loadNotes();
          status("my-notes-status", sold ? "노트를 비공개로 바꿨어요." : "노트를 삭제했어요.");
        } finally {
          busy = false;
        }
      },
      sold ? "비공개로 바꾸기" : "삭제하기",
    );
    actions.append(remove);
    card.append(title, meta, date, actions);
    return card;
  }));
  $("my-notes-empty").hidden = notes.length > 0;
}

async function loadNotes() {
  if (demo) {
    const { notes: examples } = await import("./demo-data.js");
    notes = examples.slice(0, 2).map((note, index) => ({
      id: note.id,
      title: note.title,
      is_published: index === 0,
      price_points: note.price_points || 2500,
      purchase_count: index === 0 ? 12 : 0,
      created_at: index === 0 ? "2026-10-20T09:00:00+09:00" : "2026-10-22T09:00:00+09:00",
    }));
  } else notes = await api.getMyNotes();
  renderNotes();
}

function renderTips() {
  $("tips-list").replaceChildren(...tips.map((tip) => {
    const li = document.createElement("li");
    const content = document.createElement("p");
    content.textContent = tip.content;
    const date = document.createElement("time");
    date.textContent = formatDate(tip.created_at);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "outline";
    remove.textContent = "삭제";
    remove.setAttribute("aria-label", `조언 삭제: ${tip.content.slice(0, 24)}`);
    remove.onclick = () => confirm("한 줄 조언을 삭제할까요?", "삭제한 조언은 복구할 수 없어요.", async () => {
      if (demo) return notice("예시 화면", "실제 서비스에서 조언을 관리할 수 있어요.");
      busy = true;
      try {
        await (await import("../api/experts.js")).deleteTip(tip.id);
        await loadTips();
        status("tips-status", "조언을 삭제했어요.");
      } finally { busy = false; }
    }, "삭제하기");
    li.append(content, date, remove);
    return li;
  }));
  $("tips-empty").hidden = tips.length > 0;
}

async function loadTips() {
  try {
    tips = demo ? sampleTips.slice() : await (await import("../api/experts.js")).getTips(profile.id);
    renderTips();
  } catch (e) {
    status("tips-status", e.message || "조언을 불러오지 못했어요.", loadTips);
  }
}

$("tip-content").addEventListener("input", () => { $("tip-count").textContent = `${$("tip-content").value.length} / 200`; });
$("tip-form").onsubmit = async (event) => {
  event.preventDefault();
  if (busy) return;
  const content = $("tip-content").value.trim();
  if (!content || content.length > 200) return status("tips-status", "조언을 1~200자로 적어주세요.");
  if (demo) return notice("예시 화면", "실제 서비스에서 조언이 등록돼요.");
  busy = true;
  const submit = $("tip-form").querySelector("button[type=submit]");
  submit.disabled = true;
  try {
    status("tips-status", "조언을 올리고 있어요.");
    const created = await (await import("../api/experts.js")).addTip(content);
    tips.unshift(created);
    renderTips();
    $("tip-content").value = "";
    $("tip-count").textContent = "0 / 200";
    status("tips-status", "조언을 올렸어요.");
  } catch (e) {
    status("tips-status", e.message || "조언을 올리지 못했어요.");
  } finally { busy = false; submit.disabled = false; }
};

let profile = null;
async function load() {
  status("my-notes-status", "화면을 준비하고 있어요.");
  if (demo) {
    profile = { id: "demo-veteran", role: "veteran" };
    $("my-notes-content").hidden = false;
    await Promise.all([loadNotes(), loadTips()]);
    status("my-notes-status", "");
    return;
  }
  try {
    profile = await (await import("../api/auth.js")).getMyProfile();
    if (!profile) return goLogin();
    if (profile.role !== "veteran") return status("my-notes-status", "베테랑 회원만 이용할 수 있어요.");
    api = await import("../api/notes.js");
    $("my-notes-content").hidden = false;
    await Promise.all([loadNotes(), loadTips()]);
    status("my-notes-status", "");
  } catch (e) {
    status("my-notes-status", e.message || "화면을 불러오지 못했어요.", load);
  }
}
load();
