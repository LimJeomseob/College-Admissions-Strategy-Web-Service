import { Navigate, Route, Routes } from 'react-router-dom';
import { PageShell } from '../components/layout/PageShell';
import { ToolPage } from '../pages/ToolPage';

// 라우트 구성 — HashRouter 하위(`#/tool` 형태)로 GitHub Pages 서브경로에서
// 딥링크 404 없이 동작. (main.tsx 에서 HashRouter 로 감쌈)
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PageShell />}>
        {/* 커밋 2에서 랜딩(HomePage)으로 교체 — 현재는 도구로 리다이렉트 */}
        <Route index element={<Navigate to="/tool" replace />} />
        <Route path="tool" element={<ToolPage />} />

        {/* Phase B 라우트 스텁 (Supabase 설정 완료 후 구현)
        <Route path="login" element={<LoginPage />} />
        <Route path="mypage" element={<RequireAuth><MyPage /></RequireAuth>} />
        <Route path="admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
        */}

        <Route path="*" element={<Navigate to="/tool" replace />} />
      </Route>
    </Routes>
  );
}
