import { Routes, Route } from 'react-router-dom';
import { PageShell } from '../components/layout/PageShell';
import { HomePage } from '../pages/HomePage';
import { ToolPage } from '../pages/ToolPage';
import { NotFoundPage } from '../pages/NotFoundPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PageShell />}>
        <Route index element={<HomePage />} />
        <Route path="tool" element={<ToolPage />} />
        {/* Phase B (Supabase):
            <Route path="login" element={<LoginPage />} />
            <Route path="mypage" element={<RequireAuth><MyPage /></RequireAuth>} />
            <Route path="admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} /> */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
