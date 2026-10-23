// AI 기능 (Edge Function: supabase/functions/ai-match)
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase.js';
import { getExperts } from './experts.js';

/**
 * 고민 문장으로 맞는 베테랑 추천 (Gemini)
 * @param {string} concern 고민 내용 (최대 1000자)
 * @returns {Promise<{ summary: string, keywords: string[], matches: Array<{ expert_id, reason, name, headline, avatar_url, trust_label }> }>}
 *   matches는 잘 맞는 순서, 최대 3명. 맞는 사람이 없으면 빈 배열.
 *   실패하면 '...잠시 후 다시 시도해주세요.' 같은 메시지로 throw
 */
export async function aiMatch(concern) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ concern }),
    signal: AbortSignal.timeout(30_000), // 오래 걸리면 포기하고 키워드 매칭으로
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'AI 매칭에 실패했어요.');

  // 화면에 바로 쓸 수 있게 이름·소개 등을 붙인다
  const cards = new Map((await getExperts()).map((e) => [e.id, e]));
  data.matches = data.matches
    .filter((m) => cards.has(m.expert_id))
    .map((m) => {
      const e = cards.get(m.expert_id);
      return { ...m, name: e.name, headline: e.headline, avatar_url: e.avatar_url, trust_label: e.trust_label };
    });
  return data;
}
