// 오답 노트
import { supabase } from '../supabase.js';
import { unwrap, cleanKeyword } from './_utils.js';
import { getCurrentUser } from './auth.js';

// 노트와 함께 작성자 이름·소개를 가져온다. 결과: note.author = { headline, profiles: { name } }
const NOTE_WITH_AUTHOR = '*, author:experts(headline, profiles(name))';

/**
 * 공개된 노트 목록 (최신순). 본문(body)은 포함되지 않는다.
 * @param {{ keyword?: string, industry?: string }} [filter]
 */
export async function getNotes({ keyword, industry } = {}) {
  let query = supabase.from('notes').select(NOTE_WITH_AUTHOR).eq('is_published', true);
  const kw = cleanKeyword(keyword);
  if (kw) query = query.or(`keywords.cs.{${kw}},title.ilike.*${kw}*`);
  if (industry) query = query.eq('industry', industry);
  return unwrap(await query.order('created_at', { ascending: false }));
}

/** 노트 하나 (미리보기 정보만). 없으면 null */
export async function getNote(noteId) {
  return unwrap(await supabase.from('notes').select(NOTE_WITH_AUTHOR).eq('id', noteId).maybeSingle());
}

/** 유료 본문. 구매했거나 작성자일 때만 문자열, 아니면 null */
export async function getNoteBody(noteId) {
  const row = unwrap(await supabase.from('note_contents').select('body').eq('note_id', noteId).maybeSingle());
  return row?.body ?? null;
}

/** 노트 구매 (포인트 차감). 실패하면 '포인트가 부족합니다.' 같은 메시지로 throw */
export async function purchaseNote(noteId) {
  unwrap(await supabase.rpc('purchase_note', { p_note_id: noteId }));
}

/** 내가 구매한 노트 목록 */
export async function getMyPurchasedNotes() {
  const user = await getCurrentUser();
  if (!user) return [];
  const rows = unwrap(await supabase
    .from('note_purchases')
    .select(`created_at, note:notes(${NOTE_WITH_AUTHOR})`)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }));
  return rows.map((r) => ({ ...r.note, purchased_at: r.created_at }));
}


// ---------- 베테랑 본인 ----------

/** 내가 쓴 노트 (비공개 포함) */
export async function getMyNotes() {
  const user = await getCurrentUser();
  if (!user) return [];
  return unwrap(await supabase
    .from('notes')
    .select('*')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false }));
}

/**
 * 노트 작성
 * @param {{ title: string, summary: string, industry: string, keywords?: string[], price_points?: number, is_published?: boolean, body: string }} note
 * @returns 만들어진 노트 (본문 제외)
 */
export async function createNote({ body, ...info }) {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');
  const note = unwrap(await supabase.from('notes').insert({ ...info, author_id: user.id }).select().single());
  const { error } = await supabase.from('note_contents').insert({ note_id: note.id, body });
  if (error) {
    await supabase.from('notes').delete().eq('id', note.id); // 본문 저장 실패 시 노트도 지운다
    throw new Error(error.message);
  }
  return note;
}

/** 노트 수정. 바꿀 값만 넘긴다. body를 넘기면 본문도 수정 */
export async function updateNote(noteId, { body, ...changes }) {
  if (Object.keys(changes).length > 0) {
    unwrap(await supabase.from('notes').update(changes).eq('id', noteId));
  }
  if (body !== undefined) {
    unwrap(await supabase.from('note_contents').update({ body }).eq('note_id', noteId));
  }
}

export async function deleteNote(noteId) {
  unwrap(await supabase.from('notes').delete().eq('id', noteId));
}
