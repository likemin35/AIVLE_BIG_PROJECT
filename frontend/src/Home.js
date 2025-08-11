// src/Home.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import iconStandard from './assets/icon-standard.png';
import iconRentMoney from './assets/icon-rent-money.png';
import iconLabor from './assets/icon-labor.png';
import iconTerms from './assets/icon-terms.png';
import logo from './assets/logo.png';
import './App.css';

function Home({ user }) {
  const [contractText, setContractText] = useState('');
  const navigate = useNavigate();

  const handleIconClick = (type) => {
    if (type === 'standard') {
      navigate('/create-standard');
    } else if (type === 'terms') {
      navigate('/create-terms');
    } else if (type === 'labor') {
      // ✅ 근로계약서 버튼 -> 업로드 페이지 라우팅
      navigate('/upload-image');
    } else if (type === 'rent') {
      // 필요 시 업로드 페이지로 연결하거나 다른 라우트로 변경
      alert('해당 서비스는 아직 준비중입니다.');
    } else {
      alert('해당 서비스는 아직 준비중입니다.');
    }
  };

  const handleSignUpClick = () => {
    navigate('/signup');
  };

  const handleLoginClick = () => {
    navigate('/login');
  };

  return (
    <div className="HomeContainer">
      <main className="main-content">
        <div className="hero-section">
          <h1 className="main-title">
            <span className="highlight">딸깍</span>으로 약관 생성
          </h1>

          <div className="brand-section">
            <div className="brand-icon">
              <img src={logo} alt="보라계약 로고" className="brand-logo" />
            </div>
          </div>

          <div className="upload-section">
            <div className="upload-container">
              <input
                type="text"
                placeholder="분석할 약관을 업로드 하세요"
                value={contractText}
                onChange={(e) => setContractText(e.target.value)}
                className="upload-input"
              />
              <button className="upload-btn">약관 업로드</button>
            </div>
          </div>

          <div className="contract-creation">
            <div className="contract-options">
              {/* <div className="contract-option" onClick={() => handleIconClick('standard')}>
                <img src={iconStandard} alt="표준 계약서" className="option-icon" />
                <span className="option-text">표준 계약서</span>
              </div> */}
              <div className="contract-option" onClick={() => handleIconClick('terms')}>
                <img src={iconTerms} alt="약관 초안 생성" className="option-icon" />
                <span className="option-text">약관 초안 생성</span>
              </div>
              <div className="contract-option" onClick={() => handleIconClick('labor')}>
                <img src={iconStandard} alt="이미지로 약관 검수" className="option-icon" />
                <span className="option-text">이미지로 약관 검수</span>
              </div>
              {/* <div className="contract-option" onClick={() => handleIconClick('rent')}>
                <img src={iconRentMoney} alt="차용증" className="option-icon" />
                <span className="option-text">차용증</span>
              </div> */}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Home;
