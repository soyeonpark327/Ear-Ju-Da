import { demo, money, notice, status, init, goLogin, route, avatar } from "./ui.js";
init();
const $ = (id) => document.getElementById(id);
const SENIOR_KEY = "earjuda-senior";

let auth = null;
let me = null;
let busy = false;

const ROLE = { youth: "청년 창업가", veteran: "베테랑" };
const PROVIDER = { google: "구글", kakao: "카카오", naver: "네이버" };

// 화면이 아직 없을 수도 있는 메뉴(팀원 작업 중)는 파일이 있을 때만 보여준다
const MENU = [
  { href: "consultations.html", label: "내 상담", roles: ["youth", "veteran"] },
  { href: "notifications.html", label: "알림함", roles: ["youth", "veteran"], optional: true },
  { href: "library.html", label: "구매한 오답노트", roles: ["youth"], optional: true },
  { href: "expert-dashboard.html", label: "베테랑 대시보드", roles: ["veteran"] },
  { href: "expert-schedule.html", label: "상담 일정 관리", roles: ["veteran"] },
  { href: "my-notes.html", label: "오답노트·한 줄 조언 관리", roles: ["veteran"], optional: true },
  { href: "expert-setup.html", label: "베테랑 프로필·경력 인증", roles: ["veteran"] },
  { href: "admin.html", label: "관리자", admin: true },
];

const DEMO_ME = { id: "demo", name: "김대표", role: "youth", points: 48000, avatar_url: null, senior_mode: false, is_admin: false };

function loginLabel(user) {
  const provider = user?.app_metadata?.provider;
  if (provider && PROVIDER[provider]) return `${PROVIDER[provider]} 로그인`;
  const email = user?.email ?? "";
  if (email.endsWith("@phone.invalid")) return email.replace(/^(\d{3})(\d{3,4})(\d{4})@.*/, "$1-$2-$3");
  return email;
}

async function exists(href) {
  try {
    return (await fetch(href, { method: "HEAD" })).ok;
  } catch {
    return false;
  }
}

async function renderMenu() {
  const items = MENU.filter((m) => (m.admin ? me.is_admin : m.roles.includes(me.role)));
  const shown = await Promise.all(items.map(async (m) => (!m.optional || demo || (await exists(m.href)) ? m : null)));
  $("my-menu").replaceChildren(
    ...shown.filter(Boolean).map((m) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = route(m.href);
      a.textContent = m.label;
      li.append(a);
      return li;
    }),
  );
}

function renderProfile(user) {
  $("my-name").textContent = me.name;
  $("my-role").textContent = me.is_admin ? "관리자" : ROLE[me.role] ?? "회원";
  $("my-login").textContent = demo ? "kim@example.com" : loginLabel(user);
  $("my-points").textContent = `${money(me.points)}P`;
  const box = $("my-avatar");
  const url = avatar(me.avatar_url);
  if (url) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "";
    img.width = 56;
    img.height = 56;
    box.replaceChildren(img);
  } else box.textContent = (me.name || "?").slice(0, 1);
  setSenior(!!me.senior_mode, false);
}

// ---------- 이름 ----------
$("my-name-edit").onclick = () => {
  $("my-name-input").value = me.name;
  $("my-name-form").hidden = false;
  $("my-name-input").focus();
};
$("my-name-cancel").onclick = () => ($("my-name-form").hidden = true);
$("my-name-form").onsubmit = async (e) => {
  e.preventDefault();
  const name = $("my-name-input").value.trim();
  if (name.length < 2 || name.length > 20) return status("my-name-status", "이름은 2~20자로 적어 주세요.");
  if (demo) return notice("예시 화면", "실제 서비스에서는 이름이 바뀌어요.");
  if (busy) return;
  busy = true;
  try {
    me = await auth.updateMyProfile({ name });
    $("my-name").textContent = me.name;
    $("my-name-form").hidden = true;
    status("my-name-status", "이름을 바꿨어요.");
  } catch (err) {
    status("my-name-status", err.message || "저장하지 못했어요.");
  } finally {
    busy = false;
  }
};

// ---------- 큰 글씨 모드 ----------
function setSenior(on, save = true) {
  document.documentElement.classList.toggle("senior-mode", on);
  $("my-senior").setAttribute("aria-checked", String(on));
  try {
    localStorage.setItem(SENIOR_KEY, on ? "1" : "0");
  } catch {
    // 저장 못 해도 지금 화면에는 적용
  }
  if (save && !demo && auth) auth.updateMyProfile({ senior_mode: on }).catch(() => {});
}
$("my-senior").onclick = () => setSenior($("my-senior").getAttribute("aria-checked") !== "true");

// ---------- 로그아웃 ----------
$("my-logout").onclick = async () => {
  if (demo) return notice("예시 화면", "실제 서비스에서는 로그아웃돼요.");
  await auth.signOut();
  location.href = route("home.html");
};

// ---------- 탈퇴 ----------
$("my-delete").onclick = () => {
  $("my-delete-text").textContent = `${me.name}님의 계정을 탈퇴해요. 남은 ${money(me.points)}P는 사라지고 되돌릴 수 없어요.`;
  $("my-delete-confirm").value = "";
  $("my-delete-ok").disabled = true;
  status("my-delete-status", "");
  $("my-delete-dialog").showModal();
};
$("my-delete-confirm").oninput = () => ($("my-delete-ok").disabled = $("my-delete-confirm").value.trim() !== "탈퇴");
$("my-delete-cancel").onclick = () => $("my-delete-dialog").close();
$("my-delete-form").onsubmit = async (e) => {
  e.preventDefault();
  if (busy || $("my-delete-confirm").value.trim() !== "탈퇴") return;
  if (demo) {
    $("my-delete-dialog").close();
    return notice("예시 화면", "실제 서비스에서는 탈퇴 처리되고 메인 화면으로 이동해요.");
  }
  busy = true;
  $("my-delete-ok").disabled = true;
  status("my-delete-status", "탈퇴 처리 중이에요…");
  try {
    await auth.deleteMyAccount();
    $("my-delete-dialog").close();
    try {
      localStorage.removeItem(SENIOR_KEY);
    } catch {
      // 무시
    }
    document.documentElement.classList.remove("senior-mode");
    $("my-content").hidden = true;
    status("my-status", "탈퇴가 완료됐어요. 그동안 이어주다를 이용해 주셔서 감사합니다.");
    const a = document.createElement("a");
    a.className = "primary my-home";
    a.href = route("home.html");
    a.textContent = "메인으로";
    $("my-status").append(a);
  } catch (err) {
    status("my-delete-status", err.message || "탈퇴하지 못했어요.");
    $("my-delete-ok").disabled = false;
  } finally {
    busy = false;
  }
};

// ---------- 시작 ----------
async function start() {
  status("my-status", "불러오고 있어요.");
  if (demo) {
    me = DEMO_ME;
    renderProfile(null);
    await renderMenu();
    $("my-content").hidden = false;
    status("my-status", "");
    return;
  }
  try {
    auth = await import("../api/auth.js");
    const [user, profile] = await Promise.all([auth.getCurrentUser(), auth.getMyProfile()]);
    if (!profile) return goLogin();
    me = profile;
    renderProfile(user);
    await renderMenu();
    $("my-content").hidden = false;
    status("my-status", "");
  } catch (e) {
    status("my-status", e.message || "불러오지 못했어요.", start);
  }
}
start();
