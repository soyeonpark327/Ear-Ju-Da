# 이어주다 (Ear-Ju-Da)

> 은퇴 베테랑의 실전 노하우를 청년 창업가에게 이어주는 세대 융합형 창업 조언 플랫폼
> 2026 소프트웨어 챌린지 · 미림마이스터고등학교

## 주요 기능

- **오답 노트 마켓플레이스**: 베테랑이 직접 쓴 실패 사례와 극복 과정을 유료로 열람
- **전문가 매칭**: 고민과 분야 키워드로 맞는 현장 베테랑 추천
- **상담 예약 + 1:1 실시간 채팅**: 베테랑이 열어둔 시간에 예약하면 그 시간에 채팅방이 열림
- **AI 전략 보고서**: 상담이 끝나면 핵심 조언, 체크리스트, 리스크를 정리한 보고서 발행
- **시니어 모드**: 큰 글씨와 단순한 버튼 위주의 UI

## 팀원

| 학번 | 이름 | 역할 | GitHub |
| --- | --- | --- | --- |
| 1108 | 박소연 | 백엔드 개발 | [@soyeonpark327](https://github.com/soyeonpark327) |
| 1111 | 오재인 | 프론트 개발 | [@cl6y8](https://github.com/cl6y8) |
| 1116 | 장예나 | 프론트 개발 | [@yena0208](https://github.com/yena0208) |
| 1618 | 최강은 | 기획 및 디자인 | [@chlgeun](https://github.com/chlgeun) |

## 기술 스택

- **Front-end**: HTML5, CSS3, JavaScript (ES Modules)
- **Back-end**: Supabase (PostgreSQL, Auth, Realtime, Edge Functions)
- **배포**: Vercel
- **도구**: VS Code, GitHub, GitHub Actions

## 폴더 구조

```
Ear-Ju-Da/
├── index.html          # 메인(랜딩) 페이지
├── pages/              # 화면별 HTML (login, experts, notes, chat ...)
├── css/
│   ├── reset.css       # 브라우저 기본 스타일 초기화
│   ├── variables.css   # 색상·폰트 변수 (시니어 모드 포함)
│   ├── common.css      # 공통 컴포넌트 스타일
│   └── pages/          # 화면별 CSS
├── js/
│   ├── supabase.js     # Supabase 연결 설정 (여기서만 연결 설정)
│   ├── api/            # Supabase 호출 함수 (백엔드 담당)
│   ├── pages/          # 화면 동작 스크립트 (프론트 담당)
│   └── utils/          # 공통 함수
├── assets/             # 이미지, 아이콘
└── supabase/
    ├── schema.sql      # 테이블 정의
    ├── policies.sql    # RLS 보안 정책
    ├── functions.sql   # 포인트가 오가는 동작 (노트 구매, 예약, 완료, 취소)
    ├── seed.sql        # 데모용 샘플 데이터
    ├── migrations/     # 운영 중인 DB에 순서대로 적용한 변경 (001~)
    └── functions/      # Edge Functions (AI 보고서 등)
```

**약속**: `js/pages/`에서는 Supabase를 직접 부르지 않고 `js/api/`의 함수만 호출합니다.

## 로컬에서 실행하기

ES Modules를 쓰기 때문에 HTML 파일을 더블클릭해서 열면 동작하지 않습니다. 로컬 서버로 열어야 합니다.

1. VS Code 확장 프로그램 **Live Server**를 설치합니다.
2. `index.html`을 우클릭하고 **Open with Live Server**를 누릅니다.

## DB 설치·변경

- **새로 설치**: SQL Editor에서 `schema.sql` → `policies.sql` → `functions.sql` → `migrations/007_certificates.sql`(Storage) → `migrations/009_notifications.sql`(알림함) → `migrations/010_points.sql`(포인트 내역) → `migrations/011_expert_dashboard.sql`(베테랑 대시보드) → `migrations/012_calendar.sql`(캘린더) → `migrations/013_reschedule.sql`(일정 변경) → `migrations/014_admin.sql`(관리자) → `seed.sql`
- **운영 중인 DB 변경**: `supabase/migrations/`의 새 번호 파일만 실행 (001~006, 008은 schema·policies·functions에 이미 반영됨)
- Edge Functions(`supabase/functions/`)는 대시보드에서 같은 이름으로 배포하고 **Verify JWT를 끈다**. 필요한 Secrets는 각 파일 맨 위 주석 참고

## 데모 계정

비밀번호는 모두 `demo1234!` 입니다. (`supabase/seed.sql`로 생성)

| 이메일 | 이름 | 역할 | 데모 포인트 |
| --- | --- | --- | --- |
| `kim@example.com` | 김대표 | 청년 (기획서 시나리오 주인공) | 노트 구매, 완료된 상담·보고서, 진행 중인 채팅 있음 |
| `park@example.com` | 박청년 | 청년 | |
| `lee@example.com` | 이정훈 | 베테랑 · 제조 30년 | 김대표와 상담 기록, 오답 노트 |
| `mk@example.com` | 박미경 | 베테랑 · 유통 25년 | |
| `choi@example.com` | 최동수 | 베테랑 · 세무 28년 | 김대표와 진행 중인 예약, 비공개 노트 초안 |
| `ys@example.com` | 김영숙 | 베테랑 · 인사·노무 27년 | |
| `jung@example.com` | 정성호 | 베테랑 · 무역 32년 | |
| `han@example.com` | 한상철 | 베테랑 · 외식 22년 | |
| `oh@example.com` | 오명수 | 베테랑 · 승인 대기 | 관리자 승인 데모용 |
| `admin@example.com` | 관리자 | 관리자 | `pages/admin.html`에서 경력 인증 승인·반려 |

상담 가능 시간은 seed를 실행한 날 기준 **내일부터 7일간**만 있습니다. 시간이 지나면 SQL Editor에서 `seed.sql`을 다시 실행하세요. 기존 데모 데이터(`@example.com` 계정)를 지우고 새로 만듭니다.

## 브랜치 전략

```
main      ← 배포용 (Vercel Production). develop에서만 PR로 합칩니다.
develop   ← 개발 통합 브랜치 (기본 브랜치)
feat/*    ← 기능 개발      예) feat/login, feat/chat
fix/*     ← 버그 수정      예) fix/booking-time
docs/*    ← 문서 수정
```

1. `develop`에서 새 브랜치를 만듭니다: `git switch develop && git pull && git switch -c feat/login`
2. 작업하고 커밋한 뒤 push합니다: `git push -u origin feat/login`
3. GitHub에서 `develop`으로 PR을 열고, 팀원 **1명 이상의 승인**을 받은 뒤 머지합니다.
4. 기능이 어느 정도 모이면 `develop` → `main` PR을 열어 배포합니다.

`main`과 `develop`에는 직접 push할 수 없고, force push와 삭제도 막혀 있습니다.

## 커밋 메시지 규칙

| 태그 | 의미 |
| --- | --- |
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `style` | 디자인·CSS 변경 (동작 변화 없음) |
| `refactor` | 코드 정리 (동작 변화 없음) |
| `docs` | 문서 수정 |
| `chore` | 설정, 패키지 등 기타 |

예) `feat: 베테랑 목록 검색 기능 추가`

## 보안 주의사항

- `js/supabase.js`의 **anon key**는 공개되어도 괜찮지만, 모든 테이블에 **RLS(Row Level Security)를 켜야** 안전합니다.
- **service_role key**와 AI API 키는 절대 코드에 넣지 마세요. Edge Function의 환경 변수(Secrets)에만 저장합니다.
