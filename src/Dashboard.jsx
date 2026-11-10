import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import DraftPreview from './DraftPreview.jsx';

const STATE_LABELS = { EMPTY: '비어 있음', DRAFT: '작성 중', SUBMITTED: '제출 완료' };

export default function Dashboard({ onSessionOut, onGoEdit }) {
	const [data, setData] = useState(undefined);
	const [draft, setDraft] = useState(null);
	const [msg, setMsg] = useState('');

	const [agentMsg, setAgentMsg] = useState('');
	const [jobs, setJobs] = useState([]);
	const [onelineJobId, setOnelineJobId] = useState('');
	const [onelineType, setOnelineType] = useState('이슈');
	const [onelineText, setOnelineText] = useState('');
	const [onelineBusy, setOnelineBusy] = useState(false);

	const load = useCallback(async () => {
		const res = await api.getDashboard();
		if (res.__sessionout) {
			onSessionOut();
			return;
		}
		setData(res);
	}, [onSessionOut]);

	useEffect(() => {
		load();
	}, [load]);

	useEffect(() => {
		if (!data || !data.dt_seq) return;
		api.getOnelineJobs(data.dt_seq).then((res) => {
			if (res.__sessionout) {
				onSessionOut();
				return;
			}
			const jobList = res.jobList || [];
			setJobs(jobList);
			setOnelineJobId(jobList.length > 0 ? String(jobList[0].job_id) : '');
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [data && data.dt_seq]);

	const handleCopyPrev = async () => {
		if (!data || !data.dt_seq) return;
		const res = await api.copyPrev(data.dt_seq);
		if (res.__sessionout) {
			onSessionOut();
			return;
		}
		setDraft(res);
	};

	const handleApply = async (items, overwrite) => {
		const res = await api.applyDraft(draft.draft_id, items, overwrite);
		if (res.__sessionout) {
			onSessionOut();
			return;
		}
		if (res.result === 'conflict') {
			alert('이미 작성된 내용이 있습니다. 덮어쓰려면 "덮어쓰기" 체크박스를 선택해주세요.');
			return;
		}
		if (res.result === 'submitted_locked') {
			alert('이미 제출된 주차에는 적용할 수 없습니다.');
			setDraft(null);
			return;
		}
		if (res.result !== 'SUCCESS') {
			alert('적용에 실패했습니다. 다시 시도해주세요.');
			return;
		}
		setMsg('초안이 임시저장되었습니다. "작성" 탭에서 확인 후 제출해주세요.');
		setDraft(null);
		load();
	};

	const handleAddOneline = async () => {
		const text = onelineText.trim();
		if (!text || !onelineJobId || !data || !data.dt_seq) return;
		setOnelineBusy(true);
		try {
			const res = await api.addOnelineLog(data.dt_seq, onelineJobId, onelineType, text);
			if (res.__sessionout) {
				onSessionOut();
				return;
			}
			if (res.result === 'agent_disabled') {
				setAgentMsg(res.message || '에이전트 기능을 사용할 수 없습니다.');
				return;
			}
			setOnelineText('');
			setAgentMsg('이슈·성과 기록이 저장되었습니다.');
		} finally {
			setOnelineBusy(false);
		}
	};

	if (data === undefined) {
		return <div className="center-loading">불러오는 중...</div>;
	}

	if (draft) {
		return <DraftPreview draft={draft} onApply={handleApply} onCancel={() => setDraft(null)} />;
	}

	if (!data.dt_seq) {
		return <div className="empty-hint">{data.message || '등록된 주차 정보가 없습니다.'}</div>;
	}

	return (
		<div className="dashboard">
			{msg && <div className="msg">{msg}</div>}
			{agentMsg && <div className="msg">{agentMsg}</div>}

			<div className="oneline-input">
				<h4>이슈·성과 한 줄</h4>
				<div className="oneline-input-row">
					<select value={onelineType} onChange={(e) => setOnelineType(e.target.value)}>
						<option value="이슈">이슈</option>
						<option value="성과">성과</option>
					</select>
					<select value={onelineJobId} onChange={(e) => setOnelineJobId(e.target.value)}>
						{jobs.length === 0 && <option value="">업무 없음</option>}
						{jobs.map((j) => (
							<option key={j.job_id} value={j.job_id}>{j.job_name}</option>
						))}
					</select>
					<input
						type="text"
						placeholder="한 줄로 적어주세요"
						value={onelineText}
						maxLength={500}
						onChange={(e) => setOnelineText(e.target.value)}
						onKeyDown={(e) => { if (e.key === 'Enter') handleAddOneline(); }}
					/>
					<button type="button" onClick={handleAddOneline} disabled={onelineBusy || !onelineJobId}>추가</button>
				</div>
			</div>

			<div className="dash-cards">
				<div className="dash-card">
					<div className="dash-card-label">이번 주차</div>
					<div className="dash-card-value">{data.report_sdate} ~ {data.report_edate}</div>
					<span className={'badge ' + (data.state === 'SUBMITTED' ? 'submitted' : 'draft')}>
						{STATE_LABELS[data.state] || data.state}
					</span>
				</div>
				<div className="dash-card">
					<div className="dash-card-label">실적 시간 합계</div>
					<div className="dash-card-value">{data.result_hours}시간</div>
				</div>
				<div className="dash-card">
					<div className="dash-card-label">미제출 지난 주차</div>
					<div className="dash-card-value">{(data.missing_weeks || []).length}건</div>
				</div>
			</div>

			<div className="dash-action-banner">
				{data.state === 'EMPTY' && (
					<>
						<span>이번 주가 비어 있습니다.</span>
						<div className="dash-action-buttons">
							{data.prev_similar && (
								<button type="button" onClick={handleCopyPrev}>전주 복사</button>
							)}
							<button type="button" onClick={() => onGoEdit(data.dt_seq)}>직접 작성</button>
						</div>
					</>
				)}
				{data.state === 'DRAFT' && (
					<>
						<span>작성 중입니다.</span>
						<div className="dash-action-buttons">
							<button type="button" onClick={() => onGoEdit(data.dt_seq)}>검토 후 제출</button>
						</div>
					</>
				)}
				{data.state === 'SUBMITTED' && (
					<span>제출 완료되었습니다.</span>
				)}
			</div>

			{(data.missing_weeks || []).length > 0 && (
				<div className="dash-missing">
					<h4>미제출 지난 주차</h4>
					<ul>
						{data.missing_weeks.map((w) => (
							<li key={w.dt_seq}>
								<span>{w.report_sdate} ~ {w.report_edate}</span>
								<button type="button" onClick={() => onGoEdit(w.dt_seq)}>작성하기</button>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
