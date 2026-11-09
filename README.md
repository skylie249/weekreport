# weekreport-frontend

주간보고 등록 화면(React, Vite). `weekreport_register`(Java/Spring MVC 백엔드)에서 분리된
독립 저장소로, Vercel에 올리는 것을 목표로 한다. 이 폴더에는 비밀값·DB 정보가 없다.

- 원본(백엔드와 같은 저장소에 있던) 화면: `../weekreport_register/frontend/`.
  DNS 전환(`weekreport.nexalab.app` → Vercel) 전까지는 그쪽이 계속 운영 중인 화면이다.
  전환이 끝나면 그 폴더는 삭제 대상(SESSION_PLAN.md F5 참고).

## 개발

```bash
npm install
npm run dev      # 로컬 Java 백엔드(기본 http://localhost:8879)로 /api, /agent 프록시
npm run build     # dist/ 생성
```

로컬 백엔드 주소가 다르면 `WR_DEV_BACKEND` 환경변수로 바꿀 수 있다.

## Vercel 배포 구조

브라우저는 항상 같은 origin(`/api/**`, `/agent/**`)으로 요청한다. Vercel이 그 요청을
사내 API(Cloudflare Tunnel 뒤, `api.weekreport.nexalab.app`)로 서버 사이드에서 그대로 넘긴다.

- `api/[...path].js` — `/api/**` 요청을 처리 (Vercel이 `api/` 폴더를 자동으로 라우팅)
- `api/agent/[...path].js` — `/agent/**` 요청을 처리. `vercel.json`의 rewrites로
  공개 경로 `/agent/:path*` → `/api/agent/:path*`로 내부 전달한 뒤 이 함수가 받는다.
- `api/_proxy.js` — 두 함수가 공유하는 프록시 로직 (세션 쿠키 왕복, Cloudflare Access
  서비스 토큰 헤더 부착)

### 필요한 환경변수 (Vercel 프로젝트 설정에 등록, `.env.example` 참고)

| 변수 | 용도 |
| --- | --- |
| `BACKEND_API_ORIGIN` | 사내 API 터널 주소 |
| `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` | API 앞단 Cloudflare Access 서비스 토큰 |

### 아직 실제로 확인되지 않은 것

이 프록시 함수들은 로컬에서 Vercel 배포 환경(Cloudflare Access, 실제 터널)을 재현해
테스트할 수 없어 **코드만 작성된 상태**다. 실제 배포 후 반드시 확인할 것:

1. 로그인 → 세션 쿠키가 브라우저에 `Set-Cookie`로 정상 저장되는지 (여러 개의
   Set-Cookie 헤더가 합쳐지지 않고 각각 전달되는지)
2. Cloudflare Access 서비스 토큰 헤더로 API 응답이 401 대신 정상 응답을 받는지
3. 로그인 시도 제한(IP 기준)이 `CF-Connecting-IP` 등 실제 사용자 IP를 보도록
   백엔드 쪽도 맞춰졌는지 (백엔드 쪽은 이 저장소 범위 밖, `weekreport_register` 쪽 작업)

세부 전환 절차·도메인 배치는 `../SESSION_PLAN.md`의 F5 세션 설명을 따른다.
