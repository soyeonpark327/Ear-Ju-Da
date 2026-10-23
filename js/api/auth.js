// 회원가입, 로그인, 내 프로필
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase.js';
import { unwrap } from './_utils.js';

// ---------- 이메일 또는 전화번호 ----------
// 전화번호 로그인은 문자 인증 없이, 번호를 내부용 주소(01012345678@phone.invalid)로 바꿔 이메일처럼 쓴다.
// .invalid는 실제로 존재할 수 없는 도메인이라 메일이 나가지 않는다.
const PHONE_DOMAIN = 'phone.invalid';

/** '010-1234-5678' → '01012345678'. 휴대폰 번호 형식이 아니면 null */
export function normalizePhone(value) {
  const digits = String(value ?? '').replace(/[\s-]/g, '').replace(/^\+?82/, '0');
  return /^01[016789]\d{7,8}$/.test(digits) ? digits : null;
}

/** 입력값이 이메일이면 그대로, 휴대폰 번호면 내부용 주소로 바꾼다. 둘 다 아니면 throw */
function toAuthEmail(id) {
  const value = String(id ?? '').trim();
  if (value.includes('@')) return value;
  const phone = normalizePhone(value);
  if (!phone) throw new Error('이메일 또는 휴대폰 번호(010-1234-5678)를 정확히 입력해주세요.');
  return `${phone}@${PHONE_DOMAIN}`;
}

/**
 * 이메일 또는 휴대폰 번호로 회원가입
 * @param {{ id: string, password: string, name: string, role: 'youth' | 'veteran' }} params  id: 이메일 또는 휴대폰 번호
 */
export async function signUpWithId({ id, password, name, role }) {
  const phone = normalizePhone(id);
  return unwrap(await supabase.auth.signUp({
    email: toAuthEmail(id),
    password,
    options: { data: { name, role, ...(phone && !String(id).includes('@') ? { phone } : {}) } },
  }));
}

/** 이메일 또는 휴대폰 번호로 로그인 */
export async function signInWithId(id, password) {
  return unwrap(await supabase.auth.signInWithPassword({ email: toAuthEmail(id), password }));
}


// ---------- 소셜 로그인 ----------

/**
 * Supabase에서 켜져 있는 로그인 방식. 예) { email: true, google: false, kakao: true }
 * 대시보드 Authentication > Sign In / Providers 설정을 그대로 읽는다.
 */
export async function getAuthProviders() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } });
  if (!res.ok) throw new Error('로그인 설정을 불러오지 못했어요.');
  return (await res.json()).external ?? {};
}

/**
 * 구글·카카오 로그인. 해당 서비스 로그인 화면으로 이동했다가 redirectTo 주소로 돌아온다.
 * @param {'google' | 'kakao'} provider
 * @param {string} redirectTo 돌아올 주소 (Supabase Redirect URLs에 등록돼 있어야 함)
 */
export async function signInWithSocial(provider, redirectTo) {
  unwrap(await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } }));
}

// ---------- 네이버·카카오 로그인 (Edge Function: supabase/functions/naver-login, kakao-login) ----------
// 카카오는 Supabase 기본 로그인이 이메일을 요구해(KOE205) 네이버처럼 직접 처리한다.
const LOGIN_FN = { naver: 'naver-login', kakao: 'kakao-login' };
const fnUrl = (provider) => `${SUPABASE_URL}/functions/v1/${LOGIN_FN[provider]}`;

/**
 * 네이버·카카오 로그인을 쓸 수 있는지 (Edge Function 배포 + 키 설정 완료)
 * @param {'naver' | 'kakao'} provider
 */
export async function isFunctionLoginEnabled(provider) {
  try {
    const res = await fetch(`${fnUrl(provider)}/status`);
    return res.ok && (await res.json()).enabled === true;
  } catch {
    return false;
  }
}

/**
 * 네이버·카카오 로그인 화면으로 이동. 로그인 후 redirectTo#naver_token_hash=... (카카오는 kakao_token_hash) 로 돌아온다.
 * @param {'naver' | 'kakao'} provider
 */
export function signInWithFunction(provider, redirectTo) {
  location.href = `${fnUrl(provider)}?redirect=${encodeURIComponent(redirectTo)}`;
}

/** 네이버·카카오에서 돌아온 token_hash로 로그인을 마친다 */
export async function completeFunctionLogin(tokenHash) {
  return unwrap(await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' }));
}

/**
 * 회원가입. 가입하면 profiles 행이 자동으로 만들어진다.
 * @param {{ email: string, password: string, name: string, role: 'youth' | 'veteran' }} params
 */
export async function signUp({ email, password, name, role }) {
  return unwrap(await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, role } },
  }));
}

export async function signIn(email, password) {
  return unwrap(await supabase.auth.signInWithPassword({ email, password }));
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

/**
 * 회원 탈퇴 (되돌릴 수 없음). 진행 중인 상담이 있으면 '진행 중인 상담이 있어요…'로 throw
 * 활동 기록이 없으면 계정을 완전히 지우고, 상담·후기·판매 기록이 있으면 이름을 '탈퇴한 회원'으로 바꿔 익명 처리한다.
 * 남은 포인트는 소멸. 끝나면 로그아웃된다.
 * @returns {Promise<'deleted' | 'anonymized'>}
 */
export async function deleteMyAccount() {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');
  // 탈퇴할 수 없는 상태면 파일을 지우기 전에 멈춘다 (DB 함수도 한 번 더 확인함)
  const { count } = await supabase.from('bookings').select('id', { count: 'exact', head: true })
    .eq('status', 'confirmed').or(`youth_id.eq.${user.id},expert_id.eq.${user.id}`);
  if (count > 0) throw new Error('진행 중인 상담이 있어요. 예약을 취소하거나 상담을 마친 뒤 탈퇴해 주세요.');
  // 경력 증명서 파일 삭제 (베테랑, 본인 폴더)
  const { data: files } = await supabase.storage.from('certificates').list(user.id);
  if (files?.length) await supabase.storage.from('certificates').remove(files.map((f) => `${user.id}/${f.name}`));
  const result = unwrap(await supabase.rpc('delete_my_account'));
  await supabase.auth.signOut({ scope: 'local' });
  return result;
}

/**
 * 역할 선택 (구글·카카오·네이버 가입자만, 한 번만). getMyProfile()의 role_confirmed가 false일 때 사용
 * @param {'youth' | 'veteran'} role
 */
export async function chooseMyRole(role) {
  unwrap(await supabase.rpc('choose_my_role', { p_role: role }));
}

/** 로그인한 사용자 (없으면 null) */
export async function getCurrentUser() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

/** 내 프로필 { id, role, name, avatar_url, senior_mode, points } (로그인 안 했으면 null) */
export async function getMyProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  return unwrap(await supabase.from('profiles').select('*').eq('id', user.id).single());
}

/**
 * 내 프로필 수정. 바꿀 값만 넘긴다. (포인트·역할은 수정 불가)
 * @param {{ name?: string, avatar_url?: string, senior_mode?: boolean }} changes
 */
export async function updateMyProfile(changes) {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');
  return unwrap(await supabase.from('profiles').update(changes).eq('id', user.id).select().single());
}

/**
 * 로그인/로그아웃이 일어날 때마다 callback(user)를 부른다. (헤더 버튼 바꿀 때 사용)
 * @returns {() => void} 구독 해제 함수
 */
export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}
