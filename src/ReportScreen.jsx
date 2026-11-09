import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import JobCard from './JobCard.jsx';

function emptySide() {
	return { content: '', w_hour: '', content_lvl: '3' };
}

function buildGroups(reportList) {
	const map = new Map();
	const order = [];
	(reportList || []).forEach((r) => {
		if (!map.has(r.job_id)) {
			map.set(r.job_id, { job_id: r.job_id, job_name: r.job_name, result: emptySide(), plan: emptySide() });
			order.push(r.job_id);
		}
		const side = r.plan_yn === 'Y' ? 'plan' : 'result';
		map.get(r.job_id)[side] = {
			content: r.content || '',
			w_hour: r.w_hour === null || r.w_hour === undefined ? '' : r.w_hour,
			content_lvl: r.content_lvl === null || r.content_lvl === undefined ? '3' : String(r.content_lvl)
		};
	});
	return order.map((id) => map.get(id));
}

export default function ReportScreen({ dtSeq: initialDtSeq, onSessionOut }) {
	const [weeks, setWeeks] = useState([]);
	const [dtSeq, setDtSeq] = useState(0);
	const [rmSeq, setRmSeq] = useState('0');
	const [submitYn, setSubmitYn] = useState('N');
	const [reportSdate, setReportSdate] = useState('');
	const [reportEdate, setReportEdate] = useState('');
	const [reportDate, setReportDate] = useState('');
	const [jobList, setJobList] = useState([]);
	const [groups, setGroups] = useState([]);
	const [newJobId, setNewJobId] = useState('');
	const [msg, setMsg] = useState({ text: '', type: 'ok' });
	const [loading, setLoading] = useState(true);

	const loadPage = useCallback(async (targetDtSeq) => {
		setLoading(true);
		const data = await api.getReport(targetDtSeq);
		if (data.__sessionout) {
			alert('세션이 만료되었습니다. 다시 로그인해주세요.');
			onSessionOut();
			return;
		}
		setWeeks(data.weeks || []);
		setDtSeq(data.dt_seq);
		setRmSeq(data.rm_seq);
		setSubmitYn(data.submit_yn);
		setReportSdate(data.report_sdate);
		setReportEdate(data.report_edate);
		setReportDate(data.report_date);
		setJobList(data.jobList || []);
		setGroups(buildGroups(data.reportList));
		setMsg({ text: '', type: 'ok' });
		setLoading(false);
	}, [onSessionOut]);

	useEffect(() => {
		loadPage(initialDtSeq);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleWeekChange = (e) => {
		loadPage(Number(e.target.value));
	};

	const handleFieldChange = (jobId, side, field, value) => {
		setGroups((prev) =>
			prev.map((g) => (g.job_id !== jobId ? g : { ...g, [side]: { ...g[side], [field]: value } }))
		);
	};

	const handleCopy = (jobId, fromSide, toSide) => {
		setGroups((prev) =>
			prev.map((g) => {
				if (g.job_id !== jobId) return g;
				const fromVal = g[fromSide].content;
				if (!fromVal.trim()) return g;
				if (g[toSide].content.trim()) {
					const label = toSide === 'plan' ? '계획' : '실적';
					if (!confirm(label + ' 내용을 덮어쓸까요?')) return g;
				}
				return { ...g, [toSide]: { ...g[toSide], content: fromVal } };
			})
		);
	};

	const handleRemove = (jobId) => {
		const removed = groups.find((g) => g.job_id === jobId);
		setGroups((prev) => prev.filter((g) => g.job_id !== jobId));
		if (removed && !jobList.some((j) => j.job_id === jobId)) {
			setJobList((prev) => [...prev, { job_id: removed.job_id, job_name: removed.job_name }]);
		}
	};

	const handleAddJob = () => {
		if (!newJobId) { alert('업무를 선택하세요.'); return; }
		const job = jobList.find((j) => String(j.job_id) === String(newJobId));
		if (!job) return;
		setGroups((prev) => [...prev, { job_id: job.job_id, job_name: job.job_name, result: emptySide(), plan: emptySide() }]);
		setJobList((prev) => prev.filter((j) => String(j.job_id) !== String(newJobId)));
		setNewJobId('');
	};

	const collectItems = () => {
		const items = [];
		groups.forEach((g) => {
			const resultContent = g.result.content.trim();
			const planContent = g.plan.content.trim();
			if (resultContent !== '') {
				items.push({
					job_id: g.job_id,
					content: resultContent,
					w_hour: g.result.w_hour || '0',
					content_lvl: g.result.content_lvl || '1',
					plan_yn: 'N',
					rm_seq: rmSeq
				});
			}
			if (planContent !== '') {
				items.push({
					job_id: g.job_id,
					content: planContent,
					w_hour: g.plan.w_hour || '0',
					content_lvl: g.plan.content_lvl || '1',
					plan_yn: 'Y',
					rm_seq: rmSeq
				});
			}
		});
		return items;
	};

	const summary = useMemo(() => {
		let resultCnt = 0, planCnt = 0, resultHour = 0, planHour = 0;
		groups.forEach((g) => {
			if (g.result.content.trim() !== '') { resultCnt++; resultHour += parseFloat(g.result.w_hour || '0') || 0; }
			if (g.plan.content.trim() !== '') { planCnt++; planHour += parseFloat(g.plan.w_hour || '0') || 0; }
		});
		// 총 투입시간에 계획 시간을 섞지 않고 실적/계획을 분리해서 보여준다.
		return {
			resultCnt, planCnt,
			resultHour: Math.round(resultHour * 10) / 10,
			planHour: Math.round(planHour * 10) / 10
		};
	}, [groups]);

	const handleResult = (data, okMsg) => {
		if (data.__sessionout) {
			alert('세션이 만료되었습니다. 다시 로그인해주세요.');
			onSessionOut();
			return;
		}
		if (data.result !== 'SUCCESS') {
			setMsg({ text: '처리에 실패했습니다. 다시 시도해주세요. (내용에 특수문자가 있으면 줄바꿈 없이 입력해보세요)', type: 'error' });
			return;
		}
		setMsg({ text: okMsg, type: 'ok' });
		loadPage(dtSeq);
	};

	const doSave = async () => {
		const items = collectItems();
		if (items.length === 0) { setMsg({ text: '실적 또는 계획 내용을 1건 이상 입력해주세요.', type: 'error' }); return; }
		try {
			const data = await api.saveReport({ rm_seq: rmSeq, dt_seq: dtSeq, items });
			handleResult(data, '저장되었습니다.');
		} catch (err) {
			setMsg({ text: '저장에 실패했습니다. (' + err.message + ')', type: 'error' });
		}
	};

	const doSubmit = async () => {
		const items = collectItems();
		if (items.length === 0) { setMsg({ text: '실적 또는 계획 내용을 1건 이상 입력해주세요.', type: 'error' }); return; }
		if (!confirm('제출하면 이번 주 내용이 확정됩니다. 계획 항목은 다음 주 실적으로 자동 이관됩니다. 제출하시겠습니까?')) return;
		try {
			const data = await api.submitReport({ rm_seq: rmSeq, dt_seq: dtSeq, dt_seq_date: reportDate, items });
			handleResult(data, '제출되었습니다.');
		} catch (err) {
			setMsg({ text: '제출에 실패했습니다. (' + err.message + ')', type: 'error' });
		}
	};

	if (loading && groups.length === 0 && weeks.length === 0) {
		return <div className="center-loading">불러오는 중...</div>;
	}

	return (
		<div className="wrap">
			<div className="week-bar">
				<label>작성 주차</label>
				<select value={dtSeq} onChange={handleWeekChange}>
					{weeks.map((w) => (
						<option key={w.dt_seq} value={w.dt_seq}>
							{w.report_sdate} ~ {w.report_edate}
						</option>
					))}
				</select>
				<span className={'badge ' + (submitYn === 'Y' ? 'submitted' : 'draft')}>
					{submitYn === 'Y' ? '제출완료' : '미제출(작성중)'}
				</span>
			</div>

			<div className="summary-bar">
				<span className="dot-result">실적 입력 <b>{summary.resultCnt}</b>건</span>
				<span className="dot-plan">계획 입력 <b>{summary.planCnt}</b>건</span>
				<span>실적 시간 <b>{summary.resultHour}</b>시간</span>
				<span>계획 시간 <b>{summary.planHour}</b>시간</span>
			</div>

			<div className={'msg' + (msg.type === 'error' ? ' error' : '')}>{msg.text}</div>

			<div id="cardsContainer">
				{groups.map((g) => (
					<JobCard key={g.job_id} group={g} onFieldChange={handleFieldChange} onCopy={handleCopy} onRemove={handleRemove} />
				))}
			</div>
			{groups.length === 0 && (
				<div className="empty-hint">아직 등록된 업무가 없습니다. 아래에서 업무를 선택해 추가해주세요.</div>
			)}

			<div className="add-bar">
				<label>업무 추가</label>
				<select value={newJobId} onChange={(e) => setNewJobId(e.target.value)}>
					<option value="">-- 업무 선택 --</option>
					{jobList.map((j) => (
						<option key={j.job_id} value={j.job_id}>{j.job_name}</option>
					))}
				</select>
				<button type="button" onClick={handleAddJob}>+ 추가</button>
			</div>

			<div className="buttons">
				<button type="button" className="btn-save" onClick={doSave}>임시저장</button>
				<button type="button" className="btn-submit" onClick={doSubmit}>제출</button>
			</div>
		</div>
	);
}
