// 포인트 충전(데모)과 포인트 내역
import { supabase } from '../supabase.js';
import { unwrap } from './_utils.js';
import { getCurrentUser } from './auth.js';

/** 충전 선택지 (실제 결제 없는 데모 충전, 하루 최대 50,000P) */
export const CHARGE_OPTIONS = [5000, 10000, 30000];

/** 내역 종류 → 화면 문구 */
export const POINT_TYPE_LABELS = {
  opening_balance: '기존 잔액',
  signup_bonus: '가입 보너스',
  bonus: '이벤트 보너스',
  charge: '포인트 충전',
  booking_hold: '상담 예약 (보관)',
  booking_refund: '상담 환불',
  booking_payout: '상담 수익',
  note_purchase: '오답노트 구매',
  note_sale: '오답노트 판매 수익',
  adjust: '포인트 조정',
};

/**
 * 데모 충전. 실제 결제는 없다. 5,000 / 10,000 / 30,000P, 하루 최대 50,000P
 * @param {5000 | 10000 | 30000} amount
 * @returns {Promise<number>} 충전 후 잔액. 한도 초과 등은 '하루에 50,000P까지…' 메시지로 throw
 */
export async function chargePoints(amount) {
  return unwrap(await supabase.rpc('charge_points', { p_amount: amount }));
}

/**
 * 내 포인트 내역 (최신순)
 * @param {{ limit?: number }} [options]
 * @returns {Promise<Array<{ id, amount, balance_after, type, label, ref: { booking_id?, note_id? }, created_at }>>}
 *   amount: +적립 / -사용, label: 화면에 보여줄 문구 (예: '상담 수익')
 */
export async function getPointHistory({ limit = 50 } = {}) {
  const user = await getCurrentUser();
  if (!user) return [];
  const rows = unwrap(await supabase
    .from('point_transactions')
    .select('id, amount, balance_after, type, ref, created_at')
    .eq('user_id', user.id)
    .order('id', { ascending: false })
    .limit(limit));
  return rows.map((r) => ({ ...r, label: POINT_TYPE_LABELS[r.type] ?? r.type }));
}
