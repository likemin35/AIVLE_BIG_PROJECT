import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import iconStandard from './assets/icon-standard.png';
import iconTerms from './assets/icon-terms.png';
import logo from './assets/logo.png';
import './App.css';

function Home({ user }) {
  const [contractText, setContractText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // 파일 선택창 열기
  const CLOUD_RUN_API_BASE_URL =
      process.env.REACT_APP_CLOUD_RUN_API_BASE_URL ||
      'https://terms-api-service-eck6h26cxa-uc.a.run.app';

  const handleFileButtonClick = () => {
    fileInputRef.current.click();
  };

  // 파일 선택 처리
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
    setContractText(file.name); // 파일명 표시
  };

  // 업로드 버튼 클릭 처리
  const handleUploadClick = () => {
    if (!selectedFile) {
      alert('약관 파일을 선택해주세요.');
      return;
    }

    // FormData 생성
    const formData = new FormData();
    formData.append('file', selectedFile);

    // API 요청 URL에 CLOUD_RUN_API_BASE_URL 사용
    fetch(`${CLOUD_RUN_API_BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData,
      mode: 'cors',
    })
        .then(async (res) => {
          if (!res.ok) {
            // 에러일 경우 서버가 JSON을 보내면 메시지를 파싱
            let errorMsg = `HTTP error! status: ${res.status}`;
            try {
              const errorData = await res.json();
              errorMsg = errorData.message || errorMsg;
            } catch {
              // JSON 파싱 실패 시 기본 메시지 사용
            }
            throw new Error(errorMsg);
          }
          return res.json();
        })
        .then((data) => {
          alert(`업로드 완료: ${data.message || selectedFile.name}`);
        })
        .catch((err) => {
          console.error(err);
          alert(`업로드 중 오류가 발생했습니다: ${err.message}`);
        });
  };

  // 파일 삭제 함수 추가
  const handleRemoveFile = () => {
    setSelectedFile(null);
    setContractText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // input 초기화
    }
  };

  const handleIconClick = (type) => {
    if (type === 'terms') {
      navigate('/create-terms');
    } else if (type === 'labor') {
      navigate('/upload-image');
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
              {/* 숨겨진 파일 입력 */}
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              {/* 클릭 가능한 텍스트 입력 */}
              <input
                type="text"
                placeholder="분석할 약관을 업로드 하세요"
                value={selectedFile ? selectedFile.name : ''}
                readOnly
                onClick={handleFileButtonClick}
                className="upload-input"
                aria-label="분석할 약관 파일 선택"
              />

              {/* X 버튼 (파일 선택 시만 표시) */}
              {selectedFile && (
                <button
                  onClick={handleRemoveFile}
                  className="remove-file-btn"
                  aria-label="선택한 파일 제거"
                >
                  <span className="remove-icon">✕</span>
                </button>
              )}

              {/* 업로드 버튼 */}
              <button className="upload-btn" onClick={handleUploadClick}>
                약관 업로드
              </button>
            </div>
          </div>

          <div className="contract-creation">
            <div className="contract-options centered-options">
              <div
                className="contract-option"
                onClick={() => handleIconClick('terms')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleIconClick('terms')}
                aria-label="약관 초안 생성 페이지로 이동"
              >
                <img
                  src={iconTerms}
                  alt="약관 초안 생성"
                  className="option-icon"
                />
                <span className="option-text">약관 초안 생성</span>
              </div>
              <div
                className="contract-option"
                onClick={() => handleIconClick('labor')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleIconClick('labor')}
                aria-label="이미지로 약관 검수 페이지로 이동"
              >
                <img
                  src={iconStandard}
                  alt="이미지로 약관 검수"
                  className="option-icon"
                />
                <span className="option-text">이미지로 약관 검수</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ▶ 오른쪽 하단 플로팅 버튼 */}
      <button
        className="floating-about-btn"
        onClick={() => navigate('/about')}
        aria-label="보라계약 설명 페이지로 이동"
      >
        보라계약 알아보기<span className="arrow">→</span>
      </button>
    </div>
  );
}

export default Home;
