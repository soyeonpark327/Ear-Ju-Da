// AI 매칭 (Supabase Edge Function)
// 청년 창업가의 고민 문장을 받아, 승인된 베테랑 중 가장 잘 맞는 사람과 추천 이유를 Gemini로 고른다.
//
//   POST /ai-match  { "concern": "공장이 갑자기 단가를 깎자고 해요" }
//   → { "summary": "고민 한 줄 요약", "keywords": ["단가협상", ...],
//       "matches": [{ "expert_id": "...", "reason": "추천 이유" }, ...] }   (최대 3명, 잘 맞는 순)
//
// 필요한 Secrets: GEMINI_API_KEY
//   (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY는 Supabase가 자동으로 넣어준다)
// 선택 Secrets: GEMINI_MODEL  기본은 gemini-flash-latest, 안 되면 gemini-2.5-flash
//
// 배포할 때 "Verify JWT"는 끈다. (로그인하지 않은 방문자도 매칭을 써볼 수 있게)

const env = (key: string) => Deno.env.get(key) ?? "";
const MAX_CONCERN = 1000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Expert = {
  id: string;
  name: string;
  headline: string;
  industry: string;
  career_years: number;
  keywords: string[];
  rating: number;
  review_count: number;
  trust_label?: string;
  career_summary?: string;
};

// 승인된 베테랑 목록 (+ 상세 경력)
async function loadExperts(): Promise<Expert[]> {
  const headers = { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}` };
  const base = `${env("SUPABASE_URL")}/rest/v1`;
  const [cards, details] = await Promise.all([
    fetch(`${base}/expert_cards?select=*`, { headers }).then((r) => r.json()),
    fetch(`${base}/experts?select=id,career_summary&verification=eq.approved`, { headers }).then((r) => r.json()),
  ]);
  if (!Array.isArray(cards)) throw new Error(`expert_cards: ${JSON.stringify(cards).slice(0, 200)}`);
  const summary = new Map((Array.isArray(details) ? details : []).map((d: any) => [d.id, d.career_summary]));
  return cards.map((c: any) => ({ ...c, career_summary: summary.get(c.id) ?? "" }));
}

const SYSTEM = `당신은 "이어주다"의 매칭 담당자입니다. 이어주다는 은퇴한 현장 베테랑이 청년 창업가에게 실패를 막는 실전 조언을 해주는 서비스입니다.
청년 창업가의 고민을 읽고, 주어진 베테랑 목록에서 가장 도움이 될 사람을 최대 3명까지 잘 맞는 순서로 고르세요.

규칙
- 반드시 목록에 있는 expert_id만 사용하세요. 목록에 없는 사람을 지어내지 마세요.
- 고민과 관련 없는 베테랑은 넣지 마세요. 맞는 사람이 없으면 matches를 빈 배열로 두세요.
- reason은 청년 창업가에게 말하듯 1~2문장으로, 고민의 어떤 부분을 베테랑의 어떤 경력이 해결해줄 수 있는지 구체적으로 연결하세요. (예: "납품 단가 조정 조항 때문에 고민이시죠. 자동차 부품사 구매팀에서 30년간 협력사 단가 협상을 맡아온 분이라 공장 측 입장을 정확히 짚어주실 거예요.")
- summary는 고민을 15자 안팎으로 요약하세요.
- keywords는 고민의 핵심 주제 1~4개 (예: "단가협상", "근로계약").`;

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
  },
  required: ["summary", "keywords", "matches"],
};

async function askGemini(concern: string, experts: Expert[]) {
  const list = experts.map((e) => ({
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
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{
      role: "user",
      parts: [{ text: `베테랑 목록:\n${JSON.stringify(list)}\n\n청년 창업가의 고민:\n"""${concern}"""` }],
    }],
    generationConfig: { temperature: 0.3, responseMimeType: "application/json", responseSchema: SCHEMA },
  };
  const models = [env("GEMINI_MODEL"), "gemini-flash-latest", "gemini-2.5-flash"].filter(Boolean);
  let lastError = "";
  for (const model of models) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env("GEMINI_API_KEY") },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.status === 404) { lastError = `${model}: not found`; continue; } // 모델 이름이 바뀐 경우 다음 후보로
    if (!res.ok) throw new Error(`gemini ${model} ${res.status}: ${data.error?.message ?? ""}`);
    const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    return JSON.parse(text);
  }
  throw new Error(`gemini: ${lastError}`);
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST로 요청해주세요." }, 405);
  if (!env("GEMINI_API_KEY")) return json({ error: "AI 매칭이 아직 설정되지 않았어요." }, 503);

  let concern = "";
  try {
    concern = String((await req.json()).concern ?? "").trim();
  } catch {
    return json({ error: "고민 내용을 보내주세요." }, 400);
  }
  if (concern.length < 2) return json({ error: "고민을 조금 더 자세히 적어주세요." }, 400);
  concern = concern.slice(0, MAX_CONCERN);

  try {
    const experts = await loadExperts();
    if (!experts.length) return json({ summary: "", keywords: [], matches: [] });
    const result = await askGemini(concern, experts);

    // 목록에 있는 베테랑만, 중복 없이, 최대 3명
    const ids = new Set(experts.map((e) => e.id));
    const seen = new Set<string>();
    const matches = (Array.isArray(result.matches) ? result.matches : [])
      .filter((m: any) => ids.has(m?.expert_id) && !seen.has(m.expert_id) && seen.add(m.expert_id))
      .slice(0, 3)
      .map((m: any) => ({ expert_id: m.expert_id, reason: String(m.reason ?? "").slice(0, 300) }));

    return json({
      summary: String(result.summary ?? "").slice(0, 60),
      keywords: (Array.isArray(result.keywords) ? result.keywords : []).map(String).slice(0, 4),
      matches,
    });
  } catch (err) {
    console.error("ai-match error:", err);
    return json({ error: "AI 매칭 중 문제가 생겼어요. 잠시 후 다시 시도해주세요." }, 502);
  }
}

if (import.meta.main) Deno.serve(handler);
