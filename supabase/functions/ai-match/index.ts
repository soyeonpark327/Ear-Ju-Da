// AI 매칭 (Supabase Edge Function)
// 청년 창업가의 고민을 받아 Gemini로 "이어주다" 흐름에 맞는 결과를 만든다.
//   ① 맞는 베테랑 (최대 3명, 추천 이유)  ② 먼저 읽을 오답노트 (최대 2개)  ③ 상담 전 준비할 질문 (3개)
//
//   POST /ai-match
//   {
//     "concern": "공장이 갑자기 단가를 깎자고 해요",
//     "filters": {                       // 모두 선택 사항
//       "industry": "제조",               // 분야 (expert_cards.industry 값)
//       "stage": "early",                 // 창업 단계: "pre" 예비 / "early" 1~3년 차 / "growth" 3년 차 이상
//       "max_price": 3000,                // 상담 1회 최대 포인트
//       "available_soon": true            // 7일 안에 상담 가능한 베테랑만
//     }
//   }
//   → {
//     "summary": "납품 단가 인하 압박", "keywords": ["단가협상"],
//     "matches":  [{ "expert_id": "...", "reason": "..." }],
//     "notes":    [{ "note_id": 1, "reason": "..." }],
//     "questions": ["...", "...", "..."],
//     "filtered_count": 6                // 필터를 통과한 베테랑 수 (0이면 matches도 빈 배열)
//   }
//
// 필요한 Secrets: GEMINI_API_KEY
//   (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY는 Supabase가 자동으로 넣어준다)
// 선택 Secrets: GEMINI_MODEL  먼저 써볼 모델. 기본 순서는 MODELS 참고
//
// 배포할 때 "Verify JWT"는 끈다. (로그인하지 않은 방문자도 매칭을 써볼 수 있게)

const env = (key: string) => Deno.env.get(key) ?? "";
const MAX_CONCERN = 1000;
// 빠른 모델부터. "생각하는(thinking)" 최신 모델은 답이 수십 초~수 분 걸려 함수 시간 제한(150초)에 걸린다.
const MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-flash-lite-latest"];
const MODEL_TIMEOUT_MS = 20_000;
const SOON_DAYS = 7;

