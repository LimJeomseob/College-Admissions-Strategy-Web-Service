import { supabase } from '../auth/supabaseClient';
import type { SubjectInput, Track } from '../types';

// 성적 캡쳐 이미지 → OCR → 성적 테이블.
// AI 호출은 Supabase Edge Function(ocr-grades)에서 수행하며, 키는 서버 secret으로 보관.
// 로그인 사용자만 사용 가능(함수 verify_jwt). 전송 전 이미지를 축소해 비용·용량을 줄인다.

export interface OcrGradeResult {
  rows: SubjectInput[];
  track?: Track;
}

const CATEGORIES: SubjectInput['category'][] = ['국어', '수학', '영어', '사회', '과학', '기타'];
const MAX_EDGE = 1600; // 긴 변 최대 픽셀

/** 이미지 파일을 캔버스로 축소해 JPEG base64(순수 데이터)와 mimeType 반환. */
async function downscaleToBase64(file: File): Promise<{ data: string; mimeType: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    fr.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('이미지를 열지 못했습니다.'));
    im.src = dataUrl;
  });

  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // 캔버스를 못 쓰면 원본을 그대로 사용.
    const [, b64] = dataUrl.split(',');
    return { data: b64 ?? '', mimeType: file.type || 'image/png' };
  }
  ctx.drawImage(img, 0, 0, w, h);
  const out = canvas.toDataURL('image/jpeg', 0.85);
  return { data: out.split(',')[1] ?? '', mimeType: 'image/jpeg' };
}

export function isImageFile(file: File): boolean {
  return /^image\//.test(file.type) || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(file.name);
}

export async function ocrGradeImage(file: File): Promise<OcrGradeResult> {
  if (!supabase) throw new Error('서버가 설정되지 않아 이미지 인식을 사용할 수 없습니다.');
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('이미지 인식은 로그인 후 이용할 수 있습니다.');

  const { data: imageBase64, mimeType } = await downscaleToBase64(file).then((r) => ({
    data: r.data,
    mimeType: r.mimeType,
  }));

  const { data, error } = await supabase.functions.invoke('ocr-grades', {
    body: { imageBase64, mimeType },
  });
  if (error) {
    // Edge Function이 4xx/5xx로 보낸 본문의 메시지를 우선 사용.
    let msg = '이미지 인식에 실패했습니다.';
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = await ctx.json();
        if (body?.error) msg = String(body.error);
        if (body?.detail) msg += ` (${String(body.detail)})`;
      } catch {
        /* noop */
      }
    }
    throw new Error(msg);
  }

  const rowsIn: unknown[] = Array.isArray(data?.rows) ? data.rows : [];
  const rows: SubjectInput[] = rowsIn
    .map((r) => r as Record<string, unknown>)
    .map((r) => {
      const category = CATEGORIES.includes(r.category as SubjectInput['category'])
        ? (r.category as SubjectInput['category'])
        : '기타';
      const grade5 = Number(r.grade5);
      let credits = Number(r.credits);
      if (!Number.isFinite(credits) || credits <= 0) credits = 1;
      return {
        category,
        name: String(r.name ?? '').trim() || category,
        grade5,
        credits,
      };
    })
    .filter((r) => Number.isFinite(r.grade5));

  if (rows.length === 0) {
    throw new Error('이미지에서 성적을 인식하지 못했습니다. 더 선명한 이미지를 올려주세요.');
  }
  const track: Track | undefined =
    data?.track === '인문' || data?.track === '자연' ? data.track : undefined;
  return { rows, track };
}
