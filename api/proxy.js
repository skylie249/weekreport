// 공개 경로 /api/** 전체를 사내 API(BACKEND_API_ORIGIN)/api/** 로 그대로 넘긴다.
// vercel.json의 rewrites("/api/:path*" -> "/api/proxy?path=:path*")가 이 함수로 보낸다.
import { proxyRequest } from './_proxy.js';

export default async function handler(req, res) {
	await proxyRequest(req, res, '/api');
}
