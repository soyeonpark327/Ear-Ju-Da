# js/api 사용법

프론트에서는 Supabase를 직접 부르지 말고 여기 있는 함수만 쓰세요.

## 기본 사용법

HTML에서 스크립트를 **`type="module"`**로 불러와야 `import`가 됩니다.

```html
<!-- pages/experts.html -->
<script type="module" src="../js/pages/experts.js"></script>
```

```js
// js/pages/experts.js
import { getExperts } from '../api/experts.js';

const experts = await getExperts({ keyword: '납품계약' });
experts.forEach((e) => {
  // e.name, e.headline, e.career_years, e.rating ...
});
```

## 에러 처리

모든 함수는 실패하면 **사람이 읽을 수 있는 메시지로 에러를 throw**합니다. `try / catch`로 감싸서 `alert`이나 화면에 그대로 보여주면 됩니다.

```js
import { purchaseNote } from '../api/notes.js';

try {
  await purchaseNote(noteId);
  alert('구매 완료!');
} catch (e) {
  alert(e.message); // 예) '포인트가 부족합니다.'
}
```

조회 함수는 데이터가 없으면 에러 대신 **빈 배열 `[]`** 또는 **`null`**을 돌려줍니다.

---

## auth.js: 회원

| 함수 | 설명 | 돌려주는 값 |
| --- | --- | --- |
| `signUp({ email, password, name, role })` | 회원가입. `role`은 `'youth'` 또는 `'veteran'` | |
| `signIn(email, password)` | 로그인 | |
| `signOut()` | 로그아웃 | |
| `getCurrentUser()` | 로그인한 사용자 | `user` 또는 `null` |
| `getMyProfile()` | 내 프로필 | `{ id, role, name, avatar_url, senior_mode, points }` 또는 `null` |
| `updateMyProfile({ name, avatar_url, senior_mode })` | 내 프로필 수정 (바꿀 값만) | 수정된 프로필 |
| `onAuthChange((user) => {})` | 로그인/로그아웃될 때마다 호출 | 구독 해제 함수 |

```js
// 헤더: 로그인 여부에 따라 버튼 바꾸기
onAuthChange((user) => {
  loginBtn.hidden = !!user;
  logoutBtn.hidden = !user;
});

// 시니어 모드 적용
const me = await getMyProfile();
if (me?.senior_mode) document.documentElement.classList.add('senior-mode');
```

## experts.js: 베테랑

| 함수 | 설명 | 돌려주는 값 |
| --- | --- | --- |
| `getExperts({ keyword, industry })` | 승인된 베테랑 목록 (평점순). 둘 다 생략 가능. `keyword`는 이름·소개·업종·경력·키워드 **부분 검색** (`'계약'`, `'이정훈'`, `'#제조공정 #납품계약'`), 띄어쓰기로 여러 단어면 모두 포함된 것만 | `[{ id, name, avatar_url, headline, industry, career_years, keywords, price_points, rating, review_count, completed_count, trust_grade, trust_label, badges }]` (아래 신뢰 등급 참고) |
| `getExpert(id)` | 베테랑 상세 | 위 정보 + `career_summary`, 없으면 `null` |
| `getSlots(expertId)` | 예약 가능한 시간 | `[{ id, start_at, end_at }]` |
| `getTips(expertId)` | 한 줄 조언 | `[{ id, content, created_at }]` |

**신뢰 등급 · 뱃지** (`getExperts`, `getExpert` 결과에 포함)

| 필드 | 값 |
| --- | --- |
| `trust_grade` | `'gold'` / `'silver'` / `'bronze'` (CSS 클래스 `trust trust-gold` 등으로 사용) |
| `trust_label` | `'최고 신뢰'` / `'신뢰 베테랑'` / `'경력 인증'` |
| `badges` | 칩으로 보여줄 목록. 예) `['경력 인증', '30년+ 경력', '평점 최상위', '상담 2회']` |
| `completed_count` | 완료한 상담 수 |

등급 기준: **gold** 경력 25년↑ + 완료 상담 2회↑ + 평점 4.5↑ / **silver** 경력 20년↑ + 완료 상담 1회↑ + 평점 4.0↑ / **bronze** 관리자 승인(경력 인증) 완료

**베테랑 본인용**

