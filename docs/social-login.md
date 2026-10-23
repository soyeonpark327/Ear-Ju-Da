# 간편 로그인 설정 (구글 · 카카오 · 네이버)

코드는 이미 준비돼 있습니다. 아래 설정을 마치고 Supabase에서 해당 로그인을 켜면 로그인 화면의 버튼이 **자동으로 활성화**됩니다.

- Supabase 콜백 주소 (구글·카카오): `https://idjaoyktgnfqpfaovmth.supabase.co/auth/v1/callback`
- 네이버 콜백 주소: `https://idjaoyktgnfqpfaovmth.supabase.co/functions/v1/naver-login/callback`
- 실제 사이트 주소: `https://earjuda.vercel.app`

> 콘솔 화면의 메뉴 이름은 업데이트로 조금씩 바뀔 수 있습니다. 비슷한 이름을 찾아주세요.

---

## 0. Supabase 주소 설정 (한 번만, 꼭 먼저)

**Authentication → URL Configuration**

| 항목 | 값 |
| --- | --- |
| Site URL | `https://earjuda.vercel.app` |
| Redirect URLs (Add URL로 하나씩) | `https://earjuda.vercel.app/**`<br>`http://127.0.0.1:5500/**`<br>`http://localhost:5500/**` |

이걸 안 하면 로그인 후 `localhost:3000` 같은 엉뚱한 주소로 돌아갑니다. 아래 두 줄은 VS Code Live Server로 테스트할 때 필요합니다.

---

## 1. 구글

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트를 새로 만듭니다. (이름 예: `ear-ju-da`)
2. **API 및 서비스 → OAuth 동의 화면 (Google 인증 플랫폼)**
   - 사용자 유형: **외부**
   - 앱 이름 `이어주다`, 지원 이메일·개발자 연락처에 본인 이메일
   - 범위(Scopes)는 기본값(`email`, `profile`, `openid`) 그대로
3. **사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
   - 애플리케이션 유형: **웹 애플리케이션**
   - 승인된 JavaScript 원본: `https://earjuda.vercel.app`
   - 승인된 리디렉션 URI: `https://idjaoyktgnfqpfaovmth.supabase.co/auth/v1/callback`
4. 만들어진 **클라이언트 ID**와 **클라이언트 보안 비밀번호**를 복사합니다.
5. Supabase **Authentication → Sign In / Providers → Google**
   - Enable 켜기, Client ID / Client Secret 붙여넣기 → **Save**

> 동의 화면이 "테스트" 상태면 **테스트 사용자로 등록한 구글 계정만** 로그인할 수 있습니다. 팀원 계정을 테스트 사용자에 추가하거나, 동의 화면을 **게시(프로덕션)** 상태로 바꾸세요.

---

## 2. 카카오

Supabase 기본 카카오 로그인은 **이메일(account_email)** 을 반드시 요청하는데, 카카오는 이메일 동의항목을 비즈 앱에서만 켤 수 있어 `KOE205` 에러가 납니다. 그래서 네이버처럼 **Edge Function(`supabase/functions/kakao-login`)** 으로 닉네임·프로필 사진만 받아 로그인합니다.

