import { useState } from 'react';

// F2(AI)·F3(전주 복사)·F5(자동 초안)가 공통으로 쓰는 초안 미리보기.
// 여기서는 수집한 항목과 덮어쓰기 여부만 상위로 올려주고, 실제 적용 API 호출은 호출부(Dashboard/History)가 한다.

const SOURCE_LABELS = {
	COPY: '전주 복사',
	AI: 'AI 생성',
	AUTO: '자동 초안',
	TEAM: '팀원 메일',
	MAIL: '메일 수집'
};

const LEVELS = [1, 2, 3, 4, 5];

function emptySide() {
	return { content: '', w_hour: '', content_lvl: '3' };
}

function buildGroups(items) {
	const map = new Map();
	const order = [];
	(items || []).forEach((it) => {
		if (!map.has(it.job_id)) {
			map.set(it.job_id, { job_id: it.job_id, job_name: it.job_name, result: emptySide(), plan: emptySide() });
			order.push(it.job_id);
		}
		const side = it.plan_yn === 'Y' ? 'plan' : 'result';
		map.get(it.job_id)[side] = {
			content: it.content || '',
			w_hour: it.w_hour === null || it.w_hour === undefined ? '' : String(it.w_hour),
			content_lvl: it.content_lvl === null || it.content_lvl === undefined ? '3' : String(it.content_lvl)
		};
	});
	return order.map((id) => map.get(id));
}

function DraftSide({ side, label, data, onChange }) {
	return (
		<div className={'job-side ' + side}>
			<span className="side-label">
				<span className="dot" />
				{label}
			</span>
			<textarea
				value={data.content}
				onChange={(e) => onChange('content', e.target.value)}
			/>
			<div className="side-meta">
				<label>
					시간{' '}
					<input type="number" step="0.5" min="0" value={data.w_hour} onChange={(e) => onChange('w_hour', e.target.value)} />
				</label>
				<label>
					레벨{' '}
					<select value={data.content_lvl} onChange={(e) => onChange('content_lvl', e.target.value)}>
						{LEVELS.map((lvl) => (
							<option key={lvl} value={lvl}>{lvl}</option>
						))}
					</select>
				</label>
			</div>
		</div>
	);
}

export default function DraftPreview({ draft, onApply, onCancel }) {
	const [groups, setGroups] = useState(() => buildGroups(draft.items));
	const [overwrite, setOverwrite] = useState(false);

	const handleFieldChange = (jobId, side, field, value) => {
		setGroups((prev) => prev.map((g) => (g.job_id !== jobId ? g : { ...g, [side]: { ...g[side], [field]: value } })));
	};

	const handleRemove = (jobId) => {
		setGroups((prev) => prev.filter((g) => g.job_id !== jobId));
	};

	const collectItems = () => {
		const items = [];
		groups.forEach((g) => {
			const resultContent = g.result.content.trim();
			const planContent = g.plan.content.trim();
			if (resultContent !== '') {
				items.push({ job_id: g.job_id, content: resultContent, w_hour: g.result.w_hour || '0', content_lvl: g.result.content_lvl || '1', plan_yn: 'N' });
			}
			if (planContent !== '') {
				items.push({ job_id: g.job_id, content: planContent, w_hour: g.plan.w_hour || '0', content_lvl: g.plan.content_lvl || '1', plan_yn: 'Y' });
			}
		});
		return items;
	};

	const handleApply = () => {
		const items = collectItems();
		if (items.length === 0) {
			alert('적용할 내용이 없습니다. 내용을 입력하거나 취소해주세요.');
			return;
		}
		onApply(items, overwrite);
	};

	return (
		<div className="draft-preview">
			<div className="draft-head">
				<span className={'source-badge'}>{SOURCE_LABELS[draft.source] || draft.source}</span>
				<span className="draft-week">
					{draft.report_sdate && draft.report_edate ? `${draft.report_sdate} ~ ${draft.report_edate}` : `${draft.dt_seq}주차`} 초안
				</span>
			</div>

			{draft.message && <div className="empty-hint">{draft.message}</div>}
			{groups.length === 0 && !draft.message && <div className="empty-hint">초안에 담긴 내용이 없습니다.</div>}

			<div className="draft-cards">
				{groups.map((g) => (
					<div key={g.job_id} className="job-card">
						<div className="job-head">
							<span className="job-name">{g.job_name}</span>
							<button type="button" className="remove-btn" title="이 업무 제외" onClick={() => handleRemove(g.job_id)}>
								제외 ✕
							</button>
						</div>
						<div className="job-body draft-job-body">
							<DraftSide side="result" label="실적 (한 일)" data={g.result} onChange={(f, v) => handleFieldChange(g.job_id, 'result', f, v)} />
							<DraftSide side="plan" label="계획 (할 일)" data={g.plan} onChange={(f, v) => handleFieldChange(g.job_id, 'plan', f, v)} />
						</div>
					</div>
				))}
			</div>

			{draft.excluded && draft.excluded.length > 0 && (
				<div className="draft-list draft-excluded">
					<h4>제외된 업무</h4>
					<ul>
						{draft.excluded.map((e, i) => (
							<li key={i}>{e.job_name} &mdash; {e.reason}</li>
						))}
					</ul>
				</div>
			)}

			{draft.unmatched && draft.unmatched.length > 0 && (
				<div className="draft-list draft-unmatched">
					<h4>어느 업무에도 매칭되지 않은 메모</h4>
					<ul>
						{draft.unmatched.map((u, i) => (
							<li key={i}>{u}</li>
						))}
					</ul>
				</div>
			)}

			<label className="overwrite-check">
				<input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
				이미 작성된 내용이 있으면 덮어쓰기
			</label>

			<div className="buttons">
				<button type="button" className="btn-save" onClick={onCancel}>취소</button>
				<button type="button" className="btn-submit" onClick={handleApply}>적용</button>
			</div>
		</div>
	);
}
