// 공개 경로 /agent/** (vercel.json의 rewrites로 이 함수까지 옴) 를
// 사내 API(BACKEND_API_ORIGIN)/agent/** 로 그대로 넘긴다.
import { proxyRequest, pathAndQuery } from '../_proxy.js';

export default async function handler(req, res) {
	const segments = Array.isArray(req.query.path) ? req.query.path : [req.query.path];
	const backendPath = '/agent' + pathAndQuery(req, segments);
	await proxyRequest(req, res, backendPath);
}
