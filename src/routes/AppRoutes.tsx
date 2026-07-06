import { Navigate, Route, Routes } from 'react-router-dom';
import { PageShell } from '../components/layout/PageShell';
import { HomePage } from '../pages/HomePage';
import { ToolPage } from '../pages/ToolPage';
import { LoginPage } from '../pages/LoginPage';
import { AdminPage } from '../pages/AdminPage';
import { MyPage } from '../pages/MyPage';
import { RequireAdmin, RequireAuth, RequireProfile } from '../auth/guards';

// 라우트 구성 — HashRouter 하위(`#/tool` 형태)로 GitHub Pages 서브경로에서
// 딥링크 404 없이 동작. (main.tsx 에서 HashRouter 로 감쌈)
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PageShell />}>
        <Route index element={<HomePage />} />
        {/* 전략 도구는 회원가입(구글) 후 로그인한 사용자만 사용 가능 */}
        <Route path="tool" element={<RequireAuth><RequireProfile><ToolPage /></RequireProfile></RequireAuth>} />

        {/* Phase B — 인증/개인정보/관리자 */}
        <Route path="login" element={<LoginPage />} />
        <Route path="mypage" element={<RequireAuth><MyPage /></RequireAuth>} />
        <Route path="admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
