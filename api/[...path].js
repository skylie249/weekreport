// 공개 경로 /api/** 전체를 사내 API(BACKEND_API_ORIGIN)/api/** 로 그대로 넘긴다.
import { proxyRequest, pathAndQuery } from './_proxy.js';

export default async function handler(req, res) {
	const segments = Array.isArray(req.query.path) ? req.query.path : [req.query.path];
	const backendPath = '/api' + pathAndQuery(req, segments);
	await proxyRequest(req, res, backendPath);
}
