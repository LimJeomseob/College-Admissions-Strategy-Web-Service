// ai-guidance — 5단계 선택과목 AI 근거 설명(REQ-41) + 최종 보고서 AI 자동생성(REQ-50).
//
// 보안: AI API 키는 이 함수의 Edge secret으로만 보관(클라이언트 번들 미노출).
//   - 셋 중 설정된 키를 자동 감지: GEMINI_API_KEY → OPENAI_API_KEY → ANTHROPIC_API_KEY
//   - AI_PROVIDER(gemini|openai|anthropic), AI_MODEL 로 강제·재정의 가능.
// 인증: verify_jwt=true (로그인 사용자만). 클라이언트는 supabase.functions.invoke 로 호출.
//
// 요청 body: { task: 'subjects' | 'report', payload: {...} }
//   - subjects (REQ-41): { univName, dept, track?, desiredMajor? }
//       → { 핵심:[], 권장:[], 선택:[], reason }  (타 대학 자료 근거)
//   - report   (REQ-50): { est9, refRange?, averages?, desiredMajor?, track?,
//                          universities:[{name}], jonghap:[{univName,dept,type,subjects?}], triageMessage? }
//       → { summary, universities:[{name,type,note,subjects[]}], advice:[] }

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Provider = 'anthropic' | 'openai' | 'gemini';

function pickProvider(): Provider | null {
  const forced = Deno.env.get('AI_PROVIDER');
  if (forced === 'anthropic' || forced === 'openai' || forced === 'gemini') return forced;
  // 자동 감지: Gemini 우선(현재 운영 키). 이후 OpenAI → Anthropic.
  if (Deno.env.get('GEMINI_API_KEY')) return 'gemini';
  if (Deno.env.get('OPENAI_API_KEY')) return 'openai';
  if (Deno.env.get('ANTHROPIC_API_KEY')) return 'anthropic';
  return null;
}

// ── 프롬프트 구성 ──
function buildPrompts(task: string, payload: Record<string, unknown>): { system: string; user: string } {
  if (task === 'subjects') {
    const { univName, dept, track, desiredMajor } = payload as {
      univName?: string; dept?: string; track?: string; desiredMajor?: string;
    };
    const system =
      '너는 한국 대입 학생부종합전형 선택과목 컨설턴트다. ' +
      '학생이 고른 대학·학과는 아직 권장 선택과목을 공식 발표하지 않았다. ' +
      '숙명여대·동국대 등 계열·전공이 유사한 다른 대학이 실제로 권장하는 선택과목을 근거로 들어, ' +
      '이 학과 지원에 유리한 고교 선택과목을 정리한다. ' +
      '핵심(가장 중요)·권장(도움)·선택(관심 시) 3단계로 과목명을 분류하고, ' +
      'reason에는 어떤 대학의 어떤 자료를 참고했는지와 추천 근거를 2~4문장으로 설명한다. ' +
      '과목명은 실제 고교 교육과정 과목명(예: 미적분, 물리학Ⅰ, 사회·문화, 화학Ⅱ)으로 쓴다. ' +
      '설명·인사말·코드블록(```) 없이 순수 JSON 객체 하나만 출력한다. ' +
      '형태: {"핵심": [], "권장": [], "선택": [], "reason": ""}';
    const user =
      `대학: ${univName ?? ''}\n모집단위(학과): ${dept ?? ''}\n` +
      `계열: ${track ?? '미상'}\n학생 희망학과: ${desiredMajor ?? '미입력'}\n` +
      '이 학과의 학생부종합전형에 유리한 선택과목을 타 대학 자료를 근거로 추천해줘.';
    return { system, user };
  }

  // task === 'report'
  const p = payload as {
    est9?: number; refRange?: { min: number; max: number } | null;
    averages?: Record<string, number | null>; desiredMajor?: string; track?: string;
    universities?: { name: string }[];
    jonghap?: { univName: string; dept: string; type?: string; subjects?: string[] }[];
    triageMessage?: string;
  };
  const system =
    '너는 한국 대입 컨설턴트다. 학생의 진단 데이터와 선택 대학을 바탕으로 최종 상담 보고서를 작성한다. ' +
    'summary에는 현재 성적 위치(9등급 환산)와 전반적 지원 방향을 3~5문장으로 요약한다. ' +
    'universities에는 학생이 선택한 각 대학을, 성적대에 비춰 교과전형·종합전형 중 어느 쪽이 유리한지 ' +
    'type을 "교과"/"종합"/"교과·종합" 중 하나로 판단해 담고, note에 한두 문장 조언을, ' +
    'subjects에는 종합전형 대비 권장 선택과목(있으면)을 넣는다. ' +
    'advice에는 학생이 지금부터 실천할 조언을 3~5개 항목의 문장 배열로 담는다. ' +
    '설명·인사말·코드블록(```) 없이 순수 JSON 객체 하나만 출력한다. ' +
    '형태: {"summary": "", "universities": [{"name": "", "type": "교과", "note": "", "subjects": []}], "advice": []}';
  const rangeText = p.refRange ? `${p.refRange.min}~${p.refRange.max}` : String(p.est9 ?? '');
  const jonghapText = (p.jonghap ?? [])
    .map((j) => `- ${j.univName} ${j.dept} (${j.type ?? '종합'})${j.subjects?.length ? ` 권장과목: ${j.subjects.join(', ')}` : ''}`)
    .join('\n');
  const user =
    `9등급 환산 성적: 약 ${rangeText}등급\n` +
    `계열: ${p.track ?? '미상'}\n희망학과: ${p.desiredMajor ?? '미입력'}\n` +
    `${p.triageMessage ? `전형 분기 안내: ${p.triageMessage}\n` : ''}` +
    `선택 대학: ${(p.universities ?? []).map((u) => u.name).join(', ') || '없음'}\n` +
    `${jonghapText ? `종합전형 선택 학과:\n${jonghapText}\n` : ''}` +
    '위 내용을 바탕으로 최종 보고서를 JSON으로 작성해줘.';
  return { system, user };
}

