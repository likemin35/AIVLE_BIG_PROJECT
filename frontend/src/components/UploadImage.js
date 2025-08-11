import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from './assets/logo.png';
import '../App.css'; // Home.js와 동일한 CSS 파일을 사용합니다.

// 백엔드 Cloud Run 서비스의 URL을 여기에 입력하세요.
// 예: 'https://image-ai-service-xxxxxxxx-uc.a.run.app'
const API_URL = 'YOUR_CLOUD_RUN_SERVICE_URL';

function UploadImage() {
  // 컴포넌트의 상태를 관리하는 Hooks입니다.
  const [selectedFile, setSelectedFile] = useState(null); // 사용자가 선택한 이미지 파일
  const [spellCheckResult, setSpellCheckResult] = useState(''); // API 응답 결과
  const [isLoading, setIsLoading] = useState(false); // 로딩 상태
  const [error, setError] = useState(''); // 에러 메시지
  const navigate = useNavigate();

  // 사용자가 파일을 선택했을 때 호출되는 함수입니다.
  const handleFileChange = (event) => {
    // 선택된 파일 객체를 상태에 저장합니다.
    setSelectedFile(event.target.files[0]);
    // 파일이 선택되면 기존 결과 및 에러 상태를 초기화합니다.
    setSpellCheckResult('');
    setError('');
  };

  // 업로드 버튼을 눌렀을 때 호출되는 함수입니다.
  const handleUploadClick = async () => {
    // 파일이 선택되지 않았을 경우 에러 처리
    if (!selectedFile) {
      setError('이미지 파일을 선택해주세요.');
      return;
    }

    // 로딩 상태를 true로 설정하여 사용자에게 진행 중임을 알립니다.
    setIsLoading(true);
    setError('');

    // FormData 객체를 생성하여 파일을 담습니다.
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      // 백엔드 API로 POST 요청을 보냅니다.
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
      });

      // 응답이 성공적인지 확인합니다.
      if (!response.ok) {
        throw new Error('API 호출에 실패했습니다.');
      }

      // JSON 형태의 응답을 파싱합니다.
      const data = await response.json();
      console.log(data); // 디버깅용 로그

      // 응답에서 오탈자 검수 결과를 가져와 상태에 저장합니다.
      setSpellCheckResult(data.spell_check_result);
      
    } catch (err) {
      // API 호출 중 발생한 에러를 처리합니다.
      setError(`오류가 발생했습니다: ${err.message}`);
      console.error(err);
    } finally {
      // 로딩 상태를 false로 변경하여 로딩을 종료합니다.
      setIsLoading(false);
    }
  };

  // 네비게이션바 컴포넌트 (Home.js와 일관성을 위해 단순화)
  const Navbar = () => {
    return (
      <header className="header-container">
        <div className="logo-section">
          <img src={logo} alt="로고" className="header-logo" />
        </div>
        <div className="nav-buttons">
          <button className="nav-btn" onClick={() => navigate('/')}>Home</button>
          <button className="nav-btn">로그인</button>
          <button className="nav-btn">회원가입</button>
        </div>
      </header>
    );
  };
  

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
              {/* 이미지 파일을 선택하는 input 요소 */}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="file-input"
              />
              <button 
                onClick={handleUploadClick} 
                className="upload-btn"
                disabled={isLoading} // 로딩 중일 때는 버튼 비활성화
              >
                {isLoading ? '검수 중...' : '이미지 업로드 및 검수'}
              </button>
            </div>
          </div>
          
          {/* 에러 메시지 표시 영역 */}
          {error && (
            <div className="error-message">
              <p>{error}</p>
            </div>
          )}

          {/* 오탈자 검수 결과 표시 영역 */}
          {spellCheckResult && (
            <div className="result-section">
              <h3 className="section-title">오탈자 검수 결과</h3>
              <p className="result-text">{spellCheckResult}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default UploadImage;