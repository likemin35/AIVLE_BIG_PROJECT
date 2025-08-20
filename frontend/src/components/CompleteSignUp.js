// src/components/CompleteSignUp.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import PolicyLinks from './PolicyLink';
function CompleteSignUp() {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [marketing, setMarketing] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    const user = auth.currentUser;
    if (!user) {
      alert('사용자 인증이 필요합니다.');
      return;
    }

    try {
      await setDoc(doc(db, 'users', user.uid), {
        name,
        company,
        email: user.email,
        marketingAgreed: marketing,
        completedAt: new Date(),
      });

      alert('정보 입력이 완료되었습니다.');
      navigate('/');
    } catch (error) {
      console.error('정보 저장 실패:', error);
      alert(error.message);
    }
  };

  return (
    <div className="complete-signup-page">
      <h2>회원 정보 입력</h2>
      <input
        type="text"
        placeholder="이름"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="text"
        placeholder="회사명"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
      />
      <label>
        <input
          type="checkbox"
          checked={marketing}
          onChange={(e) => setMarketing(e.target.checked)}
        />
        마케팅 수신 동의
      </label>
      <button onClick={handleSubmit}>완료</button>
  <div className="policy-links">
    <PolicyLinks />
  </div>
</div>
);
}

export default CompleteSignUp;