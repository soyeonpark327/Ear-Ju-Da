// 카카오 로그인 (Supabase Edge Function)
// Supabase 기본 카카오 로그인은 이메일(account_email)을 반드시 요청하는데,
// 이메일 동의항목은 비즈 앱에서만 켤 수 있어 KOE205 에러가 난다.
// 그래서 닉네임·프로필 사진만 요청하도록 직접 OAuth 흐름을 처리한다. (naver-login과 같은 구조)
//
//   GET /kakao-login/status              → { enabled } 카카오 키가 설정됐는지 (로그인 버튼 활성화용)
//   GET /kakao-login?redirect=<로그인 화면 주소>  → 카카오 로그인 화면으로 이동
//   GET /kakao-login/callback            → 카카오가 돌려보내는 곳. 계정을 만들거나 찾고
//                                           <로그인 화면>#kakao_token_hash=... 로 돌려보낸다
//   프론트는 token_hash로 supabase.auth.verifyOtp()를 호출해 로그인을 마친다.
//
// 필요한 Secrets: KAKAO_REST_API_KEY, KAKAO_CLIENT_SECRET
//   (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY는 Supabase가 자동으로 넣어준다)
// 선택 Secrets: ALLOWED_ORIGINS  돌아갈 수 있는 사이트 (쉼표로 구분)
//
// 배포할 때 "Verify JWT"는 꺼야 한다. (브라우저가 바로 이 주소로 이동하기 때문)

import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const DEFAULT_ORIGINS = "https://earjuda.vercel.app,http://127.0.0.1:5500,http://localhost:5500";
const STATE_MAX_AGE_MS = 10 * 60 * 1000;
const NONCE_COOKIE = "kakao_nonce";

const env = (key: string) => Deno.env.get(key) ?? "";
const allowedOrigins = () =>
  (env("ALLOWED_ORIGINS") || DEFAULT_ORIGINS).split(",").map((s) => s.trim()).filter(Boolean);

// ---------- 도우미 ----------
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));

async function hmac(data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env("KAKAO_CLIENT_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data))));
}

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// 허용한 사이트 주소인지 (토큰이 다른 사이트로 새지 않게)
function safeRedirect(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return allowedOrigins().includes(url.origin) ? url.href.split("#")[0] : null;
  } catch {
    return null;
  }
}

const text = (body: string, status = 400) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
const redirect = (location: string, extraHeaders: Record<string, string> = {}) =>
  new Response(null, { status: 302, headers: { Location: location, ...extraHeaders } });
const backWith = (to: string, params: Record<string, string>) =>
  redirect(`${to}#${new URLSearchParams(params)}`, {
    "Set-Cookie": `${NONCE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
  });

function readCookie(req: Request, name: string) {
  const match = (req.headers.get("Cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

const CALLBACK = () => `${env("SUPABASE_URL")}/functions/v1/kakao-login/callback`; // 카카오 콘솔에 등록한 Redirect URI

// ---------- 1. 시작: 카카오 로그인 화면으로 ----------
async function start(url: URL) {
  const to = safeRedirect(url.searchParams.get("redirect"));
  if (!to) return text("허용되지 않은 돌아갈 주소입니다.");

  const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ n: nonce, r: to, t: Date.now() })));
  const state = `${payload}.${await hmac(payload)}`;

  const kakao = new URL("https://kauth.kakao.com/oauth/authorize");
  kakao.search = new URLSearchParams({
    response_type: "code",
    client_id: env("KAKAO_REST_API_KEY"),
    redirect_uri: CALLBACK(),
    scope: "profile_nickname,profile_image", // 이메일은 요청하지 않는다
    state,
  }).toString();

  return redirect(kakao.href, {
    "Set-Cookie": `${NONCE_COOKIE}=${nonce}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
  });
}

// ---------- 2. 콜백: 계정 만들기/찾기 → 로그인 토큰 ----------
async function callback(req: Request, url: URL) {
  const state = url.searchParams.get("state") ?? "";
  const [payload, sig] = state.split(".");
  if (!payload || !sig || sig !== (await hmac(payload))) return text("잘못된 로그인 요청입니다. 다시 시도해주세요.");

  let data: { n: string; r: string; t: number };
  try {
    data = JSON.parse(fromB64url(payload));
  } catch {
    return text("잘못된 로그인 요청입니다. 다시 시도해주세요.");
  }
  const to = safeRedirect(data.r);
  if (!to) return text("허용되지 않은 돌아갈 주소입니다.");
  if (Date.now() - data.t > STATE_MAX_AGE_MS) return backWith(to, { kakao_error: "로그인 시간이 지났어요. 다시 시도해주세요." });
  if (readCookie(req, NONCE_COOKIE) !== data.n) return backWith(to, { kakao_error: "로그인 요청을 확인하지 못했어요. 다시 시도해주세요." });

  if (url.searchParams.get("error")) return backWith(to, { kakao_error: "카카오 로그인을 취소했어요." });
  const code = url.searchParams.get("code");
  if (!code) return backWith(to, { kakao_error: "카카오 로그인에 실패했어요." });

  try {
    // 카카오 access token
    const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: env("KAKAO_REST_API_KEY"),
        client_secret: env("KAKAO_CLIENT_SECRET"),
        redirect_uri: CALLBACK(),
        code,
      }),
    });
    const token = await tokenRes.json();
    if (!token.access_token) throw new Error(`token: ${token.error_description ?? token.error ?? tokenRes.status}`);

    // 카카오 프로필 (닉네임·프로필 사진)
    const meRes = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const me = await meRes.json();
    if (!me.id) throw new Error(`profile: ${me.msg ?? meRes.status}`);
    const profile = me.kakao_account?.profile ?? {};
    const nickname = profile.nickname || me.properties?.nickname || "";
    const image = profile.is_default_image ? "" : profile.profile_image_url || me.properties?.profile_image || "";

    // 카카오 계정 전용 내부 주소 (카카오 고유번호로 만든다)
    const email = `kakao_${(await sha256Hex(String(me.id))).slice(0, 32)}@kakao.invalid`;
    const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        provider: "kakao",
        name: nickname,
        nickname,
        avatar_url: image,
      },
    });
    if (created.error && !/already|exists|registered/i.test(created.error.message)) throw created.error;

    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error || !link.data?.properties?.hashed_token) throw link.error ?? new Error("generateLink failed");

    return backWith(to, { kakao_token_hash: link.data.properties.hashed_token });
  } catch (err) {
    console.error("kakao-login callback error:", err);
    return backWith(to, { kakao_error: "카카오 로그인 중 문제가 생겼어요. 잠시 후 다시 시도해주세요." });
  }
}

// ---------- 라우팅 ----------
export async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname.endsWith("/status")) {
    return new Response(JSON.stringify({ enabled: Boolean(env("KAKAO_REST_API_KEY") && env("KAKAO_CLIENT_SECRET")) }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
  if (!env("KAKAO_REST_API_KEY") || !env("KAKAO_CLIENT_SECRET")) return text("카카오 로그인이 아직 설정되지 않았습니다.", 503);
  if (req.method !== "GET") return text("Method Not Allowed", 405);
  if (url.pathname.endsWith("/callback")) return callback(req, url);
  return start(url);
}

if (import.meta.main) Deno.serve(handler);
