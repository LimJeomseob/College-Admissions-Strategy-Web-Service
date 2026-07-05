import { useState } from 'react';

// 홈 "5단계로 끝내는 대입 전략" — 원형(원그래프) 배치 + 시계방향 화살표 흐름.
// 노드를 호버/클릭하면 아래 상세 영역에 해당 단계 설명이 표시된다.

interface Step {
  short: string; // 노드 라벨(짧게)
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    short: '성적입력',
    title: '성적 입력',
    body: '5등급제 내신을 직접 입력하거나 성적표 파일·이미지(자동 인식)를 올리면 입력 표가 채워집니다. 희망학과도 함께 입력해요.',
  },
  {
    short: '성적환산',
    title: '성적 체계 환산',
    body: '입력한 5등급 평균을 과거 9등급 입결 체계로 환산합니다. 기관·모형별 참고 범위까지 함께 보여줍니다.',
  },
  {
    short: '교과전략',
    title: '교과전형 준비전략',
    body: '환산된 내 위치를 기준으로 지원 가능한 대학을 안정·적정·소신으로 분류해 추천하고, 지원할 대학을 골라 담습니다.',
  },
  {
    short: '지원가능',
    title: '지원 가능 대학·학과',
    body: '선택한 대학의 학과별·연도별 입결(50%컷·70%컷)을 한 표로 정리해, 어디까지 가능한지 한눈에 비교합니다.',
  },
  {
    short: '종합선택',
    title: '학생부종합전형 선택과목 추천',
    body: '종합전형으로 노리는 학과를 고르면, 그 학과가 권장하는 선택과목(핵심·권장)을 안내해 과목 선택을 돕습니다.',
  },
];

const R = 38; // 노드 반지름(%, 컨테이너 기준)
const RAD = Math.PI / 180;
const angleOf = (i: number) => -90 + (360 / STEPS.length) * i; // 12시부터 시계방향

export function HomeStepWheel() {
  const [active, setActive] = useState(0);

  const nodes = STEPS.map((s, i) => {
    const a = angleOf(i) * RAD;
    return { ...s, i, x: 50 + R * Math.cos(a), y: 50 + R * Math.sin(a) };
  });

  // 연속 노드 사이(마지막→처음 제외) 화살표 — 원호 중간지점, 접선(시계방향) 방향.
  const arrows = STEPS.slice(0, -1).map((_, i) => {
    const mid = angleOf(i + 0.5);
    const a = mid * RAD;
    return { i, x: 50 + R * Math.cos(a), y: 50 + R * Math.sin(a), rot: mid + 90 };
  });

  const cur = STEPS[active];

  return (
    <div className="step-wheel-wrap">
      <div className="step-wheel">
        <svg className="step-wheel-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r={R} className="wheel-ring-circle" />
          {arrows.map((ar) => (
            <polygon
              key={ar.i}
              points="-3.4,-3 3.4,0 -3.4,3"
              className="wheel-arrow"
              transform={`translate(${ar.x} ${ar.y}) rotate(${ar.rot})`}
            />
          ))}
        </svg>

        {nodes.map((n) => (
          <button
            key={n.i}
            type="button"
            className={`wheel-node${active === n.i ? ' active' : ''}`}
            style={{ left: `${n.x}%`, top: `${n.y}%` }}
            onMouseEnter={() => setActive(n.i)}
            onFocus={() => setActive(n.i)}
            onClick={() => setActive(n.i)}
            aria-label={`${n.i + 1}단계 ${n.title}`}
            aria-pressed={active === n.i}
          >
            <span className="wheel-node-num">{n.i + 1}</span>
            <span className="wheel-node-label">{n.short}</span>
          </button>
        ))}

        <div className="wheel-center" aria-hidden="true">
          <span className="wheel-center-kicker">STEP</span>
          <span className="wheel-center-num">{active + 1}</span>
          <span className="wheel-center-total">/ {STEPS.length}</span>
        </div>
      </div>

      <div className="step-wheel-detail" key={active} aria-live="polite">
        <h3>
          <span className="detail-badge">{active + 1}</span> {cur.title}
        </h3>
        <p>{cur.body}</p>
      </div>
    </div>
  );
}
