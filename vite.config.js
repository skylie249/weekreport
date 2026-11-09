import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vercel에 올라가는 독립 화면. 빌드 결과(dist)는 Vercel이 그대로 서빙하고,
// /api, /agent 요청은 vercel.json의 rewrites를 통해 api/ 폴더의 프록시 함수로 간다.
// 로컬 개발(npm run dev)에서는 사내 Java 백엔드(기본 8879)를 그대로 바라보도록 proxy를 둔다.
export default defineConfig({
	plugins: [react()],
	server: {
		proxy: {
			'/api': {
				target: process.env.WR_DEV_BACKEND || 'http://localhost:8879',
				changeOrigin: true
			},
			'/agent': {
				target: process.env.WR_DEV_BACKEND || 'http://localhost:8879',
				changeOrigin: true
			}
		}
	}
});