const STAGES: Record<string, string> = {
  pre: "예비 창업 (아직 사업자 등록 전)",
  early: "초기 창업 (1~3년 차)",
  growth: "성장 단계 (3년 차 이상)",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Filters = { industry?: string; stage?: string; max_price?: number; available_soon?: boolean };
type Expert = {
  id: string;
  name: string;
  headline: string;
  industry: string;
  career_years: number;
  keywords: string[];
  price_points: number;
  rating: number;
  review_count: number;
  trust_label?: string;
  career_summary?: string;
};
type Note = { id: number; title: string; summary: string; industry: string; keywords: string[]; author_id: string };

// ---------- DB 조회 ----------
async function rest(path: string) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error(`${path.split("?")[0]}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

async function loadCandidates(filters: Filters) {
  const soonUntil = new Date(Date.now() + SOON_DAYS * 86_400_000).toISOString();
  const [cards, details, notes, slots] = await Promise.all([
    rest("expert_cards?select=*"),
    rest("experts?select=id,career_summary&verification=eq.approved"),
    rest("notes?select=id,title,summary,industry,keywords,author_id&is_published=eq.true&order=created_at.desc&limit=50"),
    filters.available_soon
      ? rest(`availability_slots?select=expert_id&is_booked=eq.false&start_at=gt.${new Date().toISOString()}&start_at=lt.${soonUntil}`)
      : Promise.resolve([]),
  ]);
  const summary = new Map(details.map((d: any) => [d.id, d.career_summary]));
  const soon = new Set(slots.map((s: any) => s.expert_id));

  const experts: Expert[] = cards
    .map((c: any) => ({ ...c, career_summary: summary.get(c.id) ?? "" }))
    .filter((e: Expert) => !filters.industry || e.industry === filters.industry)
    .filter((e: Expert) => filters.max_price === undefined || e.price_points <= filters.max_price)
    .filter((e: Expert) => !filters.available_soon || soon.has(e.id));
  return { experts, notes: notes as Note[] };
}

// 요청의 filters를 안전한 값만 남겨 정리
function cleanFilters(raw: any): Filters {
  const f: Filters = {};
  if (raw && typeof raw === "object") {
    if (typeof raw.industry === "string" && raw.industry.trim()) f.industry = raw.industry.trim().slice(0, 30);
    if (typeof raw.stage === "string" && raw.stage in STAGES) f.stage = raw.stage;
    if (Number.isFinite(Number(raw.max_price)) && raw.max_price !== null && raw.max_price !== "") f.max_price = Math.max(0, Number(raw.max_price));
    if (raw.available_soon === true) f.available_soon = true;
  }
  return f;
}

// ---------- Gemini ----------
const SYSTEM = `당신은 "이어주다"의 매칭 담당자입니다. 이어주다는 은퇴한 현장 베테랑이 청년 창업가에게 "망하지 않는 법"을 알려주는 서비스입니다.
서비스 흐름: ① 고민에 맞는 베테랑 찾기 → ② 베테랑이 쓴 "오답노트"(실패 사례 정리)를 먼저 읽기 → ③ 준비한 질문으로 1:1 상담 예약.
청년 창업가의 고민을 읽고 이 흐름에 맞춰 답하세요.

규칙
- matches: 베테랑 목록에서 가장 도움이 될 사람을 최대 3명, 잘 맞는 순서로. 관련 없는 사람은 넣지 말고, 없으면 빈 배열.
- 반드시 목록에 있는 expert_id, note_id만 쓰세요. 없는 사람·노트를 지어내지 마세요.
- matches.reason: 청년에게 말하듯 1~2문장. 고민의 어떤 부분을 베테랑의 어떤 경력이 해결해 줄지 구체적으로 연결하세요.
  (예: "납품 단가 조정 조항 때문에 고민이시죠. 자동차 부품사 구매팀에서 30년간 협력사 단가 협상을 맡아온 분이라 공장 측 입장을 정확히 짚어주실 거예요.")
- notes: 상담 전에 먼저 읽으면 좋은 오답노트를 최대 2개. 관련 있는 것만, 없으면 빈 배열. reason은 왜 먼저 읽으면 좋은지 1문장.
- questions: 이 고민으로 상담할 때 베테랑에게 물어볼 핵심 질문 3개. 청년이 그대로 복사해 쓸 수 있게 구체적인 한 문장씩.
  matches가 빈 배열이면(창업과 관련 없는 고민 등) questions와 notes도 빈 배열로 두세요.
- 창업 단계가 주어지면 그 단계에 맞게 추천 이유와 질문의 눈높이를 맞추세요. (예비 창업이면 기초부터, 성장 단계면 실무 심화)
- summary: 고민을 15자 안팎으로 요약. 고민에 쓰인 사실(인상/인하, 금액, 대상)을 바꾸지 말고 그대로 반영하세요.
- keywords: 핵심 주제 1~4개 (예: "단가협상", "근로계약").
- 모든 문장은 자연스러운 표준 한국어 맞춤법으로 쓰세요. 뜻이 불분명한 단어를 만들어 쓰지 마세요.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    keywords: { type: "ARRAY", items: { type: "STRING" } },
    matches: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { expert_id: { type: "STRING" }, reason: { type: "STRING" } },
        required: ["expert_id", "reason"],
      },
    },
    notes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { note_id: { type: "INTEGER" }, reason: { type: "STRING" } },
        required: ["note_id", "reason"],
      },
    },
    questions: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["summary", "keywords", "matches", "notes", "questions"],
};