### 2-1. 카카오 콘솔
1. [Kakao Developers](https://developers.kakao.com/) → 내 애플리케이션 → 앱 선택
2. **앱 → 플랫폼 키 → REST API 키** 상세 화면
   - **REST API 키** 값 복사 → Secret `KAKAO_REST_API_KEY`
   - **카카오 로그인 리다이렉트 URI**에 추가: `https://idjaoyktgnfqpfaovmth.supabase.co/functions/v1/kakao-login/callback`
   - **클라이언트 시크릿** 코드 생성·활성화 → 복사 → Secret `KAKAO_CLIENT_SECRET`
3. **카카오 로그인 → 일반**: 사용 설정 **ON**
4. **카카오 로그인 → 동의항목**: 닉네임(필수 동의), 프로필 사진(선택 동의). 이메일은 필요 없습니다.
5. **플랫폼 → Web** 사이트 도메인: `https://earjuda.vercel.app`

### 2-2. Edge Function 배포 · Secrets
네이버(4-2, 4-3)와 같은 방법입니다.
1. **Edge Functions → Deploy a new function → Via Editor**, 이름 **`kakao-login`** (Deploy 전에 이름 먼저!)
2. `supabase/functions/kakao-login/index.ts` 붙여넣기 → Deploy
3. 함수 **Settings → Verify JWT 끄기 → Save changes**
4. **Edge Functions → Secrets**: `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`
5. 확인: `https://idjaoyktgnfqpfaovmth.supabase.co/functions/v1/kakao-login/status` → `{"enabled":true}`

> Supabase **Sign In / Providers → Kakao**는 더 이상 쓰지 않으므로 꺼도 됩니다.

---

## 3. 확인

1. `https://earjuda.vercel.app/pages/login` 을 새로고침하면 켠 로그인 버튼이 진하게 바뀝니다.
2. 버튼을 눌러 로그인 → 원래 보던 화면으로 돌아오면 성공입니다.
3. 처음 로그인한 사람은 **청년 창업가**로 가입됩니다. 이름과 프로필 사진은 구글·카카오 정보에서 가져옵니다.

## 4. 네이버

Supabase가 네이버를 기본 지원하지 않아서 **Edge Function**(`supabase/functions/naver-login`)으로 구현했습니다. 키는 Supabase 로그인 설정이 아니라 **Edge Function Secrets**에 넣습니다.

### 4-1. 네이버 개발자센터
1. [NAVER Developers](https://developers.naver.com/) → **Application → 애플리케이션 등록**
2. 애플리케이션 이름 `이어주다`, 사용 API **네이버 로그인**
3. 제공 정보: **이름**, **별명**, **프로필 사진** (이메일은 선택. 로그인에 꼭 필요하지 않음)
4. 로그인 오픈 API 서비스 환경: **PC 웹** (모바일 웹도 추가 가능)
   - 서비스 URL: `https://earjuda.vercel.app`
   - 네이버 로그인 Callback URL: `https://idjaoyktgnfqpfaovmth.supabase.co/functions/v1/naver-login/callback`
5. 등록 후 **Client ID**, **Client Secret** 복사

> 앱이 "개발 중" 상태면 **멤버관리 → 테스트 ID**에 등록한 네이버 계정만 로그인할 수 있습니다. 팀원 네이버 아이디를 추가하세요. 누구나 쓰게 하려면 "검수 요청"이 필요합니다.

### 4-2. Edge Function 배포 (대시보드에서)
1. Supabase **Edge Functions → Deploy a new function → Via Editor**
2. 함수 이름: **`naver-login`** (정확히 이 이름)
3. `supabase/functions/naver-login/index.ts` 내용을 전부 붙여넣고 **Deploy**
4. 배포된 함수 → **Details(설정)** 에서 **Verify JWT** (Enforce JWT verification)를 **끄고** 저장
   - 켜져 있으면 네이버 버튼을 눌렀을 때 401 에러가 납니다.

### 4-3. Secrets
**Edge Functions → Secrets** (또는 Project Settings → Edge Functions) 에서 추가

| Name | Value |
| --- | --- |
| `NAVER_CLIENT_ID` | 네이버 Client ID |
| `NAVER_CLIENT_SECRET` | 네이버 Client Secret |

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`는 Supabase가 자동으로 넣어주므로 추가하지 않습니다.

### 4-4. 확인
- 브라우저에서 `https://idjaoyktgnfqpfaovmth.supabase.co/functions/v1/naver-login/status` → `{"enabled":true}` 이면 준비 완료
- 로그인 화면 새로고침 → 네이버 버튼 활성화 → 로그인 후 원래 화면으로 돌아오면 성공

### 동작 방식 (참고)
1. 버튼 → Edge Function → 네이버 로그인 화면 (위조 방지용 서명 state + 쿠키)
2. 네이버 → Edge Function 콜백: 네이버 프로필로 Supabase 계정을 만들거나 찾음
   - 계정 아이디는 네이버 고유번호로 만든 내부 주소(`naver_...@naver.invalid`). 네이버 이메일로 같은 이메일의 기존 계정에 로그인되는 일을 막기 위해 분리합니다.
3. 일회용 로그인 토큰을 들고 로그인 화면으로 복귀 → `verifyOtp`로 로그인 완료
4. 돌아갈 수 있는 사이트는 `earjuda.vercel.app`, `127.0.0.1:5500`, `localhost:5500`만 허용 (Secret `ALLOWED_ORIGINS`로 변경 가능)
