import { Fragment, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import DraftPreview from './DraftPreview.jsx';

const STATE_LABELS = { EMPTY: '비어 있음', DRAFT: '작성 중', SUBMITTED: '제출 완료' };

const STATUS_BUTTONS = [
	{ key: '평소대로', emoji: '😊' },
	{ key: '업무변경', emoji: '😮' },
	{ key: '휴가', emoji: '🏖' }
];

const TODO_NEXT_STATUS = { 예정: '진행중', 진행중: '완료' };

export default function Dashboard({ onSessionOut, onGoEdit }) {
	const [data, setData] = useState(undefined);
	const [draft, setDraft] = useState(null);
	const [msg, setMsg] = useState('');

	const [agentMsg, setAgentMsg] = useState('');
	const [selectedStatus, setSelectedStatus] = useState(null);
	const [jobs, setJobs] = useState([]);

	const [todos, setTodos] = useState([]);
	const [newJobId, setNewJobId] = useState('');
	const [newText, setNewText] = useState('');
	const [todoBusy, setTodoBusy] = useState(false);

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

	const loadTodos = useCallback(
		async (dtSeq) => {
			const res = await api.getTodos(dtSeq);
			if (res.__sessionout) {
				onSessionOut();
				return;
			}
			if (res.result === 'agent_disabled') {
				setAgentMsg(res.message || '에이전트 기능을 사용할 수 없습니다.');
				return;
			}
			setTodos(Array.isArray(res) ? res : []);
		},
		[onSessionOut]
	);

	useEffect(() => {
		if (!data || !data.dt_seq) return;
		api.getOnelineJobs(data.dt_seq).then((res) => {
			if (res.__sessionout) {
				onSessionOut();
				return;
			}
			const jobList = res.jobList || [];
			setJobs(jobList);
			setNewJobId((prev) => prev || (jobList.length > 0 ? String(jobList[0].job_id) : ''));
		});
		loadTodos(data.dt_seq);
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

	const handleAddTodo = async () => {
		const text = newText.trim();
		if (!text || !newJobId || !data || !data.dt_seq) return;
		setTodoBusy(true);
		try {
			const res = await api.addTodo(data.dt_seq, newJobId, text);
			if (res.__sessionout) {
				onSessionOut();
				return;
			}
			if (res.result === 'agent_disabled') {
				setAgentMsg(res.message || '에이전트 기능을 사용할 수 없습니다.');
				return;
			}
			setNewText('');
			loadTodos(data.dt_seq);
		} finally {
			setTodoBusy(false);
		}
	};

	const handleCycleStatus = async (todo) => {
		const next = TODO_NEXT_STATUS[todo.status];
		if (!next || !data) return;
		const patch = { status: next };
		if (next === '완료') patch.dt_seq = data.dt_seq;
		const res = await api.updateTodo(todo.id, patch);
		if (res.__sessionout) {
			onSessionOut();
			return;
		}
		if (res.result === 'agent_disabled') {
			setAgentMsg(res.message || '에이전트 기능을 사용할 수 없습니다.');
			return;
		}
		loadTodos(data.dt_seq);
	};

	const handleToggleHelp = async (todo) => {
		if (todo.help_status === '확인함' || !data) return;
		const next = todo.help_status === '없음' ? '요청' : '없음';
		const res = await api.updateTodo(todo.id, { help_status: next });
		if (res.__sessionout) {
			onSessionOut();
			return;
		}
		loadTodos(data.dt_seq);
	};

	const handleDeleteTodo = async (todo) => {
		if (!data) return;
		const res = await api.deleteTodo(todo.id);
		if (res.__sessionout) {
			onSessionOut();
			return;
		}
		loadTodos(data.dt_seq);
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

	const carryoverStartIndex = todos.findIndex((t) => t.created_dt_seq < data.dt_seq);

	return (
		<div className="dashboard">
			{msg && <div className="msg">{msg}</div>}
			{agentMsg && <div className="msg">{agentMsg}</div>}

			<div className="todo-box">
				<h4>이번 주 할 일</h4>
				<div className="todo-add-row">
					<select value={newJobId} onChange={(e) => setNewJobId(e.target.value)}>
						{jobs.length === 0 && <option value="">업무 없음</option>}
						{jobs.map((j) => (
							<option key={j.job_id} value={j.job_id}>{j.job_name}</option>
						))}
					</select>
					<input
						type="text"
						placeholder="할 일을 한 줄로 적어주세요"
						value={newText}
						maxLength={200}
						onChange={(e) => setNewText(e.target.value)}
						onKeyDown={(e) => { if (e.key === 'Enter') handleAddTodo(); }}
					/>
					<button type="button" onClick={handleAddTodo} disabled={todoBusy || !newJobId}>추가</button>
				</div>

				{todos.length === 0 ? (
					<div className="empty-hint">할 일이 아직 없습니다.</div>
				) : (
					<ul className="todo-list">
						{todos.map((t, i) => (
							<Fragment key={t.id}>
								{i === carryoverStartIndex && carryoverStartIndex !== -1 && (
									<li className="todo-divider">── 지난주에서 넘어온 일 {todos.length - carryoverStartIndex}건 ──</li>
								)}
								<li>
									<div className="todo-row">
										<button
											type="button"
											className={'todo-status todo-status-' + t.status}
											onClick={() => handleCycleStatus(t)}
											disabled={t.status === '완료'}
										>
											{t.status}{t.status !== '완료' ? ' ▼' : ''}
										</button>
										<span className="todo-text">{t.text}</span>
										<span className="todo-job">{t.job_id}</span>
										<button
											type="button"
											className={'todo-help' + (t.help_status !== '없음' ? ' active' : '')}
											onClick={() => handleToggleHelp(t)}
											disabled={t.help_status === '확인함'}
											title="도움 필요"
										>
											🙋{t.help_status === '확인함' ? ' 팀장 확인함' : t.help_status === '요청' ? ' 도움 요청' : ''}
										</button>
										<button type="button" className="remove-btn" onClick={() => handleDeleteTodo(t)}>삭제 ✕</button>
									</div>
								</li>
							</Fragment>
						))}
					</ul>
				)}
			</div>

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
							<span className="status-label">{b.key === '업무변경' ? '업무가 바뀌었어요' : b.key === '휴가' ? '쉬었어요' : b.key}</span>
						</button>
					))}
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
