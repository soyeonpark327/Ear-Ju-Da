// 1:1 실시간 채팅
import { supabase } from '../supabase.js';
import { unwrap } from './_utils.js';
import { getCurrentUser } from './auth.js';

/** 지난 메시지 전체 (오래된 순) [{ id, booking_id, sender_id, content, created_at }] */
export async function getMessages(bookingId) {
  return unwrap(await supabase
    .from('messages')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at'));
}

/** 메시지 전송 (진행 중인 예약의 당사자만) */
export async function sendMessage(bookingId, content) {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');
  return unwrap(await supabase
    .from('messages')
    .insert({ booking_id: bookingId, sender_id: user.id, content })
    .select()
    .single());
}

/**
 * 새 메시지가 올 때마다 onMessage(message)를 부른다. 내가 보낸 메시지도 온다.
 * @returns {() => void} 구독 해제 함수 (채팅방 나갈 때 호출)
 *
 * 예)
 *   const unsubscribe = subscribeMessages(bookingId, (msg) => renderMessage(msg));
 */
export function subscribeMessages(bookingId, onMessage) {
  const channel = supabase
    .channel(`messages:${bookingId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `booking_id=eq.${bookingId}` },
      (payload) => onMessage(payload.new),
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
