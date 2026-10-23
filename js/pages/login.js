import { status } from "./ui.js";
import {
  signInWithId,
  signUpWithId,
  signOut,
  getMyProfile,
  normalizePhone,
  getAuthProviders,
  signInWithSocial,
  isNaverEnabled,
  signInWithNaver,
  completeNaverLogin,
  chooseMyRole,
} from "../api/auth.js";

const $ = (id) => document.getElementById(id);
let mode = "login";
let busy = false;

// 로그인 후 돌아갈 곳. 같은 사이트 주소만 허용한다. 예) login.html?next=/pages/booking.html?expert=...
const next = (() => {
  try {
    const url = new URL(new URLSearchParams(location.search).get("next") || "home.html", location.href);
    return url.origin === location.origin ? url.href : "home.html";
  } catch {
    return "home.html";
  }
})();
$("back").href = next;
$("continue").href = next;

// Supabase 에러 메시지를 한국어로
function friendly(message = "") {
  if (/Invalid login credentials/i.test(message)) return "이메일·휴대폰 번호 또는 비밀번호가 맞지 않아요.";
  if (/already registered/i.test(message)) return "이미 가입된 이메일 또는 휴대폰 번호예요. 로그인해주세요.";
  if (/provider is not enabled|Unsupported provider/i.test(message)) return "아직 준비 중인 로그인 방식이에요.";
  if (/at least 6 characters/i.test(message)) return "비밀번호는 6자 이상 입력해주세요.";
  if (/invalid format|valid email/i.test(message)) return "이메일 형식을 확인해주세요.";
  if (/Email not confirmed/i.test(message)) return "메일함에서 인증을 먼저 완료해주세요.";
  if (/rate limit|security purposes/i.test(message)) return "요청이 너무 많아요. 잠시 후 다시 시도해주세요.";
  return message || "다시 시도해주세요.";
}

function setMode(value) {
  mode = value;
  const signup = mode === "signup";
  $("tab-login").setAttribute("aria-selected", String(!signup));
  $("tab-signup").setAttribute("aria-selected", String(signup));
  $("signup-fields").hidden = !signup;
  $("password-hint").hidden = !signup;
  $("demo-box").hidden = signup;
  $("password").autocomplete = signup ? "new-password" : "current-password";
  $("page-title").textContent = signup ? "회원가입" : "로그인";
  $("submit").textContent = signup ? "가입하고 시작하기" : "로그인";
  document.title = `${signup ? "회원가입" : "로그인"} | 이어주다`;
  status("auth-status", "");
}
$("tab-login").onclick = () => setMode("login");
$("tab-signup").onclick = () => setMode("signup");

function validate() {
  const fields = [$("email"), $("password")];
  if (mode === "signup") fields.unshift($("name"));
  let firstInvalid = null;
  for (const input of fields) {
    const value = input.value.trim();
    const bad =
      !value ||
      (input.id === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !normalizePhone(value)) ||
      (input.id === "password" && mode === "signup" && value.length < 6);
    input.setAttribute("aria-invalid", String(bad));
    if (bad && !firstInvalid) firstInvalid = input;
  }
  if (firstInvalid) {
    firstInvalid.focus();
    const label = { name: "이름을", email: "이메일 또는 휴대폰 번호를", password: "비밀번호를" }[firstInvalid.id];
    status("auth-status", firstInvalid.id === "password" && mode === "signup" && firstInvalid.value
      ? "비밀번호는 6자 이상 입력해주세요."
      : `${label} 확인해주세요.`);
  }
  return !firstInvalid;
}

$("auth-form").onsubmit = async (e) => {
  e.preventDefault();
  if (busy || !validate()) return;
  busy = true;
  $("submit").disabled = true;
  $("auth-status").classList.remove("ok");
  status("auth-status", mode === "signup" ? "가입하고 있어요…" : "로그인하고 있어요…");
  try {
    const id = $("email").value.trim();
    const password = $("password").value;
    if (mode === "signup") {
      const role = new FormData($("auth-form")).get("role");
      const { session } = await signUpWithId({ id, password, name: $("name").value.trim(), role });
      if (!session) {
        $("auth-status").classList.add("ok");
        status("auth-status", "가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해주세요.");
        setTimeout(() => setMode("login"), 0);
        return;
      }
    } else {
      await signInWithId(id, password);
    }
    location.replace(next);
  } catch (err) {
    status("auth-status", friendly(err.message));
  } finally {
    busy = false;
    $("submit").disabled = false;
  }
};

