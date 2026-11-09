import { useState } from 'react';
import { api } from './api.js';

const ERROR_MESSAGES = {
	wrongMid: '존재하지 않는 계정입니다.',
	wrongMpassword: '비밀번호가 올바르지 않습니다.',
	locked: '로그인 실패가 너무 많아 잠겼습니다. 10분 후 다시 시도해주세요.'
};

export default function LoginScreen({ onLoggedIn }) {
	const [memail, setMemail] = useState('');
	const [mpassword, setMpassword] = useState('');
	const [error, setError] = useState('');
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError('');
		setSubmitting(true);
		try {
			const data = await api.login(memail, mpassword);
			if (data.result === 'success') {
				onLoggedIn(data.member);
			} else {
				setError(ERROR_MESSAGES[data.result] || '로그인에 실패했습니다.');
			}
		} catch (err) {
			setError('서버와 통신할 수 없습니다.');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="login-wrap">
			<form className="login-box" onSubmit={handleSubmit}>
				<h1>주간보고 등록</h1>
				<div className="login-msg">{error}</div>
				<input
					type="email"
					placeholder="이메일"
					autoComplete="username"
					required
					value={memail}
					onChange={(e) => setMemail(e.target.value)}
				/>
				<input
					type="password"
					placeholder="비밀번호"
					autoComplete="current-password"
					required
					value={mpassword}
					onChange={(e) => setMpassword(e.target.value)}
				/>
				<button type="submit" disabled={submitting}>{submitting ? '로그인 중...' : '로그인'}</button>
			</form>
		</div>
	);
}
