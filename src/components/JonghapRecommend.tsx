import type { JonghapPick } from '../types';
import { recommendFor, type JonghapMap, type JonghapRec } from '../data/loadJonghapSubjects';

// 5단계 학생부종합전형 선택과목 추천 — 4단계에서 선택한 종합전형 항목별로
// 첨부 DB(public/jonghapSubjects.json)에서 핵심/권장/선택 과목을 안내.

interface Props {
  picks: JonghapPick[];
  map: JonghapMap;
  loading: boolean;
}

const KIND_CLASS: Record<keyof JonghapRec, string> = { 핵심: 'chip-core', 권장: 'chip-rec', 선택: 'chip-opt' };
const KINDS: (keyof JonghapRec)[] = ['핵심', '권장', '선택'];

// REQ-42 데이터 부재 시 확정 안내 문구
const NO_DATA_NOTE =
  '현재 학생의 성적으로는 종합전형보다 교과 전형을 선발하는 대학이 훨씬 많습니다. ' +
  '어떤 과목을 선택할지의 기준은 성적을 더 잘 올릴 수 있는 과목이냐가 중요한 기준이 됩니다. ' +
  '하지만 진로와 적성에 관심이 깊은 학생이라면 아래 과목을 선택하면 종합전형 지원에 더 유리할 수 있습니다. ' +
  '현재 이 대학·학과는 권장 과목을 발표하지 않았지만, 다른 대학에서 추천하는 과목들의 예시를 참고하여 정리하였습니다.';

export function JonghapRecommend({ picks, map, loading }: Props) {
  if (picks.length === 0) {
    return (
      <div className="panel">
        <h2>5단계 학생부종합전형 선택과목 추천</h2>
        <p className="muted">
          ‘4단계 지원 가능 대학·학과’ 표에서 <b>종합전형</b> 행을 클릭해 선택하면, 그 대학·학과의 권장 선택과목을 여기서 안내합니다.
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>5단계 학생부종합전형 선택과목 추천</h2>
      <p className="subtitle muted">
        선택 {picks.length}개 학과 · 2028 종합전형 권장 선택과목 기준 · 핵심 / 권장 / 선택
      </p>

      {loading && <p className="muted">추천 데이터를 불러오는 중…</p>}

      <div className="jonghap-cards">
        {picks.map((p, i) => {
          const rec = recommendFor(map, p.univName, p.dept);
          const hasAny = rec && KINDS.some((k) => rec[k].length > 0);
          return (
            <article key={i} className="jonghap-card">
              <header>
                <strong>{p.univName}</strong> · {p.dept}
                <span className="muted"> · {p.type.replace('전형', '')}{p.detail ? ` (${p.detail})` : ''}</span>
              </header>
              {!rec || !hasAny ? (
                <p className="jonghap-nodata">{NO_DATA_NOTE}</p>
              ) : (
                <div className="jonghap-kinds">
                  {KINDS.map((k) =>
                    rec[k].length > 0 ? (
                      <div key={k} className="jonghap-kind">
                        <span className="jonghap-kind-label">{k}</span>
                        <span className="jonghap-chips">
                          {rec[k].map((s, j) => (
                            <span key={j} className={`subject-chip ${KIND_CLASS[k]}`}>{s}</span>
                          ))}
                        </span>
                      </div>
                    ) : null,
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