async function askGemini(concern: string, filters: Filters, experts: Expert[], notes: Note[]) {
  const expertList = experts.map((e) => ({
    expert_id: e.id,
    name: e.name,
    headline: e.headline,
    industry: e.industry,
    career_years: e.career_years,
    career_summary: e.career_summary,
    keywords: e.keywords,
    rating: e.rating,
    trust: e.trust_label,
  }));
  const noteList = notes.map((n) => ({ note_id: n.id, title: n.title, summary: n.summary, industry: n.industry, keywords: n.keywords }));
  const context = [
    `베테랑 목록:\n${JSON.stringify(expertList)}`,
    `오답노트 목록:\n${JSON.stringify(noteList)}`,
    filters.stage ? `청년 창업가의 단계: ${STAGES[filters.stage]}` : "",
    `청년 창업가의 고민:\n"""${concern}"""`,
  ].filter(Boolean).join("\n\n");

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts: [{ text: context }] }],
    generationConfig: { temperature: 0.3, responseMimeType: "application/json", responseSchema: SCHEMA },
  };
  const models = [...new Set([env("GEMINI_MODEL"), ...MODELS].filter(Boolean))];
  const errors: string[] = [];
  for (const model of models) {
    // 2.5 flash는 기본으로 생각(thinking)을 해서 느리다 → 끈다
    const config = model === "gemini-2.5-flash"
      ? { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: { thinkingBudget: 0 } } }
      : body;
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env("GEMINI_API_KEY") },
        body: JSON.stringify(config),
        signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
      });
    } catch (err) {
      errors.push(`${model}: ${(err as Error).name === "TimeoutError" ? "timeout" : (err as Error).message}`);
      continue; // 시간 초과·네트워크 오류 → 다음 모델
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      errors.push(`${model} ${res.status}: ${data.error?.message ?? ""}`);
      if (res.status === 403) break; // 키·프로젝트 권한 문제는 다른 모델도 같다
      continue; // 404(모델 없음)·429(사용량 초과)·5xx → 다음 모델
    }
    const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    return { result: JSON.parse(text), model, tried: errors };
  }
  throw new Error(`gemini: ${errors.join(" | ")}`);
}

// AI 결과에서 목록에 있는 것만, 중복 없이, 개수 제한
function pick<T>(items: unknown, key: string, valid: Set<T>, limit: number) {
  const seen = new Set<T>();
  return (Array.isArray(items) ? items : [])
    .filter((m: any) => valid.has(m?.[key]) && !seen.has(m[key]) && seen.add(m[key]))
    .slice(0, limit)
    .map((m: any) => ({ [key]: m[key], reason: String(m.reason ?? "").slice(0, 300) }));
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST로 요청해주세요." }, 405);
  if (!env("GEMINI_API_KEY")) return json({ error: "AI 매칭이 아직 설정되지 않았어요." }, 503);

  let concern = "";
  let filters: Filters = {};
  try {
    const body = await req.json();
    concern = String(body.concern ?? "").trim();
    filters = cleanFilters(body.filters);
  } catch {
    return json({ error: "고민 내용을 보내주세요." }, 400);
  }
  if (concern.length < 2) return json({ error: "고민을 조금 더 자세히 적어주세요." }, 400);
  concern = concern.slice(0, MAX_CONCERN);

  try {
    const { experts, notes } = await loadCandidates(filters);
    const empty = { summary: "", keywords: [], matches: [], notes: [], questions: [], filtered_count: experts.length };
    if (!experts.length) return json(empty); // 필터에 맞는 베테랑이 없음

    const started = Date.now();
    const { result, model, tried } = await askGemini(concern, filters, experts, notes);
    const matches = pick(result.matches, "expert_id", new Set(experts.map((e) => e.id)), 3);
    return json({
      summary: String(result.summary ?? "").slice(0, 60),
      keywords: (Array.isArray(result.keywords) ? result.keywords : []).map(String).slice(0, 4),
      matches,
      // 추천할 베테랑이 없으면 노트·질문도 비운다 (창업과 무관한 고민)
      notes: matches.length ? pick(result.notes, "note_id", new Set(notes.map((n) => n.id)), 2) : [],
      questions: matches.length
        ? (Array.isArray(result.questions) ? result.questions : []).map((q: unknown) => String(q).slice(0, 200)).filter(Boolean).slice(0, 3)
        : [],
      filtered_count: experts.length,
      // 확인용: 실제로 답한 모델, 걸린 시간(ms), 앞서 실패한 모델
      debug: { model, ms: Date.now() - started, skipped: tried },
    });
  } catch (err) {
    console.error("ai-match error:", err);
    return json({ error: "AI 매칭 중 문제가 생겼어요. 잠시 후 다시 시도해주세요." }, 502);
  }
}

if (import.meta.main) Deno.serve(handler);