| 함수 | 설명 |
| --- | --- |
| `getMyExpert()` | 내 전문가 정보. `verification`이 `'pending'`이면 승인 대기 중 |
| `registerExpert({ headline, industry, career_years, career_summary, keywords, price_points })` | 전문가 정보 처음 작성 |
| `updateMyExpert(changes)` | 전문가 정보 수정 |
| `getMySlots()` | 내가 연 시간 전체 (`is_booked` 포함) |
| `addSlot(startAt, endAt)` | 상담 가능 시간 추가 (`Date` 또는 `'2026-11-01T14:00'`) |
| `deleteSlot(slotId)` | 시간 삭제 (예약된 시간은 불가) |
| `addTip(content)` / `deleteTip(tipId)` | 한 줄 조언 작성 / 삭제 |

## notes.js: 오답 노트

| 함수 | 설명 | 돌려주는 값 |
| --- | --- | --- |
| `getNotes({ keyword, industry })` | 공개된 노트 목록 (최신순). `keyword`는 제목·미리보기·업종 부분 검색 + 키워드 일치 | `[{ id, title, summary, industry, keywords, price_points, created_at, author: { headline, profiles: { name } } }]` |
| `getNote(noteId)` | 노트 하나 (미리보기) | 위와 같은 형태, 없으면 `null` |
| `getNoteBody(noteId)` | 유료 본문 | 구매했으면 문자열, 아니면 `null` |
| `purchaseNote(noteId)` | 구매 (포인트 차감) | |
| `getMyPurchasedNotes()` | 내가 산 노트 | 노트 목록 + `purchased_at` |

```js
// 노트 상세 화면
const note = await getNote(id);
const body = await getNoteBody(id);
if (body) showBody(body);           // 구매함 → 본문 보여주기
else showBuyButton(note.price_points); // 구매 안 함 → 구매 버튼
```

**베테랑 본인용**: `getMyNotes()`, `createNote({ title, summary, industry, keywords, price_points, is_published, body })`, `updateNote(noteId, changes)`, `deleteNote(noteId)`

## bookings.js: 예약 · 보고서 · 후기

| 함수 | 설명 | 돌려주는 값 |
| --- | --- | --- |
| `createBooking(slotId, topic)` | 예약 (포인트 차감 후 보관) | 예약 id |
| `getMyBookings()` | 내 예약 목록 (청년·베테랑 모두) | 아래 형태의 배열 |
| `getBooking(bookingId)` | 예약 하나 | 아래 형태, 당사자가 아니면 `null` |
| `completeBooking(bookingId)` | 상담 완료 (청년만). 베테랑에게 포인트 지급 | |
| `cancelBooking(bookingId)` | 예약 취소 (시작 전만). 포인트 환불 | |
| `getReport(bookingId)` | AI 보고서 | `{ summary, checklist: [], risks: [] }` 또는 `null` |
| `getReviews(expertId)` | 후기 목록 | `[{ id, rating, content, created_at, youth: { name } }]` |
| `addReview(bookingId, rating, content)` | 후기 작성 (완료된 상담만, 1~5점) | |

예약 객체 형태:
```js
{
  id, topic, price_points, created_at,
  status,        // 'confirmed'(진행 중) | 'completed'(완료) | 'cancelled'(취소)
  youth_id, expert_id,
  slot:   { start_at, end_at },
  youth:  { name },
  expert: { headline, profiles: { name } }
}
```

## chat.js: 실시간 채팅

| 함수 | 설명 |
| --- | --- |
| `getMessages(bookingId)` | 지난 메시지 (오래된 순) `[{ id, sender_id, content, created_at }]` |
| `sendMessage(bookingId, content)` | 메시지 보내기 (`status`가 `'confirmed'`인 예약만) |
| `subscribeMessages(bookingId, (msg) => {})` | 새 메시지가 올 때마다 호출. 구독 해제 함수를 돌려줌 |

```js
const me = await getCurrentUser();
(await getMessages(bookingId)).forEach(render);

// 내가 보낸 메시지도 구독으로 들어오니까, 보낼 때 따로 render하지 않아도 됩니다.
const unsubscribe = subscribeMessages(bookingId, render);
sendBtn.onclick = () => sendMessage(bookingId, input.value);

function render(msg) {
  const mine = msg.sender_id === me.id; // 내 메시지면 오른쪽에
  // ...
}
```

## 날짜 표시

시간 값(`start_at`, `created_at` 등)은 `'2026-11-01T05:00:00+00:00'` 같은 문자열입니다. 화면에 보여줄 때:

```js
new Date(slot.start_at).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
// → '2026. 11. 1. 오후 2:00'
```
