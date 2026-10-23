import { demo, money, notice, status, init, goLogin, route } from "./ui.js";
init();
const $ = (id) => document.getElementById(id);
let api = null;

const DEMO = {
  experts: [{ id: "lee", name: "이정훈", headline: "자동차 부품사 구매팀 30년", price_points: 3000 }],
  notes: [{ id: 1, title: "초보 창업가가 제조사 계약 시 놓치면 100% 손해 보는 조항 5가지", price_points: 2000 }],
  blocks: [],
};

function list(id, rows, empty, make) {
  $(id).replaceChildren(
    ...(rows.length
      ? rows.map(make)
      : [Object.assign(document.createElement("li"), { className: "fav-empty", textContent: empty })]),
  );
}
function link(href, title, sub) {
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.href = route(href);
  a.textContent = title;
  const small = document.createElement("small");
  small.textContent = sub;
  a.append(small);
  li.append(a);
  return li;
}

async function load() {
  status("fav-status", "불러오고 있어요.");
  try {
    let fav = DEMO, blocks = DEMO.blocks;
    if (!demo) {
      const auth = await import("../api/auth.js");
      if (!(await auth.getCurrentUser())) return goLogin();
      api = await import("../api/social.js");
      [fav, blocks] = await Promise.all([api.getMyFavorites(), api.getMyBlocks()]);
    }
    list("fav-experts", fav.experts, "찜한 베테랑이 없어요. 베테랑 상세 화면에서 ♡를 눌러 보세요.", (e) =>
      link(`expert-booking.html?id=${encodeURIComponent(e.id)}`, e.name, `${e.headline} · ${money(e.price_points)}P`));
    list("fav-notes", fav.notes, "찜한 오답노트가 없어요.", (n) =>
      link(`note-detail.html?id=${encodeURIComponent(n.id)}`, n.title, `${money(n.price_points)}P`));
    list("fav-blocks", blocks, "차단한 사람이 없어요.", (b) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = b.user?.name ?? "회원";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "outline";
      btn.textContent = "차단 해제";
      btn.onclick = async () => {
        try {
          await api.unblockUser(b.blocked_id);
          await load();
        } catch (e) {
          notice("차단 해제", e.message);
        }
      };
      li.append(name, btn);
      return li;
    });
    $("fav-content").hidden = false;
    status("fav-status", "");
  } catch (e) {
    status("fav-status", e.message || "불러오지 못했어요.", load);
  }
}
load();
