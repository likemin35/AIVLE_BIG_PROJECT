// src/components/UploadImage.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import '../App.css';

// Cloud Run 서비스 URL (POST / 로 업로드)
const API_URL = 'https://image-ai-service-eck6h26cxa-uc.a.run.app';

function UploadImage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [spellCheckResult, setSpellCheckResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setSpellCheckResult('');
    setError('');
  };

  const handleUploadClick = async () => {
    if (!selectedFile) {
      setError('이미지 파일을 선택해주세요.');
      return;
    }
    setIsLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('API 호출에 실패했습니다.');

      const data = await response.json();
      setSpellCheckResult(data.spell_check_result || '');
    } catch (err) {
      setError(`오류가 발생했습니다: ${err.message}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const Navbar = () => (
    <header className="header-container">
      <div className="logo-section">
        <img src={logo} alt="로고" className="header-logo" />
      </div>
      <div className="nav-buttons">
        <button className="nav-btn" onClick={() => navigate('/')}>Home</button>
        <button className="nav-btn" onClick={() => navigate('/login')}>로그인</button>
        <button className="nav-btn" onClick={() => navigate('/signup')}>회원가입</button>
      </div>
    </header>
  );

  return (
    <div className="HomeContainer">
      <Navbar />
      <main className="main-content">
        <div className="hero-section">
          <h1 className="main-title">
            이미지 텍스트 <span className="highlight">오탈자 검수</span>
          </h1>

          <div className="upload-section">
            <div className="upload-container">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="file-input"
              />
              <button
                onClick={handleUploadClick}
                className="upload-btn"
                disabled={isLoading || !selectedFile}
                title={!selectedFile ? '이미지를 먼저 선택하세요' : undefined}
              >
                {isLoading ? '검수 중...' : '이미지 업로드 및 검수'}
              </button>
            </div>
            {selectedFile && (
              <div className="selected-file">
                선택된 파일: <strong>{selectedFile.name}</strong>
              </div>
            )}
          </div>

          {error && (
            <div className="error-message">
              <p>{error}</p>
            </div>
          )}

          {spellCheckResult && (
            <div className="result-section">
              <h3 className="section-title">오탈자 검수 결과</h3>
              <p className="result-text" style={{ whiteSpace: 'pre-line' }}>
                {spellCheckResult}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default UploadImage;
