import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { DataLayer } from '../../src/types';

export const OUTPUT_PATH = resolve(process.cwd(), 'public/data/dataLayer.json');

export function writeDataLayer(layer: DataLayer): void {
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(layer, null, 2), 'utf-8');
  console.log(
    `✓ dataLayer.json 생성 (${layer.meta.source}) — 입결 ${layer.admissions.length}행, ` +
      `교과전형 ${layer.subjectTrack.length}행, 환산표 ${layer.conversion.length}행`,
  );
}

/** 보고서 6장 정합성 검증: 입결 ↔ 교과전형 조인 매칭률 */
export function verifyJoins(layer: DataLayer): void {
  const admissionUnivs = new Set(
    layer.admissions.filter((a) => a.admissionType === '학생부교과').map((a) => a.univCode),
  );
  const trackUnivs = new Set(layer.subjectTrack.map((t) => t.univCode));
  const matched = [...trackUnivs].filter((u) => admissionUnivs.has(u)).length;
  const total = trackUnivs.size;
  const rate = total > 0 ? ((matched / total) * 100).toFixed(0) : '0';
  const ok = matched === total;
  console.log(`${ok ? '✓' : '⚠'} 입결 ↔ 교과전형 매칭: ${matched}/${total} (${rate}%)`);
  if (!ok) {
    const missing = [...trackUnivs].filter((u) => !admissionUnivs.has(u));
    console.warn(`  미매칭 univCode: ${missing.join(', ')}`);
  }
}
