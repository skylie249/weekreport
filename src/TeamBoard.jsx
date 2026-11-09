import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import DraftPreview from './DraftPreview.jsx';

// F6/E2(대리 등록): 대표자가 wr_delegate에 등록된 팀원을 대신 조회·작성·제출한다.
// 본인 작성 화면(ReportScreen)과 달리 대상 팀원마다 DraftPreview를 따로 띄워 검토를 강제한다.

const SUBMIT_LABELS = { Y: '제출 완료', N: '미제출' };
const DRAFT_LABELS = { NONE: '초안 없음', DRAFT: '초안 있음(미적용)', APPLIED: '적용됨' };
const HOLD_REASON_LABELS = {
	no_from: '보낸 사람을 확인할 수 없음',
	domain_mismatch: '사내 도메인이 아닌 주소',
	not_active_member: '재직 중인 팀원이 아님',
	no_delegate_relation: '어느 대표자의 팀원도 아님',
	auth_fail: '발신자 인증(SPF/DKIM) 실패',
	week_not_found: '해당하는 주차를 찾지 못함'
};

export default function TeamBoard({ onSessionOut }) {
	const [members, setMembers] = useState(undefined);
	const [holdInbox, setHoldInbox] = useState([]);
	const [pasteText, setPasteText] = useState('');
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState('');
	const [pasteResult, setPasteResult] = useState(null);
	const [activeDraft, setActiveDraft] = useState(null);

	const load = useCallback(async () => {
		const res = await api.getTeam();
		if (res.__sessionout) {
			onSessionOut();
			return;
		}
		setMembers(res.members || []);

		const inboxRes = await api.getTeamInbox();
		if (!inboxRes.__sessionout) {
			setHoldInbox(inboxRes.hold || []);
		}
	}, [onSessionOut]);

	useEffect(() => {
		load();
	}, [load]);

	const handlePaste = async () => {
		const text = pasteText.trim();
		if (!text) return;
		setBusy(true);
		setMsg('');
		try {
			const res = await api.pasteTeamMail(text);
			if (res.__sessionout) {
				onSessionOut();
				return;
			}
			setPasteResult(res);
			setPasteText('');
		} finally {
			setBusy(false);
		}
	};

	const handleApply = async (memail, draft, items, overwrite) => {
		const res = await api.applyTeamDraft(memail, draft.draft_id, items, overwrite);
		if (res.__sessionout) {
			onSessionOut();
			return;
		}
		if (res.result === 'forbidden') {
			alert('이 팀원을 대리할 권한이 없습니다.');
			setActiveDraft(null);
			return;
		}
		if (res.result === 'conflict') {
			alert('이미 작성된 내용이 있습니다. 덮어쓰려면 "덮어쓰기" 체크박스를 선택해주세요.');
			return;
		}
		if (res.result === 'submitted_locked') {
			alert('이미 제출된 주차에는 적용할 수 없습니다.');
			setActiveDraft(null);
			return;
		}
		if (res.result !== 'SUCCESS') {
			alert('적용에 실패했습니다. 다시 시도해주세요.');
			return;
		}
		setMsg((activeDraft ? activeDraft.mname : '') + '님 초안이 임시저장되었습니다. 내용을 다시 확인한 뒤 제출해주세요.');
		setActiveDraft(null);
		setPasteResult((prev) => (prev ? { ...prev, drafts: prev.drafts.filter((d) => d.memail !== memail) } : prev));
		load();
	};

	const handleSubmit = async (memail, mname) => {
		if (!window.confirm(mname + '님의 이번 주 보고를 제출할까요? 제출 후에는 수정할 수 없습니다.')) return;
		const res = await api.submitTeamMember(memail);
		if (res.__sessionout) {
			onSessionOut();
			return;
		}
		if (res.result === 'forbidden') {
			alert('이 팀원을 대리할 권한이 없습니다.');
			return;
		}
		if (res.result === 'no_draft') {
			alert('저장된 내용이 없어 제출할 수 없습니다. 먼저 초안을 적용해주세요.');
			return;
		}
		if (res.result === 'already_submitted') {
			alert('이미 제출되었습니다.');
			load();
			return;
		}
		if (res.result !== 'SUCCESS') {
			alert('제출에 실패했습니다. 다시 시도해주세요.');
			return;
		}
		setMsg(mname + '님의 보고가 제출되었습니다.');
		load();
	};

	if (members === undefined) {
		return <div className="center-loading">불러오는 중...</div>;
	}

	if (activeDraft) {
		return (
			<div className="team-draft-preview">
				<h3>{activeDraft.mname}님 초안 검토</h3>
				<DraftPreview
					draft={activeDraft.draft}
					onApply={(items, overwrite) => handleApply(activeDraft.memail, activeDraft.draft, items, overwrite)}
					onCancel={() => setActiveDraft(null)}
				/>
			</div>
		);
	}

	return (
		<div className="team-board">
			{msg && <div className="msg">{msg}</div>}

			<div className="team-paste">
				<h4>팀원 메일 붙여넣기</h4>
				<div className="empty-hint">
					여러 팀원이 보낸 메일을 한꺼번에 붙여넣으면, 보낸 사람 이메일을 기준으로 나눠 각자의 초안을 만듭니다.
				</div>
				<textarea
					rows={8}
					placeholder="전달받은 메일 내용을 붙여넣으세요"
					value={pasteText}
					onChange={(e) => setPasteText(e.target.value)}
				/>
				<div className="buttons">
					<button type="button" onClick={handlePaste} disabled={busy || !pasteText.trim()}>
						{busy ? '나누는 중...' : '나눠서 초안 만들기'}
					</button>
				</div>
			</div>

			{pasteResult && (
				<div className="team-paste-result">
					{pasteResult.unmatched_text && (
						<div className="draft-list draft-unmatched">
							<h4>어느 팀원과도 매칭되지 않은 부분</h4>
							<p>{pasteResult.unmatched_text}</p>
						</div>
					)}
					{(pasteResult.drafts || []).length === 0 ? (
						<div className="empty-hint">붙여넣은 내용에서 등록된 팀원을 찾지 못했습니다.</div>
					) : (
						<ul className="team-paste-drafts">
							{pasteResult.drafts.map((d) => (
								<li key={d.memail}>
									<span className="job-name">{d.mname}</span>
									{d.result === 'no_memo' && <span className="empty-hint">내용이 비어 있습니다.</span>}
									{d.result === 'no_week' && <span className="empty-hint">등록된 주차 정보가 없습니다.</span>}
									{d.draft_id && (
										<button type="button" onClick={() => setActiveDraft({ memail: d.memail, mname: d.mname, draft: d })}>
											초안 검토
										</button>
									)}
									{d.ai_fallback && <span className="empty-hint">AI 미사용 (원문 그대로 담김)</span>}
								</li>
							))}
						</ul>
					)}
				</div>
			)}

			{holdInbox.length > 0 && (
				<div className="team-hold">
					<h4>보류함 (메일 봇이 자동 처리하지 못한 메일)</h4>
					<ul className="team-member-list">
						{holdInbox.map((h) => (
							<li key={h.id}>
								<div className="dash-card-label">{h.mname || h.from_email} ({h.from_email})</div>
								<span className="empty-hint">{h.subject}</span>
								<span className="empty-hint">{HOLD_REASON_LABELS[h.hold_reason] || h.hold_reason}</span>
							</li>
						))}
					</ul>
				</div>
			)}

			<div className="team-members">
				<h4>대리 등록된 팀원</h4>
				{members.length === 0 ? (
					<div className="empty-hint">대리로 등록된 팀원이 없습니다. 관리자에게 등록을 요청하세요.</div>
				) : (
					<ul className="team-member-list">
						{members.map((m) => (
							<li key={m.memail}>
								<div className="dash-card-label">{m.mname} ({m.memail})</div>
								<span className={'badge ' + (m.submit_yn === 'Y' ? 'submitted' : 'draft')}>
									{SUBMIT_LABELS[m.submit_yn] || m.submit_yn}
								</span>
								<span className="empty-hint">{DRAFT_LABELS[m.draft_status] || m.draft_status}</span>
								<span>업무 {m.job_count}건 · {m.result_hours || 0}시간</span>
								{m.submit_yn !== 'Y' && (
									<button type="button" onClick={() => handleSubmit(m.memail, m.mname)}>제출</button>
								)}
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
