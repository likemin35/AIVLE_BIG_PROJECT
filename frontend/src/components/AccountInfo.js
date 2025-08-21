import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // useNavigate import
import { auth } from '../firebase';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, signOut } from 'firebase/auth'; // signOut import
import './AccountInfo.css';// 경로는 현재 파일 기준으로 맞춰주세요.


// --- 아이콘 컴포넌트 ---
const EyeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/><path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/></svg>;
const EyeSlashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="m10.79 12.912-1.614-1.615a3.5 3.5 0 0 1-4.474-4.474l-2.06-2.06C.938 6.278 0 8 0 8s3 5.5 8 5.5a7.029 7.029 0 0 0 2.79-.588zM5.21 3.088A7.028 7.028 0 0 1 8 3.5c5 0 8 5.5 8 5.5s-.939 1.721-2.641 3.238l-2.062-2.062a3.5 3.5 0 0 0-4.474-4.474L5.21 3.089z"/><path d="M5.525 7.646a2.5 2.5 0 0 0 2.829 2.829l-2.83-2.829zm4.95.708-2.829-2.83a2.5 2.5 0 0 1 2.829 2.829zm3.171 6-12-12 .708-.708 12 12-.708.708z"/></svg>;

const AccountInfo = () => {
    const user = auth.currentUser;
    const navigate = useNavigate();

    const [currentPwd, setCurrentPwd] = useState('');
    const [newPwd, setNewPwd] = useState('');
    const [confirmPwd, setConfirmPwd] = useState('');
    const [message, setMessage] = useState('');
    const [showNewPwd, setShowNewPwd] = useState(false);
    const [showConfirmPwd, setShowConfirmPwd] = useState(false);

    const isGoogleUser = user?.providerData?.[0]?.providerId === "google.com";

    const handleSave = async (e) => {
        e.preventDefault();
        if (!user) return;

        if (newPwd !== confirmPwd) {
            setMessage("새 비밀번호가 일치하지 않습니다.");
            return;
        }

        try {
            const credential = EmailAuthProvider.credential(user.email, currentPwd);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPwd);

            alert("비밀번호가 성공적으로 변경되었습니다. 보안을 위해 다시 로그인해주세요.");
            await signOut(auth);
            navigate('/login');

        } catch (error) {
            console.error(error);
            let errorMessage = "비밀번호 변경에 실패했습니다.";
            if (error.code === 'auth/wrong-password') {
                errorMessage = "현재 비밀번호가 올바르지 않습니다.";
            } else if (error.code === 'auth/weak-password') {
                errorMessage = "새 비밀번호는 6자 이상이어야 합니다.";
            }
            setMessage(errorMessage);
        }
    };

    return (
        <div className="account-info-container">
            <div className="mypage-card">
                <h2>계정 정보</h2>
                <div className="info-field">
                    <label>이름</label>
                    <span>{user?.displayName || 'N/A'}</span>
                </div>
                <div className="info-field">
                    <label>이메일</label>
                    <span>{user?.email}</span>
                </div>
            </div>

            {isGoogleUser ? (
                <div className="mypage-card">
                    <h2>비밀번호 변경</h2>
                    <p style={{ color: 'gray' }}>Google 계정으로 로그인한 사용자는 비밀번호를 변경할 수 없습니다.</p>
                </div>
            ) : (
                <form onSubmit={handleSave} className="mypage-card">
                    <h2>비밀번호 변경</h2>
                    <div className="form-field">
                        <label htmlFor="current-pwd">현재 비밀번호</label>
                        <input id="current-pwd" type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} required />
                    </div>
                    <div className="form-field">
                        <label htmlFor="new-pwd">새 비밀번호</label>
                        <div className="password-input-wrapper">
                            <input id="new-pwd" type={showNewPwd ? 'text' : 'password'} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required />
                            <button type="button" className="password-toggle-btn" onClick={() => setShowNewPwd(!showNewPwd)}>
                                {showNewPwd ? <EyeSlashIcon /> : <EyeIcon />}
                            </button>
                        </div>
                    </div>
                    <div className="form-field">
                        <label htmlFor="confirm-pwd">새 비밀번호 확인</label>
                        <div className="password-input-wrapper">
                            <input id="confirm-pwd" type={showConfirmPwd ? 'text' : 'password'} value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} required />
                            <button type="button" className="password-toggle-btn" onClick={() => setShowConfirmPwd(!showConfirmPwd)}>
                                {showConfirmPwd ? <EyeSlashIcon /> : <EyeIcon />}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="save-button">비밀번호 변경</button>
                    {message && <p className="message">{message}</p>}
                </form>
            )}

            <div style={{ marginTop: "20px", textAlign: "left" }}>
                <a
                    href="https://firebasestorage.googleapis.com/v0/b/aivle-team0721.firebasestorage.app/o/%E1%84%87%E1%85%A9%E1%84%85%E1%85%A1%E1%84%80%E1%85%A8%E1%84%8B%E1%85%A3%E1%86%A8_%E1%84%80%E1%85%A2%E1%84%8B%E1%85%B5%E1%86%AB%E1%84%8C%E1%85%A5%E1%86%BC%E1%84%87%E1%85%A9%E1%84%8E%E1%85%A5%E1%84%85%E1%85%B5%E1%84%87%E1%85%A1%E1%86%BC%E1%84%8E%E1%85%B5%E1%86%B7.pdf?alt=media&token=c0fe6d4c-f754-429d-ba6a-ebfa693430dd"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: "12px", color: "gray", textDecoration: "underline" }}
                >
                    개인정보처리방침
                </a>
            </div>
        </div>
    );
};

export default AccountInfo;
