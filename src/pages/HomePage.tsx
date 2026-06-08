import { Hero } from '../components/ui/Hero';
import { Section } from '../components/ui/Section';
import { Card } from '../components/ui/Card';
import { LinkButton } from '../components/ui/Button';

const FEATURES = [
  { icon: '🎯', title: '5등급 → 9등급 환산', desc: '내 5등급제 성적을 누적된 9등급 입결 기준으로 투영해 위치를 가늠합니다.' },
  { icon: '🏫', title: '지원 가능권 매칭', desc: '안정·적정·소신 3구간으로 지원 가능한 대학·학과를 자동 분류합니다.' },
  { icon: '📚', title: '교과전형 전략', desc: '대학별 반영방법에 성적을 재투영해 유불리를 진단합니다.' },
  { icon: '📄', title: '파일로 간편 입력', desc: '엑셀·CSV·텍스트 파일을 올리면 성적표가 자동으로 채워집니다.' },
];

const STEPS = [
  { n: 1, title: '성적 입력', desc: '과목별 5등급과 단위수를 입력하거나 파일을 업로드합니다.' },
  { n: 2, title: '희망학과 설정', desc: '희망학과를 적으면 관련 계열을 반영해 결과를 정렬합니다.' },
  { n: 3, title: '전략 확인', desc: '지원 가능권과 교과전형 준비 전략을 한눈에 확인합니다.' },
];

export function HomePage() {
  return (
    <>
      <Hero
        title={<>5등급제 성적으로 그리는<br />나의 대입 전략</>}
        subtitle="흩어진 입결 데이터를 한 흐름으로. 성적 입력 한 번으로 지원 가능 대학·학과와 교과전형 준비 전략을 안내합니다."
        cta={
          <>
            <LinkButton to="/tool" variant="primary">내 성적 분석하기</LinkButton>
            <a className="btn btn-secondary" href="#how">이용 방법 보기</a>
          </>
        }
      />

      <Section eyebrow="WHY" title="왜 필요한가요?" tone="default">
        <p className="muted" style={{ maxWidth: 720, marginTop: 0 }}>
          2028 대입 학생은 5등급제로 성적을 받지만, 축적된 수시 입결 자료는 모두 9등급제 기준입니다.
          이 ‘환산 단절’을 해소하고, 성적입력 → 환산 → 지원리스트 → 전형전략으로 이어지는
          의사결정 흐름을 제공합니다.
        </p>
        <div className="feature-grid" style={{ marginTop: 'var(--space-5)' }}>
          {FEATURES.map((f) => (
            <Card key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="how" eyebrow="HOW" title="이용 방법" tone="soft">
        <div className="feature-grid">
          {STEPS.map((s) => (
            <Card key={s.n} className="feature-card">
              <span className="step-num">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </Card>
          ))}
        </div>
        <div style={{ marginTop: 'var(--space-6)' }}>
          <LinkButton to="/tool" variant="primary">지금 시작하기</LinkButton>
        </div>
      </Section>
    </>
  );
}
