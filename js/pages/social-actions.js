// 찜 · 신고 · 차단 버튼. <div id="social-actions" data-type="expert|note|chat"></div>가 있는 화면에 붙인다 (?id= 사용)
import { demo, notice, goLogin } from "./ui.js";

const box = document.getElementById("social-actions");
const type = box?.dataset.type;
const id = new URLSearchParams(location.search).get("id");
const REASONS = { expert: ["허위 경력", "부적절한 언행", "외부 거래 유도"], note: ["내용이 소개와 다름", "베낀 내용", "부적절한 내용"], chat: ["욕설·비하", "외부 거래 유도", "상담에 오지 않음"] };

const css = `#social-actions{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
#social-actions button{min-height:40px;padding:0 14px;border:1.5px solid var(--line,#dfe0e7);border-radius:20px;background:#fff;font-size:14px;font-weight:600;color:inherit}
#social-actions button[aria-pressed=true]{border-color:#e0457b;color:#c2185b}
#social-report textarea{width:100%;min-height:90px;margin:8px 0;padding:10px;border:1.5px solid var(--line,#dfe0e7);border-radius:12px;font:inherit}
#social-report .chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}#social-report .chips button{min-height:34px;padding:0 10px;border:1px solid var(--line,#dfe0e7);border-radius:16px;font-size:12px}
#social-report .row{display:grid;grid-template-columns:1fr 1fr;gap:8px}#social-report .row button{min-height:46px}`;

function button(text, onclick) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  b.onclick = onclick;
  return b;
}

async function api() {
  if (demo) return null;
  const [auth, social] = await Promise.all([import("../api/auth.js"), import("../api/social.js")]);
  if (!(await auth.getCurrentUser())) { goLogin(); return null; }
  return { ...auth, ...social };
}

function askReport(targetType, targetId) {
  let d = document.getElementById("social-report");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "social-report";
    d.innerHTML = `<form method="dialog"><h2>신고하기</h2><p>관리자가 확인하고 조치해요. 신고한 사실은 상대에게 알리지 않아요.</p>
      <div class="chips"></div><label for="social-reason">신고 사유</label><textarea id="social-reason" maxlength="500"></textarea>
      <p class="status" role="status" id="social-report-status"></p><div class="row"><button value="cancel" class="outline">취소</button><button id="social-report-ok" value="ok" class="primary">신고하기</button></div></form>`;
    document.body.append(d);
  }
  const reason = d.querySelector("textarea");
  reason.value = "";
  d.querySelector("#social-report-status").textContent = "";
  d.querySelector(".chips").replaceChildren(...REASONS[type].map((r) => button(r, () => (reason.value = r))));
  d.querySelector("#social-report-ok").onclick = async (e) => {
    e.preventDefault();
    if (demo) { d.close(); return notice("예시 화면", "실제 서비스에서는 관리자에게 신고가 접수돼요."); }
    try {
      await (await api())?.report(targetType, targetId, reason.value);
      d.close();
      notice("신고했어요", "관리자가 확인한 뒤 조치할게요.");
    } catch (err) {
      d.querySelector("#social-report-status").textContent = err.message;
    }
  };
  d.showModal();
}

async function start() {
  if (!box || !id) return;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  const a = demo ? null : await import("../api/social.js").then(async (s) => ({ ...s, ...(await import("../api/auth.js")) }));
  const user = a ? await a.getCurrentUser() : null;
  let other = type === "expert" ? id : null; // 신고·차단 대상 회원
  if (type === "chat" && user) {
    const b = await (await import("../api/bookings.js")).getBooking(id);
    other = b ? (b.youth_id === user.id ? b.expert_id : b.youth_id) : null;
  }
  if (user && other === user.id) return; // 내 프로필이면 버튼 없음
  const buttons = [];
  if (type !== "chat") {
    const fav = button("♡ 찜", async () => {
      if (demo) return notice("예시 화면", "실제 서비스에서는 마이페이지 찜 목록에 저장돼요.");
      const s = await api();
      if (!s) return;
      try { setFav(await s.toggleFavorite(type, id)); } catch (e) { notice("찜", e.message); }
    });
    const setFav = (on) => { fav.setAttribute("aria-pressed", String(on)); fav.textContent = on ? "♥ 찜함" : "♡ 찜"; };
    setFav(user ? await a.isFavorite(type, id) : false);
    buttons.push(fav);
  }
  buttons.push(button("신고", async () => (demo || (await api())) && askReport(type === "note" ? "note" : type === "chat" ? "booking" : "user", id)));
  if ((other || demo) && type !== "note") {
    const blk = button("차단", async () => {
      if (demo) return notice("예시 화면", "실제 서비스에서는 이 사람과 채팅을 주고받을 수 없게 돼요.");
      const s = await api();
      if (!s) return;
      const on = blk.getAttribute("aria-pressed") === "true";
      try {
        if (on) await s.unblockUser(other); else await s.blockUser(other);
        setBlk(!on);
        notice(on ? "차단을 풀었어요" : "차단했어요", on ? "다시 채팅을 주고받을 수 있어요." : "이 사람과 채팅 메시지를 주고받을 수 없어요. 마이페이지 찜·차단 목록에서 풀 수 있어요.");
      } catch (e) { notice("차단", e.message); }
    });
    const setBlk = (on) => { blk.setAttribute("aria-pressed", String(on)); blk.textContent = on ? "차단 해제" : "차단"; };
    setBlk(user && other ? await a.isBlocked(other) : false);
    buttons.push(blk);
  }
  box.replaceChildren(...buttons);
}
start().catch(() => {});