// ── Google Gemini (text) ──
async function callGemini(system: string, user: string): Promise<string> {
  const key = Deno.env.get('GEMINI_API_KEY')!;
  const model = Deno.env.get('AI_MODEL') ?? 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ── OpenAI ──
async function callOpenAI(system: string, user: string): Promise<string> {
  const key = Deno.env.get('OPENAI_API_KEY')!;
  const model = Deno.env.get('AI_MODEL') ?? 'gpt-4o';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}

// ── Anthropic ──
async function callAnthropic(system: string, user: string): Promise<string> {
  const key = Deno.env.get('ANTHROPIC_API_KEY')!;
  const model = Deno.env.get('AI_MODEL') ?? 'claude-opus-4-8';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      system: `${system} 반드시 순수 JSON 객체 하나만 출력한다.`,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const block = (json.content ?? []).find((b: { type: string }) => b.type === 'text');
  return block?.text ?? '';
}

// 모델 출력(JSON 문자열)을 안전하게 파싱.
function parseJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('AI 응답을 JSON으로 해석하지 못했습니다.');
    return JSON.parse(m[0]);
  }
}

const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x ?? '').trim()).filter(Boolean) : [];

// task별 응답 정규화(클라이언트 계약 보장).
function normalize(task: string, parsed: Record<string, unknown>): Record<string, unknown> {
  if (task === 'subjects') {
    return {
      핵심: strArr(parsed['핵심']),
      권장: strArr(parsed['권장']),
      선택: strArr(parsed['선택']),
      reason: String(parsed['reason'] ?? '').trim(),
    };
  }
  const univsIn = Array.isArray(parsed.universities) ? parsed.universities : [];
  const universities = univsIn.map((u) => {
    const r = u as Record<string, unknown>;
    const type = ['교과', '종합', '교과·종합'].includes(String(r.type)) ? String(r.type) : '교과';
    return {
      name: String(r.name ?? '').trim(),
      type,
      note: String(r.note ?? '').trim(),
      subjects: strArr(r.subjects),
    };
  }).filter((u) => u.name);
  return {
    summary: String(parsed.summary ?? '').trim(),
    universities,
    advice: strArr(parsed.advice),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'content-type': 'application/json' },
    });

  if (req.method !== 'POST') return respond({ error: 'POST only' }, 405);

  let task: string;
  let payload: Record<string, unknown>;
  try {
    const body = await req.json();
    task = String(body.task ?? '');
    payload = (body.payload ?? {}) as Record<string, unknown>;
    if (task !== 'subjects' && task !== 'report') {
      return respond({ error: 'task는 subjects 또는 report여야 합니다.' }, 400);
    }
  } catch {
    return respond({ error: '요청 형식이 올바르지 않습니다.' }, 400);
  }

  const provider = pickProvider();
  if (!provider) {
    return respond({ error: 'AI API 키가 설정되지 않았습니다. 관리자에게 문의해 주세요.' }, 503);
  }

  try {
    const { system, user } = buildPrompts(task, payload);
    const raw =
      provider === 'anthropic'
        ? await callAnthropic(system, user)
        : provider === 'openai'
          ? await callOpenAI(system, user)
          : await callGemini(system, user);
    return respond(normalize(task, parseJson(raw)));
  } catch (e) {
    console.error('ai-guidance error', e);
    const detail = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    return respond({ error: 'AI 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', detail }, 502);
  }
});
