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

export default function JobCard({ group, onFieldChange, onCopy, onRemove }) {
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
		</div>
	);
}
