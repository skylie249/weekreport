// 공개 경로 /agent/** 전체를 사내 API(BACKEND_API_ORIGIN)/agent/** 로 그대로 넘긴다.
// vercel.json의 rewrites("/agent/:path*" -> "/api/agent-proxy?path=:path*")가 이 함수로 보낸다.
import { proxyRequest } from './_proxy.js';

export default async function handler(req, res) {
	await proxyRequest(req, res, '/agent');
}
