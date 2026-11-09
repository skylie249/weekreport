import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import LoginScreen from './LoginScreen.jsx';
import ReportScreen from './ReportScreen.jsx';
import Dashboard from './Dashboard.jsx';
import History from './History.jsx';
import Settings from './Settings.jsx';
import TeamBoard from './TeamBoard.jsx';

const BASE_TABS = [
	{ key: 'dashboard', label: '대시보드' },
	{ key: 'history', label: '조회' },
	{ key: 'edit', label: '작성' },
	{ key: 'settings', label: '설정' }
];

export default function App() {
	const [member, setMember] = useState(undefined); // undefined=로딩중, null=미인증, object=인증됨
	const [tab, setTab] = useState('dashboard');
	const [editDtSeq, setEditDtSeq] = useState(undefined);
	const [hasTeam, setHasTeam] = useState(false);

	const checkSession = useCallback(async () => {
		const data = await api.getSession();
		setMember(data.authenticated ? data.member : null);
	}, []);

	useEffect(() => {
		checkSession();
	}, [checkSession]);

	useEffect(() => {
		if (!member) {
			setHasTeam(false);
			return;
		}
		// 대리 등록(F6/E2) 탭은 wr_delegate에 등록된 팀원이 1명 이상일 때만 보여준다.
		api.getTeam().then((res) => {
			if (!res.__sessionout) {
				setHasTeam((res.members || []).length > 0);
			}
		});
	}, [member]);

	const TABS = hasTeam ? [...BASE_TABS, { key: 'team', label: '팀 대리 등록' }] : BASE_TABS;

	useEffect(() => {
		if (!member) return;
		const timer = setInterval(async () => {
			const data = await api.getSession();
			if (!data.authenticated) {
				alert('세션이 만료되었습니다. 다시 로그인해주세요.');
				setMember(null);
			}
		}, 5 * 60 * 1000);
		return () => clearInterval(timer);
	}, [member]);

	const handleLogout = async () => {
		await api.logout();
		setMember(null);
	};

	const goEdit = (dtSeq) => {
		setEditDtSeq(dtSeq);
		setTab('edit');
	};

	if (member === undefined) {
		return <div className="center-loading">불러오는 중...</div>;
	}

	if (!member) {
		return <LoginScreen onLoggedIn={(m) => { setMember(m); setTab('dashboard'); }} />;
	}

	return (
		<div className="app-shell">
			<div className="app-nav">
				<div className="app-nav-tabs">
					{TABS.map((t) => (
						<button
							key={t.key}
							type="button"
							className={'app-tab' + (tab === t.key ? ' active' : '')}
							onClick={() => (t.key === 'edit' ? goEdit(undefined) : setTab(t.key))}
						>
							{t.label}
						</button>
					))}
				</div>
				<div className="app-nav-user">
					<span>{member.mname}님 ({member.memail})</span>
					<a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }}>로그아웃</a>
				</div>
			</div>

			<div className="app-body">
				{tab === 'dashboard' && (
					<Dashboard onSessionOut={() => setMember(null)} onGoEdit={goEdit} onGoSettings={() => setTab('settings')} />
				)}
				{tab === 'history' && (
					<History onSessionOut={() => setMember(null)} onGoEdit={goEdit} />
				)}
				{tab === 'edit' && (
					<ReportScreen dtSeq={editDtSeq} onSessionOut={() => setMember(null)} />
				)}
				{tab === 'settings' && (
					<Settings onSessionOut={() => setMember(null)} hasTeam={hasTeam} />
				)}
				{tab === 'team' && hasTeam && (
					<TeamBoard onSessionOut={() => setMember(null)} />
				)}
			</div>
		</div>
	);
}
