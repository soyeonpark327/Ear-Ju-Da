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

// 채팅을 보낼 수 있는 시간: 상담 시작 10분 전 ~ 종료 30분 후 (DB 정책과 같은 값)
const OPEN_BEFORE_MIN = 10;
const CLOSE_AFTER_MIN = 30;

/**
 * 채팅방 상태 계산 (화면 안내용). 실제로 막는 건 DB 정책이다.
 * @param {{ status: string, slot: { start_at: string, end_at: string } }} booking getBooking()/getMyBookings() 결과
 * @returns {{ state: 'before' | 'open' | 'closed', opensAt: Date, closesAt: Date, message: string }}
 *   before: 아직 열리기 전 / open: 보낼 수 있음 / closed: 끝났거나 취소·완료된 상담 (읽기만 가능)
 */
export function getChatWindow(booking, now = new Date()) {
  const opensAt = new Date(new Date(booking.slot.start_at).getTime() - OPEN_BEFORE_MIN * 60_000);
  const closesAt = new Date(new Date(booking.slot.end_at).getTime() + CLOSE_AFTER_MIN * 60_000);
  const time = (d) => d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  if (booking.status !== 'confirmed') {
    const closedMessage = {
      completed: '완료된 상담이에요. 대화는 계속 볼 수 있어요.',
      cancelled: '취소된 상담이에요.',
      no_show: '참여하지 않은 쪽이 있어 종료된 상담이에요.',
    };
    return { state: 'closed', opensAt, closesAt, message: closedMessage[booking.status] ?? '종료된 상담이에요.' };
  }
  if (now < opensAt) return { state: 'before', opensAt, closesAt, message: `${time(opensAt)}부터 채팅할 수 있어요.` };
  if (now > closesAt) return { state: 'closed', opensAt, closesAt, message: '상담 시간이 끝났어요. 대화는 계속 볼 수 있어요.' };
  return { state: 'open', opensAt, closesAt, message: `${time(closesAt)}까지 채팅할 수 있어요.` };
}

/** 메시지 전송 (진행 중인 예약의 당사자만, 상담 시작 10분 전 ~ 종료 30분 후) */
export async function sendMessage(bookingId, content) {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');
  const { data, error } = await supabase
    .from('messages')
    .insert({ booking_id: bookingId, sender_id: user.id, content })
    .select()
    .single();
  // RLS에 막힌 경우: 상담 시간이 아니거나 진행 중인 상담이 아님
  if (error?.code === '42501') throw new Error('지금은 메시지를 보낼 수 없어요. 상담 시작 10분 전부터 종료 30분 후까지 보낼 수 있어요.');
  return unwrap({ data, error });
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
