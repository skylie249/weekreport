import { useEffect, useState } from 'react';
import { api } from './api.js';

const DOW_OPTIONS = [
	{ value: 1, label: '월요일' },
	{ value: 2, label: '화요일' },
	{ value: 3, label: '수요일' },
	{ value: 4, label: '목요일' },
	{ value: 5, label: '금요일' },
	{ value: 6, label: '토요일' },
	{ value: 7, label: '일요일' }
];

export default function Settings({ onSessionOut, hasTeam }) {
	const [settings, setSettings] = useState(undefined);
	const [msg, setMsg] = useState('');
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		api.getSettings().then((res) => {
			if (res.__sessionout) {
				onSessionOut();
				return;
			}
			setSettings(res);
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const update = (field, value) => {
		setSettings((prev) => ({ ...prev, [field]: value }));
	};

	const handleSave = async () => {
		setSaving(true);
		setMsg('');
		try {
			const res = await api.updateSettings({
				ai_consent_yn: settings.ai_consent_yn,
				auto_draft_yn: settings.auto_draft_yn,
				auto_draft_dow: settings.auto_draft_dow,
				auto_draft_time: settings.auto_draft_time,
				mail_reminder_yn: settings.mail_reminder_yn
			});
			if (res.__sessionout) {
				onSessionOut();
				return;
			}
			setMsg(res.result === 'SUCCESS' ? '저장되었습니다.' : '저장에 실패했습니다.');
		} finally {
			setSaving(false);
		}
	};

	if (settings === undefined) {
		return <div className="center-loading">불러오는 중...</div>;
	}

	return (
		<div className="settings">
			<h3>설정</h3>

			<div className="settings-section">
				<label className="settings-row">
					<input
						type="checkbox"
						checked={settings.ai_consent_yn === 'Y'}
						onChange={(e) => update('ai_consent_yn', e.target.checked ? 'Y' : 'N')}
					/>
					<span>AI 사용 동의</span>
				</label>
				<p className="settings-hint">
					켜두면 간편 메모를 Gemini로 보내 보고서 초안을 만들 수 있습니다. 보내기 전 이메일·전화번호·실명·
					사전 등록 고객사명은 자동으로 가려집니다.
				</p>
			</div>

			<div className="settings-section">
				<label className="settings-row">
					<input
						type="checkbox"
						checked={settings.auto_draft_yn === 'Y'}
						onChange={(e) => update('auto_draft_yn', e.target.checked ? 'Y' : 'N')}
					/>
					<span>자동 초안 받기</span>
				</label>
				<p className="settings-hint">
					켜두면 매주 지정한 요일·시각에 시스템이 최근 작성 이력을 바탕으로 초안을 만들어둡니다.
					그 주가 완전히 비어 있을 때만 임시저장까지 되고, 이미 작성한 내용이 있으면 초안만 만들어 둡니다.
					제출은 절대 자동으로 되지 않습니다.
				</p>
				<div className="settings-row settings-subfields">
					<label>
						요일{' '}
						<select
							value={settings.auto_draft_dow}
							onChange={(e) => update('auto_draft_dow', Number(e.target.value))}
							disabled={settings.auto_draft_yn !== 'Y'}
						>
							{DOW_OPTIONS.map((d) => (
								<option key={d.value} value={d.value}>{d.label}</option>
							))}
						</select>
					</label>
					<label>
						시각{' '}
						<input
							type="time"
							value={settings.auto_draft_time}
							onChange={(e) => update('auto_draft_time', e.target.value)}
							disabled={settings.auto_draft_yn !== 'Y'}
						/>
					</label>
				</div>
			</div>

			{hasTeam && (
				<div className="settings-section">
					<label className="settings-row">
						<input
							type="checkbox"
							checked={settings.mail_reminder_yn === 'Y'}
							onChange={(e) => update('mail_reminder_yn', e.target.checked ? 'Y' : 'N')}
						/>
						<span>팀원 리마인드 메일(금요일 14시)</span>
					</label>
					<p className="settings-hint">
						켜두면 금요일 14시까지 [주간보고] 메일을 보내지 않은 팀원에게 안내 메일을 자동으로 보냅니다
						(팀원당 하루 최대 2통).
					</p>
				</div>
			)}

			{msg && <div className="msg">{msg}</div>}

			<div className="buttons">
				<button type="button" className="btn-submit" onClick={handleSave} disabled={saving}>
					{saving ? '저장 중...' : '저장'}
				</button>
			</div>
		</div>
	);
}
