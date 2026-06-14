// 대학별 상세 DB(public/data/universityDetails.json) 접근.
// 최초 1회 lazy fetch + 캐시. 카드/행 클릭 시점에만 로드해 초기 번들에 영향 없음.

type DetailMap = Record<string, string>;

let cache: DetailMap | null = null;
let inflight: Promise<DetailMap> | null = null;

function load(): Promise<DetailMap> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    const url = `${import.meta.env.BASE_URL}data/universityDetails.json`;
    inflight = fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<DetailMap>) : ({} as DetailMap)))
      .then((d) => {
        cache = d;
        return d;
      })
      .catch(() => {
        cache = {};
        return cache;
      });
  }
  return inflight;
}

/** 캠퍼스 접미사(예: "(세종)", "(천안)", "(ERICA)") 제거해 기본 대학명으로 매칭 */
export function normalizeUnivName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/** 대학명으로 상세 HTML을 찾는다. 없으면 null. */
export async function getUniversityDetail(univName: string): Promise<string | null> {
  const all = await load();
  return all[univName] ?? all[normalizeUnivName(univName)] ?? null;
}
