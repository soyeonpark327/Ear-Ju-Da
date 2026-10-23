import { demo, money, route, status, init, goLogin } from "./ui.js";

init();
const $ = (id) => document.getElementById(id);

function date(value) {
  return value ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(new Date(value)) : "구매일 정보 없음";
}

function render(rows) {
  const box = $("library-list");
  box.replaceChildren(...rows.map((note) => {
    const link = document.createElement("a");
    link.className = "managed-note library-note";
    link.href = route("note-detail.html", { id: note.id });
    const title = document.createElement("h2");
    title.textContent = note.title || "제목 없는 노트";
    const author = document.createElement("p");
    author.className = "managed-note-meta";
    author.textContent = `${note.author?.profiles?.name || "베테랑"} · ${note.industry || "분야 미지정"}`;
    const purchased = document.createElement("p");
    purchased.className = "managed-note-date";
    purchased.textContent = `구매일 ${date(note.purchased_at)}`;
    const price = document.createElement("strong");
    price.className = "library-price";
    price.textContent = `${money(note.price_points)}P`;
    link.append(title, author, purchased, price);
    return link;
  }));
  box.hidden = rows.length === 0;
  $("library-empty").hidden = rows.length !== 0;
}

async function load() {
  status("library-status", "구매한 노트를 불러오고 있어요.");
  if (demo) {
    const { notes } = await import("./demo-data.js");
    render(notes.slice(0, 2).map((note, index) => ({ ...note, purchased_at: `2026-10-${20 - index}T09:00:00+09:00` })));
    status("library-status", "");
    return;
  }
  try {
    const { getMyProfile } = await import("../api/auth.js");
    const me = await getMyProfile();
    if (!me) return goLogin();
    const rows = await (await import("../api/notes.js")).getMyPurchasedNotes();
    render(rows);
    status("library-status", "");
  } catch (e) { status("library-status", e.message || "구매 목록을 불러오지 못했어요.", load); }
}
load();
