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
              {!rec ? (
                <p className="muted">이 대학·학과는 추천 DB(권장과목 47개 대학)에 없습니다.</p>
              ) : !hasAny ? (
                <p className="muted">등록된 권장 선택과목이 없습니다.</p>
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