// 데모 계정 버튼: 입력칸을 채우고 바로 로그인
document.querySelectorAll("[data-email]").forEach((button) => {
  button.onclick = () => {
    setMode("login");
    $("email").value = button.dataset.email;
    $("password").value = "demo1234!";
    $("auth-form").requestSubmit();
  };
});

$("logout").onclick = async () => {
  $("logout").disabled = true;
  try {
    await signOut();
    location.reload();
  } catch (err) {
    status("auth-status", friendly(err.message));
    $("logout").disabled = false;
  }
};

// ---------- 간편 로그인 (카카오·네이버·구글) ----------
// Supabase에서 켠 방식만 버튼을 활성화한다. 네이버는 Edge Function이 배포·설정됐는지 따로 확인한다.
(async () => {
  let enabled = {};
  const [providers, naver] = await Promise.all([getAuthProviders().catch(() => ({})), isNaverEnabled()]);
  enabled = { ...providers, naver };
  const off = [];
  document.querySelectorAll("[data-provider]").forEach((button) => {
    const provider = button.dataset.provider;
    const on = enabled[provider] === true;
    button.disabled = !on;
    if (!on) off.push(button.dataset.label);
    button.onclick = async () => {
      if (busy) return;
      busy = true;
      status("social-status", "로그인 화면으로 이동하고 있어요…");
      try {
        // 로그인 후 이 화면으로 돌아와서(next 유지) 원래 보던 곳으로 보낸다
        const back = location.href.split("#")[0];
        if (provider === "naver") signInWithNaver(back);
        else await signInWithSocial(provider, back);
      } catch (err) {
        status("social-status", friendly(err.message));
        busy = false;
      }
    };
  });
  if (off.length) status("social-status", `${off.join(", ")} 로그인은 준비 중이에요.`);
})();

// ---------- 역할 선택 (소셜 가입자가 처음 로그인했을 때) ----------
function showChooseRole() {
  ["auth-form", "demo-box", "social", "signed-in"].forEach((id) => ($(id).hidden = true));
  document.querySelector(".tabs").hidden = true;
  $("choose-role").hidden = false;
  $("page-title").textContent = "가입 마무리";
  document.title = "가입 마무리 | 이어주다";
}
$("choose-submit").onclick = async () => {
  $("choose-submit").disabled = true;
  try {
    const role = document.querySelector('input[name="first-role"]:checked').value;
    await chooseMyRole(role);
    location.replace(next);
  } catch (err) {
    status("choose-status", friendly(err.message));
    $("choose-submit").disabled = false;
  }
};
// 로그인 직후: 역할을 아직 안 골랐으면 선택 화면, 아니면 원래 보던 곳으로
async function afterSocialLogin() {
  const me = await getMyProfile();
  if (me?.role_confirmed === false) showChooseRole();
  else location.replace(next);
}

// 소셜 로그인에서 돌아왔을 때: 성공이면 원래 화면으로, 실패면 이유를 보여준다
const returnParams = new URLSearchParams(location.hash.slice(1) || location.search);
const fromSocial = returnParams.has("access_token") || returnParams.has("error_description");
if (returnParams.has("error_description")) {
  status("social-status", friendly(returnParams.get("error_description")));
}
if (returnParams.has("naver_error")) {
  status("social-status", returnParams.get("naver_error"));
  history.replaceState(null, "", location.pathname + location.search);
}
// 네이버: Edge Function이 준 일회용 토큰으로 로그인을 마친다
if (returnParams.has("naver_token_hash")) {
  const tokenHash = returnParams.get("naver_token_hash");
  history.replaceState(null, "", location.pathname + location.search);
  status("social-status", "네이버 로그인을 마무리하고 있어요…");
  completeNaverLogin(tokenHash)
    .then(afterSocialLogin)
    .catch((err) => status("social-status", friendly(err.message)));
}

// 이미 로그인한 상태면 안내만 보여준다
(async () => {
  try {
    const me = await getMyProfile();
    if (!me) return;
    if (fromSocial) {
      await afterSocialLogin();
      return;
    }
    if (me.role_confirmed === false) {
      showChooseRole();
      return;
    }
    $("auth-form").hidden = true;
    document.querySelector(".tabs").hidden = true;
    $("demo-box").hidden = true;
    $("social").hidden = true;
    $("signed-in").hidden = false;
    $("page-title").textContent = "내 계정";
    $("signed-in-text").textContent =
      `${me.name}님(${me.role === "veteran" ? "베테랑" : "청년 창업가"})으로 로그인되어 있어요.\n보유 포인트 ${Number(me.points).toLocaleString("ko-KR")}P`;
  } catch {
    // 서버 연결 실패 시 로그인 폼을 그대로 보여준다
  }
})();
