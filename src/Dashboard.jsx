import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import DraftPreview from './DraftPreview.jsx';

const STATE_LABELS = { EMPTY: '비어 있음', DRAFT: '작성 중', SUBMITTED: '제출 완료' };

const STATUS_BUTTONS = [
	{ key: '평소대로', emoji: '😊' },
	{ key: '업무변경', emoji: '😮' },
	{ key: '이슈', emoji: '😟' },
	{ key: '성과', emoji: '🎉' },
	{ key: '휴가', emoji: '🏖' }
];

export default function Dashboard({ onSessionOut, onGoEdit, onGoSettings }) {
	const [data, setData] = useState(undefined);
	const [draft, setDraft] = useState(null);
	const [msg, setMsg] = useState('');

	const [logs, setLogs] = useState([]);
	const [selectedIds, setSelectedIds] = useState(() => new Set());
	const [newText, setNewText] = useState('');
	const [settings, setSettings] = useState(undefined);
	const [aiBusy, setAiBusy] = useState(false);
	const [aiMsg, setAiMsg] = useState('');

	const [agentMsg, setAgentMsg] = useState('');
	const [selectedStatus, setSelectedStatus] = useState(null);
	const [carryover, setCarryover] = useState([]);
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

	const loadLogs = useCallback(async (dtSeq) => {
		const res = await api.getQuickLogs(dtSeq);
		if (res.__sessionout) {
			onSessionOut();
			return;
		}
		setLogs(res.logs || []);
	}, [onSessionOut]);

	const loadCarryover = useCallback(async () => {
		const res = await api.getCarryover();
		if (res.__sessionout) {
			onSessionOut();
			return;
		}
		if (!Array.isArray(res)) {
			setAgentMsg(res.message || '에이전트 기능을 사용할 수 없습니다.');
			setCarryover([]);
			return;
		}
		setCarryover(res);
	}, [onSessionOut]);

	useEffect(() => {
		if (!data || !data.dt_seq) return;
		loadLogs(data.dt_seq);
		api.getSettings().then((res) => {
			if (res.__sessionout) {
				onSessionOut();
				return;
			}
			setSettings(res);
		});
		api.getReport(data.dt_seq).then((res) => {
			if (res.__sessionout) {
				onSessionOut();
				return;
			}
			const jobList = res.jobList || [];
			setJobs(jobList);
			setOnelineJobId(jobList.length > 0 ? String(jobList[0].job_id) : '');
		});
		loadCarryover();
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

	const handleStatusClick = async (key) => {
		if (!data || !data.dt_seq) return;
		let vacationDays = 0;
		if (key === '휴가') {
			const input = window.prompt('휴가 일수를 입력하세요', '1');
			if (input === null) return;
			vacationDays = parseFloat(input) || 0;
		}
		const res = await api.setWeeklyStatus(data.dt_seq, key, vacationDays);
		if (res.__sessionout) {
			onSessionOut();
			return;
		}
		if (res.result === 'agent_disabled') {
			setAgentMsg(res.message || '에이전트 기능을 사용할 수 없습니다.');
			return;
		}
		setSelectedStatus(key);
		setAgentMsg('');
	};

	const handleCarryoverAction = async (id, status) => {
		const res = await api.setCarryoverStatus(id, status);
		if (res.__sessionout) {
			onSessionOut();
			return;
		}
		if (res.result === 'agent_disabled') {
			setAgentMsg(res.message || '에이전트 기능을 사용할 수 없습니다.');
			return;
		}
		setCarryover((prev) => prev.filter((item) => item.id !== id));
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

	const handleAddLog = async () => {
		const text = newText.trim();
		if (!text) return;
		const res = await api.addQuickLog(text);
		if (res.__sessionout) {
			onSessionOut();
			return;
		}
		if (res.result !== 'SUCCESS') {
			alert('메모 추가에 실패했습니다.');
			return;
		}
		setNewText('');
		loadLogs(data.dt_seq);
	};

	const handleDeleteLog = async (id) => {
		const res = await api.deleteQuickLog(id);
		if (res.__sessionout) {
			onSessionOut();
			return;
		}
		setSelectedIds((prev) => {
			const next = new Set(prev);
			next.delete(id);
			return next;
		});
		loadLogs(data.dt_seq);
	};

	const handleToggleSelect = (id) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const handleAutoDraft = async () => {
		if (!data || !data.dt_seq) return;
		const res = await api.getAutoDraft(data.dt_seq);
		if (res.__sessionout) {
			onSessionOut();
			return;
		}
		setDraft(res);
	};

	const handleGenerateAi = async () => {
		if (selectedIds.size === 0) {
			alert('AI로 만들 메모를 1건 이상 선택해주세요.');
			return;
		}
		setAiBusy(true);
		setAiMsg('');
		try {
			const res = await api.getAiDraft(data.dt_seq, Array.from(selectedIds), '');
			if (res.__sessionout) {
				onSessionOut();
				return;
			}
			if (res.result === 'ai_disabled') {
				setAiMsg(res.message || 'AI를 사용할 수 없습니다.');
				return;
			}
			if (res.result === 'no_memo') {
				setAiMsg('선택한 메모가 없습니다.');
				return;
			}
			if (res.result === 'daily_limit_exceeded') {
				setAiMsg(res.message || '오늘 AI 초안 생성 횟수를 다 썼습니다.');
				return;
			}
			if (res.result === 'ai_schema_broken') {
				setAiMsg(res.message || 'AI 응답 형식 오류로 초안을 만들지 못했습니다.');
				return;
			}
			if (res.ai_fallback) {
				setAiMsg('AI 호출에 실패해 직전 주 계획 기반 규칙 초안으로 대체했습니다.');
			}
			setDraft(res);
			setSelectedIds(new Set());
		} catch (err) {
			setAiMsg('AI 초안 생성 중 오류가 발생했습니다. (' + err.message + ')');
		} finally {
			setAiBusy(false);
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

	const aiConsented = settings && settings.ai_consent_yn === 'Y';

	return (
		<div className="dashboard">
			{msg && <div className="msg">{msg}</div>}
			{agentMsg && <div className="msg">{agentMsg}</div>}

			<div className="status-buttons">
				<h4>이번 주차 상태</h4>
				<div className="status-buttons-row">
					{STATUS_BUTTONS.map((b) => (
						<button
							key={b.key}
							type="button"
							className={'status-btn' + (selectedStatus === b.key ? ' active' : '')}
							onClick={() => handleStatusClick(b.key)}
						>
							<span className="status-emoji">{b.emoji}</span>
							<span className="status-label">{b.key}</span>
						</button>
					))}
				</div>
			</div>

			<div className="carryover">
				<h4>지난주 예정 체크</h4>
				{carryover.length === 0 ? (
					<div className="empty-hint">지난주 예정 중 확인할 항목이 없습니다.</div>
				) : (
					<ul className="carryover-list">
						{carryover.map((item) => (
							<li key={item.id}>
								<span className="carryover-content">{item.content}</span>
								<div className="carryover-actions">
									<button type="button" onClick={() => handleCarryoverAction(item.id, '완료')}>완료</button>
									<button type="button" onClick={() => handleCarryoverAction(item.id, '진행중')}>진행중</button>
									<button type="button" onClick={() => handleCarryoverAction(item.id, '연기')}>연기</button>
									<button type="button" className="remove-btn" onClick={() => handleCarryoverAction(item.id, '삭제')}>삭제</button>
								</div>
							</li>
						))}
					</ul>
				)}
			</div>

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

			{data.auto_draft_ready && (
				<div className="msg">자동 초안이 준비되어 있습니다. 내용을 확인해보세요.</div>
			)}

			<div className="dash-action-banner">
				{data.state === 'EMPTY' && (
					<>
						<span>이번 주가 비어 있습니다.</span>
						<div className="dash-action-buttons">
							{data.prev_similar && (
								<button type="button" onClick={handleCopyPrev}>전주 복사</button>
							)}
							<button type="button" onClick={handleAutoDraft}>자동 초안</button>
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

			<div className="quick-log">
				<h4>간편 메모</h4>
				<div className="quick-log-input">
					<input
						type="text"
						placeholder="오늘 한 일을 짧게 적어두세요 (끝에 3h, 1.5시간 처럼 쓰면 시간이 자동으로 기록됩니다)"
						value={newText}
						maxLength={500}
						onChange={(e) => setNewText(e.target.value)}
						onKeyDown={(e) => { if (e.key === 'Enter') handleAddLog(); }}
					/>
					<button type="button" onClick={handleAddLog}>추가</button>
				</div>

				{logs.length === 0 ? (
					<div className="empty-hint">이번 주 메모가 아직 없습니다.</div>
				) : (
					<ul className="quick-log-list">
						{logs.map((l) => (
							<li key={l.id}>
								<label>
									<input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => handleToggleSelect(l.id)} />
									<span>{l.text}</span>
									{l.w_hour != null && <span className="quick-log-hour">{l.w_hour}h</span>}
								</label>
								<button type="button" className="remove-btn" onClick={() => handleDeleteLog(l.id)}>삭제 ✕</button>
							</li>
						))}
					</ul>
				)}

				<div className="quick-log-footer">
					<button type="button" onClick={handleGenerateAi} disabled={aiBusy || !aiConsented}>
						{aiBusy ? 'AI로 만드는 중...' : 'AI로 보고서 만들기'}
					</button>
				</div>
				{aiMsg && <div className="msg">{aiMsg}</div>}
				{!aiConsented && (
					<div className="empty-hint">
						AI 사용 동의를 켜야 AI로 보고서를 만들 수 있습니다.{' '}
						{onGoSettings && <a href="#" onClick={(e) => { e.preventDefault(); onGoSettings(); }}>설정에서 켜기</a>}
					</div>
				)}
			</div>
		</div>
	);
}
