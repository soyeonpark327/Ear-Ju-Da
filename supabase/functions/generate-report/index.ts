// AI 전략 보고서 (Supabase Edge Function)
// 상담이 끝나면 1:1 채팅 대화를 Gemini가 읽고, 청년 창업가가 바로 실행할 수 있는 보고서를 만든다.
//   summary: 핵심 조언 / checklist: 즉시 실행 체크리스트 / risks: 앞으로 주의할 리스크
//
//   POST /generate-report  { "booking_id": 12 }
//   헤더: Authorization: Bearer <로그인한 사용자의 access token>
//   → { "report": { "booking_id": 12, "summary": "...", "checklist": [...], "risks": [...], "created_at": "..." },
//       "created": true }   // 이미 있으면 새로 만들지 않고 created: false
//
// 규칙
// - 그 상담의 청년 또는 베테랑만 요청할 수 있다.
// - 완료(completed)된 상담만 만들 수 있다.
// - 대화가 너무 짧으면 만들지 않는다.
// - 한 상담당 보고서는 하나. 이미 있으면 그대로 돌려준다. (AI 사용량 절약)
//
// 필요한 Secrets: GEMINI_API_KEY  (ai-match와 같은 키)
//   (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY는 Supabase가 자동으로 넣어준다)
// 선택 Secrets: GEMINI_MODEL
//
// 배포할 때 "Verify JWT"는 끈다. 로그인 확인은 함수 안에서 직접 한다.

const env = (key: string) => Deno.env.get(key) ?? "";
const MIN_MESSAGES = 2;
const MAX_TRANSCRIPT = 12_000; // Gemini에 보낼 대화 최대 글자 수 (최근 대화 우선)
const MODEL_TIMEOUT_MS = 30_000;
const MINIMAL_THINKING = { thinkingConfig: { thinkingLevel: "minimal" } };
const ATTEMPTS = [
  { model: "gemini-3.5-flash-lite", extra: MINIMAL_THINKING },
  { model: "gemini-3.5-flash-lite", extra: {} },
  { model: "gemini-flash-lite-latest", extra: MINIMAL_THINKING },
  { model: "gemini-flash-lite-latest", extra: {} },
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ---------- Supabase (service role) ----------
const serviceHeaders = () => {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
};
async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, { ...init, headers: { ...serviceHeaders(), ...(init.headers ?? {}) } });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${path.split("?")[0]} ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

