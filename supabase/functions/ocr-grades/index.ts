// ocr-grades — 성적표 캡쳐 이미지를 AI Vision으로 인식해 성적 테이블(JSON)로 변환.
//
// 보안: AI API 키는 이 함수의 Edge secret으로만 보관(클라이언트 번들 미노출).
//   - 셋 중 설정된 키를 자동 감지: ANTHROPIC_API_KEY → OPENAI_API_KEY → GEMINI_API_KEY
//   - OCR_PROVIDER(anthropic|openai|gemini), OCR_MODEL 로 강제·재정의 가능.
// 인증: verify_jwt=true (로그인 사용자만). 클라이언트는 supabase.functions.invoke 로 호출.
//
// 요청 body: { imageBase64: string(순수 base64), mimeType: string }
// 응답: { rows: [{category,name,grade5,credits}], track?: '인문'|'자연' }
//   - 한국사는 '사회' 교과로 분류. grade5 는 5등급제(1~5).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CATEGORIES = ['국어', '수학', '영어', '사회', '과학', '기타'] as const;

const SYSTEM_PROMPT =
  '너는 한국 고등학교 성적표(교과 성적) 이미지를 읽어 구조화하는 도구다. ' +
  '이미지에서 과목별 행을 추출한다. ' +
  '교과군(category)은 국어/수학/영어/사회/과학/기타 중 하나로 분류하며, 한국사는 반드시 "사회"로 분류한다. ' +
  'grade5는 5등급제 성적(1~5의 숫자)이다. 성적표가 9등급제이면 1~5 범위로 비례 변환하지 말고, ' +
  '표기된 등급 숫자가 1~5를 벗어나면 가장 가까운 5등급제 값으로 보정한다. ' +
  'credits는 단위수(이수단위) 숫자다. 단위수가 없으면 1로 한다. ' +
  '계열(track)이 명시되어 있으면 "인문" 또는 "자연"으로, 없으면 빈 문자열로 둔다. ' +
  '설명·인사말·코드블록(```) 없이 순수 JSON 객체 하나만 출력한다. ' +
  '형태: {"track": "", "rows": [{"category": "", "name": "", "grade5": 0, "credits": 0}]}';

const USER_PROMPT =
  '이 성적표 이미지의 과목별 성적을 추출해 JSON으로 반환해줘. 표의 모든 과목 행을 포함해.';

interface OcrRow {
  category: string;
  name: string;
  grade5: number;
  credits: number;
}
interface OcrResult {
  rows: OcrRow[];
  track?: string;
}

function pickProvider(): 'anthropic' | 'openai' | 'gemini' | null {
  const forced = Deno.env.get('OCR_PROVIDER');
  if (forced === 'anthropic' || forced === 'openai' || forced === 'gemini') return forced;
  // 자동 감지: Gemini 우선(현재 운영 키). 이후 OpenAI → Anthropic.
  if (Deno.env.get('GEMINI_API_KEY')) return 'gemini';
  if (Deno.env.get('OPENAI_API_KEY')) return 'openai';
  if (Deno.env.get('ANTHROPIC_API_KEY')) return 'anthropic';
  return null;
}

// ── Anthropic (Claude vision + structured output) ──
async function callAnthropic(imageBase64: string, mimeType: string): Promise<string> {
  const key = Deno.env.get('ANTHROPIC_API_KEY')!;
  const model = Deno.env.get('OCR_MODEL') ?? 'claude-opus-4-8';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
            { type: 'text', text: USER_PROMPT },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const block = (json.content ?? []).find((b: { type: string }) => b.type === 'text');
  return block?.text ?? '';
}

// ── OpenAI (GPT-4o vision) ──
async function callOpenAI(imageBase64: string, mimeType: string): Promise<string> {
  const key = Deno.env.get('OPENAI_API_KEY')!;
  const model = Deno.env.get('OCR_MODEL') ?? 'gpt-4o';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${SYSTEM_PROMPT} 출력 형태: {"track": string, "rows": [{"category","name","grade5","credits"}]}` },
        {
          role: 'user',
          content: [
            { type: 'text', text: USER_PROMPT },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}

// ── Google Gemini (vision) ──
async function callGemini(imageBase64: string, mimeType: string): Promise<string> {
  const key = Deno.env.get('GEMINI_API_KEY')!;
  const model = Deno.env.get('OCR_MODEL') ?? 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          parts: [
            { text: USER_PROMPT },
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
          ],
        },
      ],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// 모델 출력(JSON 문자열)을 안전하게 파싱·정규화.
function normalize(raw: string): OcrResult {
  let parsed: { track?: unknown; rows?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    // 혹시 코드펜스/잡텍스트가 섞이면 첫 JSON 객체만 추출.
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('AI 응답을 JSON으로 해석하지 못했습니다.');
    parsed = JSON.parse(m[0]);
  }
  const rowsIn = Array.isArray(parsed.rows) ? parsed.rows : [];
  const rows: OcrRow[] = rowsIn
    .map((r) => r as Record<string, unknown>)
    .map((r) => {
      const category = (CATEGORIES as readonly string[]).includes(String(r.category))
        ? String(r.category)
        : '기타';
      const name = String(r.name ?? '').trim() || category;
      const grade5 = Number(r.grade5);
      let credits = Number(r.credits);
      if (!Number.isFinite(credits) || credits <= 0) credits = 1;
      return { category, name, grade5, credits };
    })
    .filter((r) => Number.isFinite(r.grade5));
  const track = parsed.track === '인문' || parsed.track === '자연' ? parsed.track : undefined;
  return { rows, track };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'content-type': 'application/json' },
    });

  if (req.method !== 'POST') return respond({ error: 'POST only' }, 405);

  let imageBase64: string;
  let mimeType: string;
  try {
    const body = await req.json();
    imageBase64 = String(body.imageBase64 ?? '');
    mimeType = String(body.mimeType ?? 'image/jpeg');
    if (!imageBase64) return respond({ error: '이미지 데이터가 없습니다.' }, 400);
  } catch {
    return respond({ error: '요청 형식이 올바르지 않습니다.' }, 400);
  }

  const provider = pickProvider();
  if (!provider) {
    return respond(
      { error: 'OCR용 AI API 키가 설정되지 않았습니다. 관리자에게 문의해 주세요.' },
      503,
    );
  }

  try {
    const raw =
      provider === 'anthropic'
        ? await callAnthropic(imageBase64, mimeType)
        : provider === 'openai'
          ? await callOpenAI(imageBase64, mimeType)
          : await callGemini(imageBase64, mimeType);
    const result = normalize(raw);
    if (result.rows.length === 0) {
      return respond({ error: '이미지에서 성적을 인식하지 못했습니다. 더 선명한 이미지를 올려주세요.' }, 422);
    }
    return respond(result);
  } catch (e) {
    console.error('ocr-grades error', e);
    // 진단용: 상위 API 오류 요약을 함께 반환(앞 300자). 원인 파악 후 제거 가능.
    const detail = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    return respond(
      { error: '이미지 인식 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', detail },
      502,
    );
  }
});
