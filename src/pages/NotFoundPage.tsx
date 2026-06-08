import { LinkButton } from '../components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="container notfound">
      <h1>404</h1>
      <p className="muted">요청하신 페이지를 찾을 수 없습니다.</p>
      <div style={{ marginTop: 'var(--space-4)' }}>
        <LinkButton to="/" variant="primary">홈으로</LinkButton>
      </div>
    </div>
  );
}
