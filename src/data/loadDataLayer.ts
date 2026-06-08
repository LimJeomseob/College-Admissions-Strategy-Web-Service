import type { DataLayer } from '../types';

// ETL 산출물(public/data/dataLayer.json)을 클라이언트에서 로드.
// base 경로(vite)와 합쳐 GitHub Pages 서브경로에서도 동작하도록 import.meta.env.BASE_URL 사용.
export async function loadDataLayer(): Promise<DataLayer> {
  const url = `${import.meta.env.BASE_URL}data/dataLayer.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`데이터 레이어 로드 실패: ${res.status} ${url}`);
  }
  return (await res.json()) as DataLayer;
}
