// AI 기능 (Edge Function: supabase/functions/ai-match)
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase.js';
import { getExperts } from './experts.js';
import { getNotes } from './notes.js';

/** AI 매칭 결과를 결과·예약 화면에 넘길 때 쓰는 sessionStorage 키 */
export const AI_MATCH_KEY = 'ear-ju-da:ai-match';

/** 창업 단계 선택지 (filters.stage 값) */
export const STAGES = [
  { value: 'pre', label: '예비 창업' },
  { value: 'early', label: '1~3년 차' },
  { value: 'growth', label: '3년 차 이상' },
];

/** 상담 예산 선택지 (filters.max_price 값, 포인트) */
export const BUDGETS = [
  { value: 2000, label: '2,000P 이하' },
  { value: 3000, label: '3,000P 이하' },
  { value: 5000, label: '5,000P 이하' },
];

/**
 * 필터 칩에 쓸 선택지. 분야는 지금 승인된 베테랑들의 분야로 만든다.
 * @returns {Promise<{ industries: string[], stages: typeof STAGES, budgets: typeof BUDGETS }>}
 */
export async function getMatchFilterOptions() {
  const experts = await getExperts();
  const industries = [...new Set(experts.map((e) => e.industry))].sort((a, b) => a.localeCompare(b, 'ko'));
  return { industries, stages: STAGES, budgets: BUDGETS };
}

/**
 * 고민 문장으로 이어주다 맞춤 추천 (Gemini)
 * @param {string} concern 고민 내용 (최대 1000자)
 * @param {{ industry?: string, stage?: 'pre' | 'early' | 'growth', max_price?: number, available_soon?: boolean }} [filters]
 *   industry: 분야 / stage: 창업 단계 / max_price: 상담 1회 최대 포인트 / available_soon: 7일 안에 상담 가능한 베테랑만
 * @returns {Promise<{
 *   summary: string, keywords: string[],
 *   matches: Array<{ expert_id, reason, name, headline, avatar_url, industry, career_years, price_points, rating, trust_grade, trust_label }>,
 *   notes: Array<{ note_id, reason, title, summary, price_points, author_name }>,
 *   questions: string[],
 *   filtered_count: number
 * }>}
 *   matches 최대 3명(잘 맞는 순), notes 최대 2개, questions 3개.
 *   filtered_count가 0이면 필터에 맞는 베테랑이 없는 것 → 필터를 줄이라고 안내.
 *   실패하면 '...잠시 후 다시 시도해주세요.' 같은 메시지로 throw → 키워드 검색(getExperts)으로 대신 찾기
 */
export async function aiMatch(concern, filters = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ concern, filters }),
    signal: AbortSignal.timeout(40_000), // 오래 걸리면 포기하고 키워드 매칭으로
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'AI 매칭에 실패했어요.');

  // 화면에 바로 쓸 수 있게 베테랑·노트 정보를 붙인다
  const [experts, notes] = await Promise.all([getExperts(), data.notes?.length ? getNotes() : []]);
  const cards = new Map(experts.map((e) => [e.id, e]));
  const noteMap = new Map(notes.map((n) => [n.id, n]));
  data.matches = (data.matches ?? [])
    .filter((m) => cards.has(m.expert_id))
    .map((m) => {
      const e = cards.get(m.expert_id);
      return {
        ...m,
        name: e.name,
        headline: e.headline,
        avatar_url: e.avatar_url,
        industry: e.industry,
        career_years: e.career_years,
        price_points: e.price_points,
        rating: e.rating,
        trust_grade: e.trust_grade,
        trust_label: e.trust_label,
      };
    });
  data.notes = (data.notes ?? [])
    .filter((n) => noteMap.has(n.note_id))
    .map((n) => {
      const note = noteMap.get(n.note_id);
      return {
        ...n,
        title: note.title,
        summary: note.summary,
        price_points: note.price_points,
        author_name: note.author?.profiles?.name ?? '',
      };
    });
  data.questions = data.questions ?? [];
  return data;
}
