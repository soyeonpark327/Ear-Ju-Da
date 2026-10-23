// 알림함 (DB가 자동으로 만든 알림을 읽고 "읽음" 처리)
import { supabase } from '../supabase.js';
import { unwrap } from './_utils.js';
import { getCurrentUser } from './auth.js';

/**
 * 내 알림 목록 (최신순)
 * @param {{ limit?: number, unreadOnly?: boolean }} [options]
 * @returns {Promise<Array<{ id, type, title, body, data: { booking_id?, note_id? }, read_at, created_at }>>}
 *   type: booking_new | booking_confirmed | booking_reminder | booking_cancelled | booking_rescheduled | booking_completed
 *         | booking_no_show | report_ready | note_sold | review_new | verification_changed
 */
export async function getNotifications({ limit = 30, unreadOnly = false } = {}) {
  const user = await getCurrentUser();
  if (!user) return [];
  let query = supabase
    .from('notifications')
    .select('id, type, title, body, data, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (unreadOnly) query = query.is('read_at', null);
  return unwrap(await query);
}

/** 안 읽은 알림 수 (알림 버튼 빨간 점·숫자) */
export async function getUnreadCount() {
  const user = await getCurrentUser();
  if (!user) return 0;
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** 알림 하나 읽음 처리 */
export async function markNotificationRead(id) {
  unwrap(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null));
}

/** 내 알림 모두 읽음 처리 */
export async function markAllNotificationsRead() {
  const user = await getCurrentUser();
  if (!user) return;
  unwrap(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null));
}

/**
 * 새 알림이 생길 때마다 onNotification(알림)을 부른다.
 * @returns {Promise<() => void>} 구독 해제 함수
 */
export async function subscribeNotifications(onNotification) {
  const user = await getCurrentUser();
  if (!user) return () => {};
  const channel = supabase
    .channel(`notifications:${user.id}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
      (payload) => onNotification(payload.new),
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
