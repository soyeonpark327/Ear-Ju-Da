// api 함수들이 같이 쓰는 도우미

// Supabase 응답 { data, error }에서 에러면 throw, 아니면 data만 돌려준다.
export function unwrap({ data, error }) {
  if (!error) return data;
  // 42501: 로그인 안 했거나, RLS 정책상 허용되지 않은 작업
  if (error.code === '42501') throw new Error('이 작업을 할 권한이 없습니다.');
  if (error.code === '23505') throw new Error('이미 등록되어 있습니다.');
  throw new Error(error.message);
}

// 검색어에서 Supabase 필터 문법을 깨뜨리는 문자와 '#'을 뺀다.
export function cleanKeyword(keyword) {
  return (keyword ?? '').replace(/[,(){}%*"\\#]/g, ' ').replace(/\s+/g, ' ').trim();
}

// 검색어를 띄어쓰기 단위로 나눈다. 예) '#제조공정 #납품계약' → ['제조공정', '납품계약']
export function splitKeywords(keyword) {
  const kw = cleanKeyword(keyword);
  return kw ? kw.split(' ') : [];
}
