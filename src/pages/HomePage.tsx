import { Hero } from '../components/ui/Hero';
import { Section } from '../components/ui/Section';
import { Card } from '../components/ui/Card';
import { LinkButton } from '../components/ui/Button';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

// 랜딩 페이지 — Hero + 5단계 전략 설명 + 주요 기능 카드 + 도구 CTA.

const STEPS = [
  {
    title: '성적 입력',
    body: '5등급제 내신을 직접 입력하거나 성적표 파일·이미지(자동 인식)를 올리면 입력 표가 채워집니다. 희망학과도 함께 입력해요.',
  },
  {
    title: '성적 체계 환산',
    body: '입력한 5등급 평균을 과거 9등급 입결 체계로 환산합니다. 기관·모형별 참고 범위까지 함께 보여줍니다.',
  },
  {
    title: '교과전형 준비전략',
    body: '환산된 내 위치를 기준으로 지원 가능한 대학을 안정·적정·소신으로 분류해 추천하고, 지원할 대학을 골라 담습니다.',
  },
  {
    title: '지원 가능 대학·학과',
    body: '선택한 대학의 학과별·연도별 입결(50%컷·70%컷)을 한 표로 정리해, 어디까지 가능한지 한눈에 비교합니다.',
  },
  {
    title: '학생부종합전형 선택과목 추천',
    body: '종합전형으로 노리는 학과를 고르면, 그 학과가 권장하는 선택과목(핵심·권장)을 안내해 과목 선택을 돕습니다.',
  },
];

const FEATURES = [
  {
    icon: '📊',
    title: '5등급 → 9등급 환산',
    body: '내신 5등급제 성적을 과거 9등급 입결 체계에 투영해 현재 위치를 가늠합니다.',
  },
  {
    icon: '🎯',
    title: '안정·적정·소신 분류',
    body: '지원 가능 대학·학과를 세 구간으로 분류해 전략적으로 배치하도록 돕습니다.',
  },
  {
    icon: '🗂️',
    title: '성적표 업로드·인식',
    body: 'CSV·엑셀·텍스트 파일은 물론 성적표 이미지도 자동 인식해 입력을 채워 줍니다.',
  },
  {
    icon: '🧭',
    title: '희망학과 계열 연동',
    body: '희망학과를 입력하면 관련 계열·학과를 우선 정렬해 전략 수립을 돕습니다.',
  },
];

export function HomePage() {
  useDocumentTitle();
  return (
    <main>
      <Hero
        title={<>5등급제 내신으로 그리는<br className="br-md" />데이터 기반 대입 전략</>}
        subtitle={
          <>
            성적 입력 한 번으로 지원 가능 대학·학과부터 교과전형 준비전략,
            종합전형 선택과목 추천까지 한 흐름으로 안내합니다.
            <br className="br-md" />
            과거 입결에 현재 위치를 투영한 참고 지표예요.
          </>
        }
        actions={
          <>
            <LinkButton to="/tool" variant="primary">전략 도구 시작하기</LinkButton>
            <LinkButton to="/tool" variant="secondary">성적 입력해 보기</LinkButton>
          </>
        }
      />

      <Section
        title="5단계로 끝내는 대입 전략"
        subtitle="성적을 한 번 입력하면, 아래 다섯 단계가 자동으로 이어집니다."
        soft
      >
        <ol className="home-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="home-step">
              <span className="home-step-num" aria-hidden>{i + 1}</span>
              <div className="home-step-body">
                <h3 className="home-step-title">{s.title}</h3>
                <p className="home-step-desc">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="주요 기능">
        <div className="home-feature-grid">
          {FEATURES.map((f) => (
            <Card key={f.title} icon={f.icon} title={f.title}>
              {f.body}
            </Card>
          ))}
        </div>
      </Section>

      <Section
        title="지금 바로 분석해 보세요"
        subtitle="성적만 입력하면 됩니다. 데이터는 서버에 저장되지 않는 세션 입력입니다."
        soft
      >
        <LinkButton to="/tool" variant="primary">전략 도구로 이동</LinkButton>
      </Section>
    </main>
  );
}