// 요청한 사람 확인 (로그인 토큰 → 사용자 id)
async function currentUserId(req: Request): Promise<string | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const res = await fetch(`${env("SUPABASE_URL")}/auth/v1/user`, {
    headers: { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()).id ?? null;
}

// ---------- Gemini ----------
const SYSTEM = `당신은 "이어주다"의 AI 전략 비서입니다. 이어주다는 은퇴한 현장 베테랑이 청년 창업가에게 실패를 막는 실전 조언을 해주는 서비스입니다.
베테랑과 청년 창업가의 1:1 상담 대화를 읽고, 청년이 상담 내용을 바로 사업에 반영할 수 있도록 "나만의 전략 보고서"를 만드세요.

규칙
- 대화에 실제로 나온 내용만 근거로 쓰세요. 대화에 없는 사실·숫자·법 조항을 지어내지 마세요.
- summary: 이번 상담의 핵심 조언을 2~3문장으로. 무엇이 문제였고 베테랑이 무엇을 하라고 했는지.
- checklist: 청년이 바로 실행할 일 3~5개. "~하기" 형태의 짧고 구체적인 행동. (예: "3조 단가 조정 조항을 원자재 지수 5% 이상 변동 시 분기별 조정으로 수정 요청하기")
- risks: 앞으로 주의할 리스크 2~4개. "~하면 ~할 수 있음" 형태로 원인과 결과를 함께.
- 베테랑의 표현과 숫자를 최대한 살리세요.
- 모든 문장은 자연스러운 표준 한국어 맞춤법으로 쓰세요.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    checklist: { type: "ARRAY", items: { type: "STRING" } },
    risks: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["summary", "checklist", "risks"],
};

async function askGemini(prompt: string) {
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: SCHEMA },
  };
  const custom = env("GEMINI_MODEL");
  const attempts = custom ? [{ model: custom, extra: MINIMAL_THINKING }, { model: custom, extra: {} }, ...ATTEMPTS] : ATTEMPTS;
  const errors: string[] = [];
  for (const { model, extra } of attempts) {
    const label = `${model}${"thinkingConfig" in extra ? "(minimal)" : ""}`;
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env("GEMINI_API_KEY") },
        body: JSON.stringify({ ...body, generationConfig: { ...body.generationConfig, ...extra } }),
        signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
      });
    } catch (err) {
      errors.push(`${label}: ${(err as Error).name === "TimeoutError" ? "timeout" : (err as Error).message}`);
      continue;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      errors.push(`${label} ${res.status}: ${String(data.error?.message ?? "").slice(0, 120)}`);
      if (res.status === 403) break;
      continue;
    }
    const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    return JSON.parse(text);
  }
  throw new Error(`gemini: ${errors.join(" | ")}`);
}

const list = (v: unknown, max: number) =>
  (Array.isArray(v) ? v : []).map((x) => String(x).trim().slice(0, 300)).filter(Boolean).slice(0, max);

// ---------- 처리 ----------
export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST로 요청해주세요." }, 405);
  if (!env("GEMINI_API_KEY")) return json({ error: "AI 보고서가 아직 설정되지 않았어요." }, 503);

  const userId = await currentUserId(req);
  if (!userId) return json({ error: "로그인이 필요합니다." }, 401);

  let bookingId = 0;
  try {
    bookingId = Number((await req.json()).booking_id);
  } catch { /* 아래에서 처리 */ }
  if (!Number.isInteger(bookingId) || bookingId <= 0) return json({ error: "예약 번호를 확인해주세요." }, 400);

  try {
    const [booking] = await rest(
      `bookings?id=eq.${bookingId}&select=id,youth_id,expert_id,topic,status,youth:profiles(name),expert:experts(headline,profiles(name))`,
    );
    if (!booking || (booking.youth_id !== userId && booking.expert_id !== userId)) {
      return json({ error: "본인의 상담만 보고서를 만들 수 있어요." }, 403);
    }
    if (booking.status !== "completed") return json({ error: "상담을 완료한 뒤에 보고서를 만들 수 있어요." }, 409);

    // 이미 있으면 그대로
    const [existing] = await rest(`reports?booking_id=eq.${bookingId}&select=*`);
    if (existing) return json({ report: existing, created: false });

    const messages = await rest(`messages?booking_id=eq.${bookingId}&select=sender_id,content,created_at&order=created_at`);
    if (messages.length < MIN_MESSAGES) return json({ error: "대화 내용이 부족해서 보고서를 만들 수 없어요." }, 422);

    const youthName = booking.youth?.name ?? "청년";
    const expertName = booking.expert?.profiles?.name ?? "베테랑";
    let transcript = messages
      .map((m: any) => `${m.sender_id === booking.expert_id ? `베테랑(${expertName})` : `청년(${youthName})`}: ${m.content}`)
      .join("\n");
    if (transcript.length > MAX_TRANSCRIPT) transcript = "…(앞부분 생략)\n" + transcript.slice(-MAX_TRANSCRIPT);

    const result = await askGemini([
      `상담 주제: ${booking.topic}`,
      `베테랑: ${expertName} (${booking.expert?.headline ?? ""})`,
      `상담 대화:\n${transcript}`,
    ].join("\n\n"));

    const report = {
      booking_id: bookingId,
      summary: String(result.summary ?? "").trim().slice(0, 1000) || "상담 내용을 요약하지 못했어요.",
      checklist: list(result.checklist, 5),
      risks: list(result.risks, 4),
    };
    // 동시에 두 번 요청돼도 하나만 남도록 (먼저 저장된 것 유지)
    const saved = await rest("reports?on_conflict=booking_id", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify(report),
    });
    const [final] = saved?.length ? saved : await rest(`reports?booking_id=eq.${bookingId}&select=*`);
    return json({ report: final, created: Boolean(saved?.length) });
  } catch (err) {
    console.error("generate-report error:", err);
    return json({ error: "보고서를 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해주세요." }, 502);
  }
}

if (import.meta.main) Deno.serve(handler);
