import { Hero } from '../components/ui/Hero';
import { Section } from '../components/ui/Section';
import { Card } from '../components/ui/Card';
import { LinkButton } from '../components/ui/Button';
import { HomeStepWheel } from '../components/HomeStepWheel';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

// 랜딩 페이지 — Hero + 5단계 전략 흐름(원형) + 주요 기능 카드 + 도구 CTA.

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
        actions={<LinkButton to="/tool" variant="primary">전략 도구 시작하기</LinkButton>}
      />

      <Section
        title="5단계로 끝내는 대입 전략"
        subtitle="성적을 한 번 입력하면, 아래 다섯 단계가 순서대로 이어집니다. 단계를 눌러 자세히 보세요."
        soft
      >
        <HomeStepWheel />
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
        soft
      >
        <LinkButton to="/tool" variant="primary">전략 도구로 이동</LinkButton>
      </Section>
    </main>
  );
}
