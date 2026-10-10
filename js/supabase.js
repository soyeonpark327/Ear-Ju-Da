// Supabase 연결은 이 파일에서만 설정합니다.
// 다른 파일에서는 import { supabase } from '../supabase.js'; 로 가져다 씁니다.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Supabase 대시보드 > Project Settings > API 에서 복사합니다.
// anon key는 공개돼도 괜찮지만, 모든 테이블에 RLS를 반드시 켜야 합니다.
// service_role key는 절대 여기에 넣지 마세요.
const SUPABASE_URL = 'https://YOUR-PROJECT-ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
