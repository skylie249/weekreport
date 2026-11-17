import { useEffect, useState } from 'react';
import { api } from './api.js';

const LEVELS = [1, 2, 3, 4, 5];

// TODO: 사내 기준 확인 - 레벨별 의미가 정해지면 아래 값을 채워넣는다.
const LEVEL_LABELS = {
	1: 'TODO: 사내 기준 확인',
	2: 'TODO: 사내 기준 확인',
	3: 'TODO: 사내 기준 확인',
	4: 'TODO: 사내 기준 확인',
	5: 'TODO: 사내 기준 확인'
};

const LEVEL_TIP = Object.entries(LEVEL_LABELS).map(([lvl, label]) => lvl + ': ' + label).join('\n');

function Side({ side, label, data, onChange }) {
	return (
		<div className={'job-side ' + side}>
			<span className="side-label">
				<span className="dot" />
				{label}
			</span>
			<textarea
				className={'f-' + side + '-content'}
				placeholder={side === 'result' ? '이번 주에 실제로 한 일을 입력하세요' : '다음에 할 일(계획)을 입력하세요'}
				value={data.content}
				onChange={(e) => onChange('content', e.target.value)}
			/>
			<div className="side-meta">
				<label>
					시간{' '}
					<input
						type="number"
						step="0.5"
						min="0"
						value={data.w_hour}
						onChange={(e) => onChange('w_hour', e.target.value)}
					/>
				</label>
				<label>
					레벨{' '}
					<select value={data.content_lvl} onChange={(e) => onChange('content_lvl', e.target.value)}>
						{LEVELS.map((lvl) => (
							<option key={lvl} value={lvl}>{lvl}</option>
						))}
					</select>
					<span className="level-tip" title={LEVEL_TIP}>?</span>
				</label>
			</div>
		</div>
	);
}

// 팀장에게 보낼 의견은 메인 보고서 저장(doSave/doSubmit)과 별개 백엔드(wr-agent-platform)에
// 즉시 저장한다 — "평소대로" 버튼처럼 메인 저장과 실패 영역을 분리해둔 것과 같은 결.
// 쓰기 실패를 조용히 삼키면 바로 전날(2026-11-16) 할 일 기능이 겪은 것과 같은 "눌러도 반응
// 없음" 문제가 되므로, catch에서 반드시 눈에 보이는 에러 메시지를 띄운다.
function OpinionSection({ group, dtSeq, onSessionOut }) {
	const initial = group.opinion || { id: null, text: '' };
	const [id, setId] = useState(initial.id);
	const [text, setText] = useState(initial.text);
	const [saving, setSaving] = useState(false);
	const [msg, setMsg] = useState({ text: '', type: 'ok' });

	useEffect(() => {
		setId(initial.id);
		setText(initial.text);
		setMsg({ text: '', type: 'ok' });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [dtSeq, group.job_id, initial.id, initial.text]);

	const handleSave = async () => {
		setSaving(true);
		setMsg({ text: '', type: 'ok' });
		try {
			const trimmed = text.trim();
			if (!trimmed) {
				if (id) {
					const res = await api.deleteOpinion(id);
					if (res.__sessionout) { onSessionOut(); return; }
					if (res.result === 'agent_disabled') { setMsg({ text: res.message || '에이전트 기능을 사용할 수 없습니다.', type: 'error' }); return; }
					setId(null);
					setMsg({ text: '삭제되었습니다.', type: 'ok' });
				}
				return;
			}
			const res = await api.saveOpinion(dtSeq, group.job_id, trimmed);
			if (res.__sessionout) { onSessionOut(); return; }
			if (res.result === 'agent_disabled') { setMsg({ text: res.message || '에이전트 기능을 사용할 수 없습니다.', type: 'error' }); return; }
			setId(res.id);
			setMsg({ text: '저장되었습니다.', type: 'ok' });
		} catch (err) {
			setMsg({ text: '저장에 실패했습니다. 잠시 후 다시 시도해주세요. (' + err.message + ')', type: 'error' });
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="job-opinion">
			<span className="side-label">팀장님께 보낼 의견 (선택)</span>
			<textarea
				placeholder="이 프로젝트에 대해 팀장님께 직접 전달하고 싶은 의견이 있으면 적어주세요"
				value={text}
				onChange={(e) => setText(e.target.value)}
			/>
			<div className="job-opinion-bar">
				<button type="button" disabled={saving} onClick={handleSave}>
					{saving ? '저장 중…' : '의견 저장'}
				</button>
				<span className={'msg' + (msg.type === 'error' ? ' error' : '')}>{msg.text}</span>
			</div>
		</div>
	);
}

export default function JobCard({ group, dtSeq, onFieldChange, onCopy, onRemove, onSessionOut }) {
	return (
		<div className="job-card">
			<div className="job-head">
				<span className="job-name">{group.job_name}</span>
				<button type="button" className="remove-btn" title="이 업무 삭제" onClick={() => onRemove(group.job_id)}>
					삭제 ✕
				</button>
			</div>
			<div className="job-body">
				<Side
					side="result"
					label="실적 (한 일)"
					data={group.result}
					onChange={(field, value) => onFieldChange(group.job_id, 'result', field, value)}
				/>
				<div className="copy-col">
					<button type="button" className="fwd" title="실적 내용을 계획으로 복사" onClick={() => onCopy(group.job_id, 'result', 'plan')}>
						→
					</button>
					<span className="copy-tip">실적을<br />계획으로</span>
					<button type="button" className="rev" title="계획 내용을 실적으로 복사" onClick={() => onCopy(group.job_id, 'plan', 'result')}>
						←
					</button>
				</div>
				<Side
					side="plan"
					label="계획 (할 일)"
					data={group.plan}
					onChange={(field, value) => onFieldChange(group.job_id, 'plan', field, value)}
				/>
			</div>
			<OpinionSection group={group} dtSeq={dtSeq} onSessionOut={onSessionOut} />
		</div>
	);
}
