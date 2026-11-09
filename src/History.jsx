import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

export default function History({ onSessionOut, onGoEdit }) {
	const [weeks, setWeeks] = useState([]);
	const [loading, setLoading] = useState(true);
	const [selectedDtSeq, setSelectedDtSeq] = useState(null);
	const [detail, setDetail] = useState(null);
	const [copyMsg, setCopyMsg] = useState('');

	const load = useCallback(async () => {
		setLoading(true);
		const res = await api.getHistory();
		if (res.__sessionout) {
			onSessionOut();
			return;
		}
		setWeeks(res.weeks || []);
		setLoading(false);
	}, [onSessionOut]);

	useEffect(() => {
		load();
	}, [load]);

	const handleSelect = async (dtSeq) => {
		setSelectedDtSeq(dtSeq);
		setCopyMsg('');
		const res = await api.getReportView(dtSeq);
		if (res.__sessionout) {
			onSessionOut();
			return;
		}
		setDetail(res);
	};

	const handleCopyText = () => {
		if (!detail) return;
		const map = new Map();
		(detail.items || []).forEach((it) => {
			if (!map.has(it.job_name)) {
				map.set(it.job_name, { result: '', plan: '' });
			}
			const g = map.get(it.job_name);
			if (it.plan_yn === 'Y') {
				g.plan = it.content;
			} else {
				g.result = it.content;
			}
		});
		const text = Array.from(map.entries())
			.map(([name, g]) => '[' + name + '] 실적: ' + (g.result || '-') + ' / 계획: ' + (g.plan || '-'))
			.join('\n');
		navigator.clipboard.writeText(text)
			.then(() => setCopyMsg('복사되었습니다.'))
			.catch(() => setCopyMsg('복사에 실패했습니다.'));
	};

	if (loading) {
		return <div className="center-loading">불러오는 중...</div>;
	}

	return (
		<div className="history">
			<table className="history-table">
				<thead>
					<tr>
						<th>기간</th>
						<th>상태</th>
						<th>업무 수</th>
						<th>실적 시간</th>
					</tr>
				</thead>
				<tbody>
					{weeks.map((w) => (
						<tr
							key={w.dt_seq}
							className={selectedDtSeq === w.dt_seq ? 'selected' : ''}
							onClick={() => handleSelect(w.dt_seq)}
						>
							<td>{w.report_sdate} ~ {w.report_edate}</td>
							<td>
								<span className={'badge ' + (w.submit_yn === 'Y' ? 'submitted' : 'draft')}>
									{w.submit_yn === 'Y' ? '제출완료' : '미제출'}
								</span>
							</td>
							<td>{w.job_count}</td>
							<td>{w.result_hours}</td>
						</tr>
					))}
					{weeks.length === 0 && (
						<tr>
							<td colSpan={4} className="empty-hint">조회할 주차가 없습니다.</td>
						</tr>
					)}
				</tbody>
			</table>

			{detail && (
				<div className="history-detail">
					<div className="history-detail-head">
						<h3>{detail.report_sdate} ~ {detail.report_edate}</h3>
						<div className="dash-action-buttons">
							<button type="button" onClick={handleCopyText}>텍스트 복사</button>
							<button type="button" onClick={() => onGoEdit(detail.dt_seq)}>편집</button>
						</div>
					</div>
					{copyMsg && <div className="msg">{copyMsg}</div>}
					<ul className="history-items">
						{(detail.items || []).map((it, i) => (
							<li key={i}>
								<span className={'history-dot ' + (it.plan_yn === 'Y' ? 'dot-plan' : 'dot-result')} />
								<span className="history-item-job">{it.job_name}</span>
								<span className="history-item-label">{it.plan_yn === 'Y' ? '계획' : '실적'}</span>
								<span className="history-item-content">{it.content}</span>
								<span className="history-item-hour">{it.w_hour}h</span>
							</li>
						))}
						{(!detail.items || detail.items.length === 0) && (
							<li className="empty-hint">작성된 내용이 없습니다.</li>
						)}
					</ul>
				</div>
			)}
		</div>
	);
}
