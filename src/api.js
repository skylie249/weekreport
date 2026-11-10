// 백엔드는 세션 쿠키로 로그인 상태를 유지하므로 모든 요청에 credentials: 'include'가 필요하다.
async function request(path, options = {}) {
	const res = await fetch(path, {
		credentials: 'include',
		headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
		...options
	});

	if (res.status === 401) {
		return { __sessionout: true };
	}
	if (!res.ok) {
		throw new Error('HTTP ' + res.status);
	}
	return res.json();
}

// /agent/** 호출마다 쓸 서명 토큰(5분 유효)을 매번 새로 받아온다. 호출 빈도가 낮아
// 캐싱의 이득보다 만료 경계 처리의 복잡함이 더 커서, 단순하게 매번 발급받는 쪽을 택했다.
async function agentToken() {
	const res = await fetch('/api/agent-token', { method: 'POST', credentials: 'include' });
	if (res.status === 401) {
		return { __sessionout: true };
	}
	if (!res.ok) {
		throw new Error('HTTP ' + res.status);
	}
	return res.json();
}

async function agentRequest(path, options = {}) {
	const tokenRes = await agentToken();
	if (tokenRes.__sessionout) {
		return { __sessionout: true };
	}
	if (tokenRes.result !== 'SUCCESS') {
		return { result: 'agent_disabled', message: tokenRes.message };
	}

	const res = await fetch('/agent' + path, {
		credentials: 'include',
		...options,
		headers: {
			...(options.body ? { 'Content-Type': 'application/json' } : undefined),
			Authorization: 'Bearer ' + tokenRes.token
		}
	});

	if (res.status === 401) {
		return { __sessionout: true };
	}
	if (!res.ok) {
		throw new Error('HTTP ' + res.status);
	}
	return res.json();
}

export const api = {
	getSession: () => request('/api/auth/session'),
	login: (memail, mpassword) =>
		request('/api/auth/login', { method: 'POST', body: JSON.stringify({ memail, mpassword }) }),
	logout: () => request('/api/auth/logout', { method: 'POST' }),

	getReport: (dtSeq) => request('/api/report' + (dtSeq ? '?dt_seq=' + dtSeq : '')),
	saveReport: (payload) => request('/api/report/save', { method: 'POST', body: JSON.stringify(payload) }),
	submitReport: (payload) => request('/api/report/submit', { method: 'POST', body: JSON.stringify(payload) }),

	getDashboard: () => request('/api/dashboard'),
	copyPrev: (dtSeq) => request('/api/report/copy-prev', { method: 'POST', body: JSON.stringify({ dt_seq: dtSeq }) }),
	applyDraft: (draftId, items, overwrite) =>
		request('/api/drafts/' + draftId + '/apply', { method: 'POST', body: JSON.stringify({ items, overwrite: !!overwrite }) }),
	getHistory: (from, to) => {
		const qs = [];
		if (from) qs.push('from=' + from);
		if (to) qs.push('to=' + to);
		return request('/api/report/history' + (qs.length ? '?' + qs.join('&') : ''));
	},
	getReportView: (dtSeq) => request('/api/report/view?dt_seq=' + dtSeq),
	getOnelineJobs: (dtSeq) => request('/api/report/oneline-jobs?dt_seq=' + dtSeq),

	getProjectViewWeeks: () => request('/api/project-view/weeks'),
	getProjectViewProjects: (dtSeq) => request('/api/project-view/projects?dt_seq=' + dtSeq),
	getProjectView: (dtSeq, jobId) =>
		request('/api/project-view?dt_seq=' + dtSeq + '&job_id=' + encodeURIComponent(jobId)),

	setWeeklyStatus: (dtSeq, statusButton, vacationDays) =>
		agentRequest('/status', {
			method: 'POST',
			body: JSON.stringify({ dt_seq: dtSeq, status_button: statusButton, vacation_days: vacationDays || 0 })
		}),

	getTodos: (dtSeq) => agentRequest('/todos?dt_seq=' + dtSeq),
	addTodo: (dtSeq, jobId, text) =>
		agentRequest('/todos', { method: 'POST', body: JSON.stringify({ dt_seq: dtSeq, job_id: jobId, text }) }),
	updateTodo: (id, patch) => agentRequest('/todos/' + id, { method: 'PATCH', body: JSON.stringify(patch) }),
	deleteTodo: (id) => agentRequest('/todos/' + id, { method: 'DELETE' })
};
