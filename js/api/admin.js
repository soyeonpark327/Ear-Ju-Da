// 관리자: 베테랑 경력 인증 승인·반려 (관리자 계정만 동작, 아니면 '관리자만 …'으로 throw)
import { supabase } from '../supabase.js';
import { unwrap } from './_utils.js';
import { getMyProfile } from './auth.js';

/** 지금 로그인한 사람이 관리자인가 */
export async function isAdmin() {
  return (await getMyProfile())?.is_admin === true;
}

/**
 * 관리자 첫 화면 숫자
 * @returns {Promise<{ users, youth, veterans, experts_pending, experts_approved, bookings_upcoming, bookings_completed, bookings_no_show, notes_published, note_sales }>}
 */
export async function getAdminStats() {
  return unwrap(await supabase.rpc('admin_stats'));
}

/**
 * 심사할 베테랑 목록 (승인 대기가 먼저)
 * @param {'pending' | 'approved' | 'rejected' | null} [status] null이면 전체
 * @returns {Promise<Array<{ id, name, email, headline, industry, career_years, career_summary, keywords, price_points, verification, rejection_reason, certificate_path, created_at, reviewed_at }>>}
 */
export async function getExpertsForReview(status = 'pending') {
  return unwrap(await supabase.rpc('admin_list_experts', { p_status: status }));
}

/**
 * 경력 인증 승인·반려. 베테랑에게 알림이 간다.
 * @param {string} expertId
 * @param {'approved' | 'rejected' | 'pending'} status
 * @param {string} [reason] 반려 사유 (반려할 때 필수, 베테랑 화면·알림에 그대로 보임)
 */
export async function setVerification(expertId, status, reason = null) {
  unwrap(await supabase.rpc('admin_set_verification', { p_expert_id: expertId, p_status: status, p_reason: reason }));
}

/** 증명서를 잠깐 볼 수 있는 링크 (1분 유효) */
export async function getCertificateUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from('certificates').createSignedUrl(path, 60);
  if (error) throw new Error('증명서를 불러오지 못했어요.');
  return data.signedUrl;
}

/** 신고 목록 (status: 'open' 기본 / 'resolved' / 'dismissed' / null 전체) */
export async function getReports(status = 'open') {
  return unwrap(await supabase.rpc('admin_list_reports', { p_status: status }));
}
/** 신고 처리: 'resolved'(조치함) / 'dismissed'(문제없음) */
export async function resolveReport(id, status, note = null) {
  unwrap(await supabase.rpc('admin_resolve_report', { p_id: id, p_status: status, p_note: note }));
}
