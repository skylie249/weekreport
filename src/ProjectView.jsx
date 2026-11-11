import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from './api.js';

function readQuery() {
	const q = new URLSearchParams(window.location.search);
	return {
		dtSeq: q.get('dt_seq') ? Number(q.get('dt_seq')) : null,
		jobId: q.get('job_id') || null
	};
}

function writeQuery(dtSeq, jobId) {
	const q = new URLSearchParams(window.location.search);
	if (dtSeq) q.set('dt_seq', dtSeq); else q.delete('dt_seq');
	if (jobId) q.set('job_id', jobId); else q.delete('job_id');
	const qs = q.toString();
	window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
}

// job_schect(비고)는 이 미니 앱이 아니라 다른 사내 화면에서 입력된 값이라 줄바꿈이 <br>
// 태그로 그대로 들어있다. HTML로 렌더링하지 않고(신뢰할 수 없는 과거 입력이라 다른 태그가
// 섞여 있을 가능성 대비) <br>만 줄바꿈으로 바꿔 순수 텍스트로 보여준다.
function normalizeNote(note) {
	if (!note) return note;
	return note.replace(/<br\s*\/?>/gi, '\n');
}

// 서버에서 .docx를 만드는 라이브러리를 추가하지 않고(오프라인 Maven 제약, H2 지시서),
// Word가 그대로 열 수 있는 HTML 문서를 브라우저에서 만들어 .doc로 내려준다.
function escapeHtml(text) {
	return String(text == null ? '' : text)
		.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function personRowsHtml(people, showHour) {
	if (!people || people.length === 0) {
		return '<tr><td style="color:#999;">입력 없음</td></tr>';
	}
	return people.map((p) => (
		'<tr><td style="padding:6px 8px;border-bottom:1px solid #e3e6ea;">' +
		'<b>[' + escapeHtml(p.mname) + ']</b>' + (showHour ? ' : ' + p.w_hour + 'h' : '') +
		'<div style="white-space:pre-wrap;margin-top:4px;">' + escapeHtml(p.content || '입력 없음') + '</div>' +
		'</td></tr>'
	)).join('');
}

function buildDocHtml(detail) {
	return '<html><head><meta charset="utf-8"></head><body style="font-family:Malgun Gothic,sans-serif;font-size:13px;">' +
		'<h2>' + escapeHtml(detail.job_name) + '</h2>' +
		(detail.job_sche_s ? '<p>■ 일정 ' + escapeHtml(detail.job_sche_s) + ' ~ ' + escapeHtml(detail.job_sche_e) + '</p>' : '') +
		(detail.note ? '<div style="white-space:pre-wrap;margin-bottom:12px;">' + escapeHtml(normalizeNote(detail.note)) + '</div>' : '') +
		'<p>총 근무 시간 : ' + detail.total_hours + '시간</p>' +
		'<table style="width:100%;border-collapse:collapse;"><tr>' +
		'<td style="vertical-align:top;width:50%;padding:8px;border:1px solid #e3e6ea;">' +
		'<h3>실적 (' + escapeHtml(detail.result_sdate) + ' ~ ' + escapeHtml(detail.result_edate) + ')</h3>' +
		'<table style="width:100%;">' + personRowsHtml(detail.result, true) + '</table>' +
		'</td>' +
		'<td style="vertical-align:top;width:50%;padding:8px;border:1px solid #e3e6ea;">' +
		'<h3>계획 (' + escapeHtml(detail.plan_sdate) + ' ~ ' + escapeHtml(detail.plan_edate) + ')</h3>' +
		'<table style="width:100%;">' + personRowsHtml(detail.plan, false) + '</table>' +
		'</td>' +
		'</tr></table>' +
		'</body></html>';
}

function downloadDoc(detail) {
	const html = buildDocHtml(detail);
	const blob = new Blob(['﻿', html], { type: 'application/msword' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	const safeName = detail.job_name.replace(/[\\/:*?"<>|]/g, '_');
	a.download = '주간보고_' + safeName + '_' + detail.result_sdate + '.doc';
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

function PersonCard({ person, showHour }) {
	return (
		<div className="pv-person-card">
			<div className="pv-person-head">
				<span className="pv-person-name">[{person.mname}]</span>
				{person.mposName && <span className="pv-person-pos">{person.mposName}</span>}
				{showHour && <span className="pv-person-hour">{person.w_hour}h</span>}
				{!person.submitted && <span className="pv-person-draft">작성 중</span>}
			</div>
			<div className="pv-person-content">{person.content || <span className="empty-hint-inline">입력 없음</span>}</div>
		</div>
	);
}

export default function ProjectView({ onSessionOut }) {
	const initial = readQuery();
	const [weeks, setWeeks] = useState([]);
	const [dtSeq, setDtSeq] = useState(initial.dtSeq);
	const [projects, setProjects] = useState([]);
	const [jobId, setJobId] = useState(initial.jobId);
	const [filterText, setFilterText] = useState('');
	const [detail, setDetail] = useState(null);
	const [loadingWeeks, setLoadingWeeks] = useState(true);
	const [loadingDetail, setLoadingDetail] = useState(false);
	const [errorMsg, setErrorMsg] = useState('');
	const [headerOpen, setHeaderOpen] = useState(() => localStorage.getItem('pv-header-open') !== '0');
	const [mobileSide, setMobileSide] = useState('result');

	const loadWeeks = useCallback(async () => {
		setLoadingWeeks(true);
		const res = await api.getProjectViewWeeks();
		if (res.__sessionout) { onSessionOut(); return; }
		const list = res.weeks || [];
		setWeeks(list);
		setDtSeq((prev) => prev || (list.length ? list[0].dt_seq : null));
		setLoadingWeeks(false);
	}, [onSessionOut]);

	useEffect(() => { loadWeeks(); }, [loadWeeks]);

	const loadProjects = useCallback(async (targetDtSeq) => {
		if (!targetDtSeq) return;
		const res = await api.getProjectViewProjects(targetDtSeq);
		if (res.__sessionout) { onSessionOut(); return; }
		const list = res.projects || [];
		setProjects(list);
		setJobId((prev) => (prev && list.some((p) => p.job_id === prev)) ? prev : (list.length ? list[0].job_id : null));
	}, [onSessionOut]);

	useEffect(() => { loadProjects(dtSeq); }, [dtSeq, loadProjects]);

	const loadDetail = useCallback(async (targetDtSeq, targetJobId) => {
		if (!targetDtSeq || !targetJobId) { setDetail(null); return; }
		setLoadingDetail(true);
		setErrorMsg('');
		try {
			const res = await api.getProjectView(targetDtSeq, targetJobId);
			if (res.__sessionout) { onSessionOut(); return; }
			setDetail(res);
		} catch (e) {
			setDetail(null);
			setErrorMsg('내용을 불러오지 못했습니다.');
		}
		setLoadingDetail(false);
	}, [onSessionOut]);

	useEffect(() => {
		writeQuery(dtSeq, jobId);
		loadDetail(dtSeq, jobId);
	}, [dtSeq, jobId, loadDetail]);

	const filteredProjects = useMemo(() => {
		if (!filterText.trim()) return projects;
		const needle = filterText.trim().toLowerCase();
		return projects.filter((p) => p.job_name.toLowerCase().includes(needle));
	}, [projects, filterText]);

	const currentWeekIndex = useMemo(() => weeks.findIndex((w) => w.dt_seq === dtSeq), [weeks, dtSeq]);
	const goWeek = (delta) => {
		const next = currentWeekIndex - delta; // weeks는 최신이 0번(내림차순)이라 '다음 주'는 index-1
		if (next >= 0 && next < weeks.length) {
			setJobId(null);
			setDtSeq(weeks[next].dt_seq);
		}
	};

	if (loadingWeeks) {
		return <div className="center-loading">불러오는 중...</div>;
	}

	return (
		<div className="project-view">
			<div className="pv-top">
				<div className="pv-top-row">
					<label>작성일</label>
					<button type="button" className="pv-week-nav" onClick={() => goWeek(1)} disabled={currentWeekIndex >= weeks.length - 1}>◀</button>
					<select value={dtSeq || ''} onChange={(e) => { setJobId(null); setDtSeq(Number(e.target.value)); }}>
						{weeks.map((w) => (
							<option key={w.dt_seq} value={w.dt_seq}>{w.report_sdate} ~ {w.report_edate}</option>
						))}
					</select>
					<button type="button" className="pv-week-nav" onClick={() => goWeek(-1)} disabled={currentWeekIndex <= 0}>▶</button>
				</div>
				<div className="pv-top-row">
					<label>프로젝트</label>
					<input
						type="text"
						className="pv-project-filter"
						placeholder="프로젝트명 검색"
						value={filterText}
						onChange={(e) => setFilterText(e.target.value)}
					/>
					<select value={jobId || ''} onChange={(e) => setJobId(e.target.value)}>
						{filteredProjects.map((p) => (
							<option key={p.job_id} value={p.job_id}>{p.job_name}</option>
						))}
						{filteredProjects.length === 0 && <option value="">(목록 없음)</option>}
					</select>
				</div>
				{detail && (
					<div className="pv-total-hour">
						총 근무 시간 : <b>{detail.total_hours}시간</b>
						<button type="button" className="pv-doc-btn" onClick={() => downloadDoc(detail)}>워드 다운로드(doc)</button>
					</div>
				)}
			</div>

			{errorMsg && <div className="msg error">{errorMsg}</div>}

			{loadingDetail && <div className="center-loading">불러오는 중...</div>}

			{!loadingDetail && !errorMsg && !detail && (
				<div className="empty-hint">이 주차에 작성 내용이 있는 프로젝트가 없습니다.</div>
			)}

			{!loadingDetail && detail && (
				<div className="pv-body">
					<div className="pv-header">
						<button type="button" className="pv-header-toggle" onClick={() => setHeaderOpen((v) => {
							localStorage.setItem('pv-header-open', v ? '0' : '1');
							return !v;
						})}>
							{headerOpen ? '▾' : '▸'} {detail.job_name}
						</button>
						{headerOpen && (
							<div className="pv-header-detail">
								{(detail.job_sche_s || detail.job_sche_e) && (
									<div className="pv-header-line">■ 일정 {detail.job_sche_s} ~ {detail.job_sche_e}</div>
								)}
								{detail.note && <div className="pv-header-note">{normalizeNote(detail.note)}</div>}
							</div>
						)}
					</div>

					<div className="pv-mobile-tabs">
						<button type="button" className={mobileSide === 'result' ? 'active' : ''} onClick={() => setMobileSide('result')}>실적</button>
						<button type="button" className={mobileSide === 'plan' ? 'active' : ''} onClick={() => setMobileSide('plan')}>계획</button>
					</div>

					<div className="pv-columns">
						<div className={'pv-column pv-column-result' + (mobileSide === 'result' ? ' mobile-active' : '')}>
							<h4>◀ 실적 ({detail.result_sdate} ~ {detail.result_edate})</h4>
							{detail.result.length === 0 && <div className="empty-hint-inline">입력 없음</div>}
							{detail.result.map((p) => <PersonCard key={p.memail} person={p} showHour />)}
						</div>
						<div className={'pv-column pv-column-plan' + (mobileSide === 'plan' ? ' mobile-active' : '')}>
							<h4>계획 ({detail.plan_sdate} ~ {detail.plan_edate})</h4>
							{detail.plan.length === 0 && <div className="empty-hint-inline">입력 없음</div>}
							{detail.plan.map((p) => <PersonCard key={p.memail} person={p} />)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
