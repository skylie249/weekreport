// api/proxy.js, api/agent-proxy.js 공용 프록시 로직.
// vercel.json의 rewrites가 원래 경로를 ?path=... 쿼리로 넘겨주므로(캐치올 동적 파일명은
// Vercel이 한 단계짜리 세그먼트로만 라우팅을 생성해 2단계 이상 경로가 404가 나는 문제가 있어
// 고정 파일명 + 쿼리스트링 방식으로 우회함), 여기서 그 path로 사내 API 경로를 재구성한다.
// Cloudflare Access 뒤의 사내 API(BACKEND_API_ORIGIN)로 요청을 그대로 넘기고,
// 로그인 세션 쿠키(Set-Cookie 포함)를 그대로 왕복시킨다.
export async function proxyRequest(req, res, prefix) {
	const backendOrigin = process.env.BACKEND_API_ORIGIN;
	if (!backendOrigin) {
		res.status(500).json({ error: 'BACKEND_API_ORIGIN 환경변수가 설정되지 않았습니다.' });
		return;
	}

	const { path = '', ...query } = req.query;
	const qs = new URLSearchParams(query).toString();
	const target = backendOrigin.replace(/\/$/, '') + prefix + '/' + path + (qs ? '?' + qs : '');

	const headers = {};
	if (req.headers.cookie) headers.cookie = req.headers.cookie;
	if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
	if (req.headers.authorization) headers.authorization = req.headers.authorization;
	if (process.env.CF_ACCESS_CLIENT_ID) headers['CF-Access-Client-Id'] = process.env.CF_ACCESS_CLIENT_ID;
	if (process.env.CF_ACCESS_CLIENT_SECRET) headers['CF-Access-Client-Secret'] = process.env.CF_ACCESS_CLIENT_SECRET;

	const hasBody = !['GET', 'HEAD'].includes(req.method);
	const upstream = await fetch(target, {
		method: req.method,
		headers,
		body: hasBody ? JSON.stringify(req.body ?? {}) : undefined
	});

	res.status(upstream.status);

	// undici(Node 18+)는 getSetCookie()로 여러 Set-Cookie를 분리해 돌려준다.
	const setCookies =
		typeof upstream.headers.getSetCookie === 'function'
			? upstream.headers.getSetCookie()
			: upstream.headers.get('set-cookie')
				? [upstream.headers.get('set-cookie')]
				: [];
	if (setCookies.length) res.setHeader('set-cookie', setCookies);

	const contentType = upstream.headers.get('content-type');
	if (contentType) res.setHeader('content-type', contentType);

	const body = await upstream.text();
	res.send(body);
}
