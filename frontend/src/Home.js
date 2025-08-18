// src/Home.js
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadTermFile } from './api/term';
import iconStandard from './assets/icon-standard.png';
import iconRisk from './assets/icon-risk.png';
import iconTerms from './assets/icon-terms.png';
import iconRisk from './assets/icon-risk.png';
import logo from './assets/logo.png';
import './App.css';

function Home({ user }) {
  const [contractText, setContractText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleFileButtonClick = () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!validTypes.includes(file.type)) {
      alert('PDF 또는 Word 파일만 업로드 가능합니다.');
      e.target.value = null;
      setSelectedFile(null);
      setContractText('');
      return;
    }

    setSelectedFile(file);
    setContractText(file.name);
  };

  const handleUploadClick = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (!selectedFile) {
      alert('약관 파일을 선택해주세요.');
      return;
    }
    if (isUploading) return;

    setIsUploading(true);
    try {
      const data = await uploadTermFile(selectedFile);
      alert(`업로드 완료: ${data.title || selectedFile.name}`);
      navigate('/contracts', { replace: true });
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert(`업로드 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setContractText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 홈 카드 클릭 핸들러
  const handleIconClick = (type) => {
    if (type === 'terms') {
      navigate('/create-terms');
    } else if (type === 'labor') {
      navigate('/upload-image');
    } else if (type === 'risk') {
      navigate('/analyze-terms'); 
    } else {
      alert('해당 서비스는 준비중입니다.');
    }
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
                type="file"
                accept=".pdf,.doc,.docx"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              <input
                type="text"
                placeholder="분석할 약관을 업로드 하세요"
                value={selectedFile ? selectedFile.name : ''}
                readOnly
                onClick={handleFileButtonClick}
                className="upload-input"
              />

              {selectedFile && (
                <button
                  onClick={handleRemoveFile}
                  style={{
                    marginLeft: '5px',
                    background: 'transparent',
                    border: 'none',
                    color: 'red',
                    fontSize: '18px',
                    cursor: 'pointer',
                  }}
                  aria-label="선택한 파일 제거"
                  title="선택한 파일 제거"
                >
                  ✕
                </button>
              )}

              <button className="upload-btn" onClick={handleUploadClick} disabled={isUploading}>
                {isUploading ? '업로드 중...' : '약관 업로드'}
              </button>
            </div>
          </div>

          <div className="contract-creation">
            <div className="contract-options centered-options">
              {/* 약관 초안 생성 */}
              <div className="contract-option" onClick={() => handleIconClick('terms')}>
                <img src={iconTerms} alt="약관 초안 생성" className="option-icon" />
                <span className="option-text">약관 초안 생성</span>
              </div>

              {/* 이미지로 약관 검수 */}
              <div className="contract-option" onClick={() => handleIconClick('labor')}>
                <img src={iconStandard} alt="이미지로 약관 검수" className="option-icon" />
                <span className="option-text">이미지로 약관 검수</span>
              </div>

              {/* 약관 리스크 탐지 (신규) */}
              <div className="contract-option" onClick={() => handleIconClick('risk')}>
                <img src={iconRisk} alt="약관 리스크 탐지" className="option-icon" />
                <span className="option-text">약관 리스크 탐지</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <button
        className="floating-about-btn"
        onClick={() => navigate('/about')}
        aria-label="보라계약 설명 페이지로 이동"
      >
        보라계약 알아보기 <span className="arrow">→</span>
      </button>
    </div>
  );
}

export default Home;
