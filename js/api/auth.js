// 회원가입, 로그인, 내 프로필
import { supabase } from '../supabase.js';
import { unwrap } from './_utils.js';

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
