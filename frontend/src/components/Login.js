import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signOut, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../assets/logo.png';
import PolicyFooter from './PolicyFooter';
import './Login.css';

function Login({ user, authLoading }) { // user와 authLoading props를 받음
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [failCount, setFailCount] = useState(0);
  const [loginError, setLoginError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    // 인증 로딩이 끝나고 사용자가 이미 로그인된 상태라면, 알림 후 메인으로 이동
    if (!authLoading && user) {
      alert('이미 로그인되어 있습니다. 메인 페이지로 이동합니다.');
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (failCount >= 3) {
      alert('비밀번호를 3회 이상 틀렸습니다. 비밀번호 찾기로 이동합니다.');
      navigate('/reset-password');
    }
  }, [failCount, navigate]);

  const handleLogin = async () => {
    setLoginError('');

    // 이메일 형식 유효성 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setLoginError('올바른 이메일 형식이 아닙니다.');
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (!user.emailVerified) {
        await signOut(auth);
        setLoginError('이메일 인증 후 로그인 해주세요.');
        return;
      }

      alert('로그인 성공');
      setFailCount(0);
      navigate(from, { replace: true });

    } catch (error) {
      console.error('로그인 실패:', error);
      if (error.code === 'auth/invalid-credential') {
        setLoginError('아이디(이메일) 또는 비밀번호가 잘못 되었습니다.');
      } else {
        setLoginError('로그인 중 오류가 발생했습니다.');
      }
      setFailCount(prev => prev + 1);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      alert('Google 로그인 성공');
      navigate(from, { replace: true });
    } catch (error) {
      console.error('Google 로그인 실패:', error);
      alert(error.message);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  // 인증 로딩 중이거나, 이미 로그인된 사용자라서 리디렉션될 예정이라면 로딩 화면 표시
  if (authLoading || user) {
    return <div className="loading-spinner"></div>;
  }

  return (
      <div className="login-page">
        <header className="login-header">
          <div className="login-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <img src={logo} alt="보라계약 로고" className="login-logo-icon" />
          </div>
        </header>

        <main className="login-main">
          <div className="login-container">
            <div className="login-brand">
              <img src={logo} alt="보라계약 로고" className="login-brand-logo" />
              <h1 className="login-title">로그인</h1>
            </div>

            <div className="login-form">
              <input
                  type="email"
                  placeholder="이메일"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="login-input"
              />
              <input
                  type="password"
                  placeholder="비밀번호"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="login-input"
              />
              {loginError && <div className="login-error-msg">{loginError}</div>}
              <button className="login-submit-btn" onClick={handleLogin}>로그인</button>
              <button className="google-signin-btn" onClick={handleGoogleLogin}>
                <img src={require('../assets/google-logo.png')} alt="Google 로고" className="google-icon-img" />
                Sign in with Google
              </button>
              <div className="login-link" onClick={() => navigate('/signup')}>
                <span>아직 회원이 아니신가요? 회원가입</span>
              </div>
            </div>
          </div>
        </main>
      </div>
  );
}

export default Login;