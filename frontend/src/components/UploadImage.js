// src/components/UploadImage.js
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import '../App.css';
import './UploadImage.css';

// Cloud Run 서비스 URL (POST / 로 업로드)
const API_URL = 'https://image-ai-service-eck6h26cxa-uc.a.run.app';

function UploadImage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [spellCheckResult, setSpellCheckResult] = useState(''); // 원본 응답 텍스트
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // ----- 파서: "$$수정전 -> 수정후" 포맷 분리 -----
  const { fullText, changes } = useMemo(() => {
    const raw = spellCheckResult || '';
    if (!raw.trim()) {
      return { fullText: '', changes: [] };
    }

    // 첫 번째 "$$" 이전은 "수정된 전문", 이후는 변경 목록으로 간주
    const firstIdx = raw.indexOf('$$');
    const full = (firstIdx >= 0 ? raw.slice(0, firstIdx) : raw).trim();

    // 나머지에서 "$$" 단위로 쪼개고, "수정전 -> 수정후"를 추출
    const rest = firstIdx >= 0 ? raw.slice(firstIdx) : '';
    const items = rest
      .split('$$')
      .map(s => s.trim())
      .filter(Boolean)
      .map(line => {
        // 줄바꿈이 끼어 있어도 첫 줄 우선 파싱
        const firstLine = line.split('\n')[0];
        const arrowIdx = firstLine.indexOf('->');
        if (arrowIdx >= 0) {
          const before = firstLine.slice(0, arrowIdx).trim();
          const after = firstLine.slice(arrowIdx + 2).trim();
          if (before && after) return { before, after };
        }
        return null;
      })
      .filter(Boolean);

    return { fullText: full, changes: items };
  }, [spellCheckResult]);

  // ----- 이벤트 핸들러 -----
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
    if (isLoading) return;

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

  // ----- 간단 네비게이션 바 -----
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

      <main className="image-main">
        <div className="image-container">
          {/* 왼쪽: 업로드 패널 */}
          <div className="image-left">
            <div className="panel-card">
              <h2 className="panel-title">이미지 업로드</h2>

              <div className="form-group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="file-input"
                />
              </div>

              {selectedFile && (
                <div className="selected-file">
                  선택된 파일: <strong>{selectedFile.name}</strong>
                </div>
              )}

              <button
                onClick={handleUploadClick}
                className="action-btn"
                disabled={isLoading || !selectedFile}
                title={!selectedFile ? '이미지를 먼저 선택하세요' : undefined}
              >
                {isLoading ? '검수 중...' : '이미지 업로드 및 검수'}
              </button>

              {error && <div className="error-banner">{error}</div>}
            </div>
          </div>

          {/* 오른쪽: 결과 프리뷰 */}
          <div className="image-right">
            {!spellCheckResult ? (
              <div className="preview-placeholder">
                <p className="muted">오른쪽 영역에 “수정된 전문”과 “변경 사항”이 표시됩니다.</p>
              </div>
            ) : (
              <div className="result-grid">
                <div className="result-card">
                  <h3 className="result-title">수정된 전문</h3>
                  <pre className="result-pre">{fullText}</pre>
                </div>

                <div className="result-card">
                  <h3 className="result-title">변경 사항</h3>

                  {changes.length === 0 ? (
                    <div className="no-change muted">변경 사항이 없습니다.</div>
                  ) : (
                    <ul className="changes-list">
                      {changes.map((item, idx) => (
                        <li key={`${item.before}-${idx}`} className="change-item">
                          <span className="badge-before">{item.before}</span>
                          <span className="arrow">→</span>
                          <span className="badge-after">{item.after}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default UploadImage;
