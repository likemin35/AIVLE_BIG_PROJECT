import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import './ResetPassword.css';

function ResetPassword() {
    const [email, setEmail] = useState('');
    const navigate = useNavigate();

    const handleResetPassword = async () => {
        try {
            await sendPasswordResetEmail(auth, email);
            alert('비밀번호 재설정 이메일이 전송 되었습니다.');
            navigate('/login');
        } catch (error) {
            console.error('비밀번호 재설정 실패:', error);
            alert(error.message);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleResetPassword();
        }
    };

    return (
        <div className="reset-container">


            <div className="reset-box">
                <h2>비밀번호 재설정</h2>
                <input
                    type="email"
                    placeholder="이메일을 입력하세요"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <button onClick={handleResetPassword}>재설정 이메일 보내기</button>

                <p style={{ marginTop: '1rem', fontSize: '14px' }}>
                    로그인 페이지로 돌아가기?{' '}
                    <span
                        style={{ color: '#007BFF', cursor: 'pointer' }}
                        onClick={() => navigate('/login')}
                    >
                        로그인
                    </span>
                </p>
            </div>
        </div>
    );
}

export default ResetPassword;
