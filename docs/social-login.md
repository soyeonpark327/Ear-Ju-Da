# 간편 로그인 설정 (구글 · 카카오)

코드는 이미 준비돼 있습니다. 아래 설정을 마치고 Supabase에서 해당 로그인을 켜면 로그인 화면의 버튼이 **자동으로 활성화**됩니다.

- Supabase 콜백 주소 (여러 번 씀): `https://idjaoyktgnfqpfaovmth.supabase.co/auth/v1/callback`
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

1. [Kakao Developers](https://developers.kakao.com/)에 로그인 → **내 애플리케이션 → 애플리케이션 추가하기** (앱 이름 `이어주다`)
2. **앱 키**에서 **REST API 키**를 복사합니다. → Supabase의 Client ID
3. **카카오 로그인** 메뉴
   - 활성화 설정 **ON**
   - Redirect URI 등록: `https://idjaoyktgnfqpfaovmth.supabase.co/auth/v1/callback`
4. **카카오 로그인 → 보안 → Client Secret** 코드 생성, 활성화 상태 **사용함** → 코드 복사 → Supabase의 Client Secret
5. **플랫폼 → Web** 사이트 도메인 등록: `https://earjuda.vercel.app`
6. **카카오 로그인 → 동의항목**
   - 닉네임(`profile_nickname`), 프로필 사진(`profile_image`): **필수 동의** 또는 선택 동의
   - 카카오계정(이메일)(`account_email`): 아래 주의 참고
7. Supabase **Authentication → Sign In / Providers → Kakao**
   - Enable 켜기, Client ID(REST API 키) / Client Secret 붙여넣기 → **Save**

### ⚠️ 이메일 동의항목
Supabase는 카카오 로그인 때 **이메일(account_email)** 을 요청합니다. 그런데 카카오는 이메일 동의항목을 **비즈 앱**에서만 켤 수 있습니다.

- 로그인 시 `KOE205` 같은 에러가 나면 이메일 동의항목 때문입니다.
- 해결 방법 (둘 중 하나)
  1. Supabase Kakao 설정에 **이메일 없이 로그인 허용** 옵션이 있으면 켭니다.
  2. 카카오 앱을 **비즈 앱으로 전환**합니다. 사업자등록번호가 없어도 **개인 개발자 비즈 앱**으로 전환할 수 있는 경우가 있습니다. 전환 후 이메일 동의항목을 켭니다.

---

## 3. 확인

1. `https://earjuda.vercel.app/pages/login` 을 새로고침하면 켠 로그인 버튼이 진하게 바뀝니다.
2. 버튼을 눌러 로그인 → 원래 보던 화면으로 돌아오면 성공입니다.
3. 처음 로그인한 사람은 **청년 창업가**로 가입됩니다. 이름과 프로필 사진은 구글·카카오 정보에서 가져옵니다.

## 네이버

Supabase가 네이버를 기본 지원하지 않아 직접 서버 코드(Edge Function)가 필요합니다. 다음 단계에서 구현합니다. 그 전까지 버튼은 "준비 중"으로 표시됩니다.
