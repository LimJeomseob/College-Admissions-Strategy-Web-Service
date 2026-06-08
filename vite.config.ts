import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages는 https://<user>.github.io/<repo>/ 경로로 서빙되므로 base를 저장소명으로 설정.
// 사용자 정의 도메인/루트 배포 시 base를 '/'로 변경.
export default defineConfig({
  base: '/College-Admissions-Strategy-Web-Service/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
  },
});
