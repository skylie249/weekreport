import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import LoginScreen from './LoginScreen.jsx';
import ReportScreen from './ReportScreen.jsx';
import Dashboard from './Dashboard.jsx';
import History from './History.jsx';

const TABS = [
	{ key: 'dashboard', label: '대시보드' },
	{ key: 'history', label: '조회' },
	{ key: 'edit', label: '작성' }
];

export default function App() {
	const [member, setMember] = useState(undefined); // undefined=로딩중, null=미인증, object=인증됨
	const [tab, setTab] = useState('dashboard');
	const [editDtSeq, setEditDtSeq] = useState(undefined);

	const checkSession = useCallback(async () => {
		const data = await api.getSession();
		setMember(data.authenticated ? data.member : null);
	}, []);

	useEffect(() => {
		checkSession();
	}, [checkSession]);

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
					<Dashboard onSessionOut={() => setMember(null)} onGoEdit={goEdit} />
				)}
				{tab === 'history' && (
					<History onSessionOut={() => setMember(null)} onGoEdit={goEdit} />
				)}
				{tab === 'edit' && (
					<ReportScreen dtSeq={editDtSeq} onSessionOut={() => setMember(null)} />
				)}
			</div>
		</div>
	);
}
