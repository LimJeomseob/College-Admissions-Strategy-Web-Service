import { Hero } from '../components/ui/Hero';
import { Section } from '../components/ui/Section';
import { Card } from '../components/ui/Card';
import { LinkButton } from '../components/ui/Button';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

// 랜딩 페이지 — 네이비 Hero + 기능 소개 카드 + 도구 CTA.
const FEATURES = [
  {
    icon: '📊',
    title: '5등급 → 9등급 환산',
    body: '내신 5등급제 성적을 과거 9등급 입결 체계에 투영해 현재 위치를 가늠합니다.',
  },
  {
    icon: '🎯',
    title: '지원 가능권 매칭',
    body: '안정·적정·소신 구간으로 지원 가능 대학·학과를 한눈에 분류해 보여줍니다.',
  },
  {
    icon: '🗂️',
    title: '성적표 파일 업로드',
    body: 'CSV·엑셀·텍스트 성적 파일을 올리면 입력 표를 자동으로 채워 줍니다.',
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
        title={<>5등급제 내신으로 그리는<br />데이터 기반 대입 전략</>}
        subtitle="성적 입력 한 번으로 지원 가능 대학·학과와 교과전형 준비전략을 안내합니다. 과거 입결에 현재 위치를 투영한 참고 지표입니다."
        actions={
          <>
            <LinkButton to="/tool" variant="primary">전략 도구 시작하기</LinkButton>
            <LinkButton to="/tool" variant="secondary">성적 입력해 보기</LinkButton>
          </>
        }
      />

      <Section title="무엇을 도와드리나요?" soft>
        <div className="home-feature-grid">
          {FEATURES.map((f) => (
            <Card key={f.title} icon={f.icon} title={f.title}>
              {f.body}
            </Card>
          ))}
        </div>
      </Section>

      <Section title="지금 바로 분석해 보세요" subtitle="성적만 입력하면 됩니다. 데이터는 서버에 저장되지 않는 세션 입력입니다.">
        <LinkButton to="/tool" variant="primary">전략 도구로 이동</LinkButton>
      </Section>
    </main>
  );
}
