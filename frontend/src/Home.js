// src/Home.js
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadTermFile } from './api/term';
import iconStandard from './assets/icon-standard.png';
import iconRisk from './assets/icon-risk.png';
import iconTerms from './assets/icon-terms.png';
import logo from './assets/logo.png';
import './App.css';
import PolicyLink from './components/PolicyLink';
import PDFModal from './components/PDFModal'; // ★ 경로 수정: ./PDFModal -> ./components/PDFModal

function Home({ user }) {
  const [contractText, setContractText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // ===== PDF Modal 상태 =====
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUrl, setModalUrl] = useState('');
  const [modalTitle, setModalTitle] = useState('');

  const openModal = (title, url) => {
    setModalTitle(title);
    setModalUrl(url);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalUrl('');
    setModalTitle('');
  };
  // ==========================

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

  // SignUp.js에서 쓰던 PDF 주소 그대로 사용
  const TERMS_URL =
    'https://firebasestorage.googleapis.com/v0/b/aivle-team0721.firebasestorage.app/o/%E1%84%87%E1%85%A9%E1%84%85%E1%85%A1%E1%84%80%E1%85%A8%E1%84%8B%E1%85%A3%E1%86%A8%20%E1%84%89%E1%85%A5%E1%84%87%E1%85%B5%E1%84%89%E1%85%B3%20%E1%84%8B%E1%85%B5%E1%84%8B%E1%85%AD%E1%86%BC%E1%84%8B%E1%85%A3%E1%86%A8%E1%84%80%E1%85%AA%E1%86%AB.pdf?alt=media&token=0c1285a4-9d0d-4e3d-8027-fad7384ea164';

  const PRIVACY_URL =
  'https://firebasestorage.googleapis.com/v0/b/aivle-team0721.firebasestorage.app/o/%E1%84%87%E1%85%A9%E1%84%85%E1%85%A1%E1%84%80%E1%85%A8%E1%84%8B%E1%85%A3%E1%86%A8_%E1%84%80%E1%85%A2%E1%84%8B%E1%85%B5%E1%86%AB%E1%84%8C%E1%85%A5%E1%86%BC%E1%84%87%E1%85%A9%E1%84%8E%E1%85%A5%E1%84%85%E1%85%B5%E1%84%87%E1%85%A1%E1%86%BC%E1%84%8E%E1%85%B5%E1%86%B7.pdf?alt=media&token=c0fe6d4c-f754-429d-ba6a-ebfa693430dd'
                          
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

      {/* ===== Footer 시작 ===== */}
      <footer className="site-footer" role="contentinfo">
        <div className="footer-inner" aria-label="회사 및 법적 고지">
          <div className="footer-left">
            <p className="footer-brand">
              <strong>보라파트너스</strong> <span className="divider" aria-hidden="true">|</span> 대표자: 이원준
            </p>
            <address className="footer-address">
              대전광역시 서구 문정로 48번길 30, 13층
            </address>
            <p className="footer-contact">
              대표번호: 112-114-119
              이메일: <a href="mailto:aivle0721@gmail.com">aivle0721@gmail.com</a>
            </p>
          </div>

          {/* 클릭 시 PDFModal 오픈 */}
          <nav className="footer-nav" aria-label="정책 링크">
          <PolicyLink layout="stack" />
        </nav>
        </div>

        <div className="footer-bottom">
          <small>© 2025 보라파트너스 All rights reserved.</small>
        </div>
      </footer>
      {/* ===== Footer 끝 ===== */}

      {/* PDF 모달 */}
      <PDFModal open={modalOpen} onClose={closeModal} pdfUrl={modalUrl} title={modalTitle} />
    </div>
  );
}

export default Home;
