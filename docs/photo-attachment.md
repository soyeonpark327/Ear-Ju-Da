# AI 매칭 사진 첨부

- JPG/PNG/WebP 한 장, 원본 최대 5MB. 브라우저에서 긴 변 최대 1600px JPEG로 재인코딩한다.
- 사진만 보내기도 가능하며, 사진은 세션 저장소나 Storage에 저장하지 않고 매칭 요청에만 포함한다.
- AI 실패 시 첨부와 입력을 유지한다. 사진을 무시한 키워드 검색으로 전환하지 않는다.
- 데모 모드는 이미지 분석을 수행하지 않는다.

## 배포 순서

프론트 반영 **전에** 기존 Supabase 프로젝트의 `ai-match` Edge Function을 이 브랜치의 `supabase/functions/ai-match/index.ts`로 업데이트한다. 기존 Secrets와 Verify JWT 설정은 유지한다. CLI 사용 시 기존 프로젝트를 확인한 후 `supabase functions deploy ai-match --project-ref idjaoyktgnfqpfaovmth --no-verify-jwt`를 사용하거나 Supabase Dashboard의 해당 함수 편집기에서 업데이트한다.

기존 텍스트 요청도 지원한다. 서버가 이전 버전이면 이미지를 무시할 수 있으므로 서버 업데이트를 생략하지 않는다.

## 검증

`node --experimental-strip-types tests/ai-match-images.mjs` (Node 24): 이미지 형식/크기/개수 검증, 잘못된 요청 거부, Gemini inlineData 전달 확인. 외부 AI를 호출하지 않는 모의 테스트다.
실제 Gemini 이미지 분석 및 Supabase 배포는 별도 통합 확인이 필요하다.
