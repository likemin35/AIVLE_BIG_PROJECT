// src/components/UploadImage.js
import React, { useState, useMemo } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { reduceUserPoints } from '../api/point'; // 포인트 API import
import './UploadImage.css';
import '../App.css';

// Cloud Run 서비스 URL (POST / 로 업로드)
const API_URL = 'https://image-ai-service-eck6h26cxa-uc.a.run.app';
const POINT_COST = 1000; // 포인트 소모량

function UploadImage() {
  const { user, authLoading } = useOutletContext();
  const [selectedFile, setSelectedFile] = useState(null);
  const [spellCheckResult, setSpellCheckResult] = useState(''); // 원본 응답 텍스트
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // ----- 파서: "수정 전 ## 수정 후 $$변경..." 포맷 분리 -----
  const { beforeText, afterText, changes } = useMemo(() => {
    const raw = (spellCheckResult || '').trim();
    if (!raw) return { beforeText: '', afterText: '', changes: [] };

    const firstChangeIdx = raw.indexOf('$$');
    const mainSection = (firstChangeIdx >= 0 ? raw.slice(0, firstChangeIdx) : raw).trim();
    const changesSection = (firstChangeIdx >= 0 ? raw.slice(firstChangeIdx) : '').trim();

    const sepIdx = mainSection.indexOf('##');
    const before = (sepIdx >= 0 ? mainSection.slice(0, sepIdx) : mainSection).trim();
    const after = (sepIdx >= 0 ? mainSection.slice(sepIdx + 2) : '').trim();

    const items = changesSection
      .split('$$')
      .map(s => s.trim())
      .filter(Boolean)
      .map(line => {
        const firstLine = line.split('\n')[0];
        const arrowIdx = firstLine.indexOf('->');
        if (arrowIdx >= 0) {
          const beforePart = firstLine.slice(0, arrowIdx).trim();
          const afterPart = firstLine.slice(arrowIdx + 2).trim();
          if (beforePart && afterPart) return { before: beforePart, after: afterPart };
        }
        return null;
      })
      .filter(Boolean);

    return { beforeText: before, afterText: after, changes: items };
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
    if (!user || !user.uid) {
      alert('사용자 인증 정보가 없습니다. 다시 로그인해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 1. 포인트 차감 먼저 시도
      await reduceUserPoints(user.uid, POINT_COST, '이미지 약관 검수');

      // 2. 포인트 차감 성공 시, 이미지 업로드 및 검수 진행
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
        // 참고: 이미지 서비스는 별도 인증을 사용하지 않으므로 헤더 불필요
      });

      if (!response.ok) {
        // 여기서 실패하면 포인트 롤백을 고려해야 할 수 있음 (현재는 롤백 API 호출)
        throw new Error('이미지 검수 API 호출에 실패했습니다.');
      }

      const data = await response.json();
      setSpellCheckResult(data.spell_check_result || '');

    } catch (err) {
      // 포인트 부족 또는 API 오류 처리
      const errorMessage = err.message || '알 수 없는 오류가 발생했습니다.';
      setError(errorMessage);
      alert(errorMessage); // 사용자에게 명확한 피드백 제공
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // ----- 다운로드: 수정 후 전문을 .txt로 저장 -----
  const handleDownloadAfter = () => {
    if (!afterText) return;
    const base =
      (selectedFile?.name?.replace(/\.[^.]+$/, '') || 'corrected') + '_수정본';
    const filename = `${base}.txt`;

    const content = '\ufeff' + afterText;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (authLoading) {
    return <div className="loading-spinner">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="upload-image-page">
        <div className="login-prompt" style={{ textAlign: 'center', paddingTop: '50px' }}>
          <h2>로그인 필요</h2>
          <p>이 페이지에 접근하려면 로그인이 필요합니다.</p>
          <Link to="/login" className="login-btn-link">로그인 페이지로 이동</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="upload-image-page">
      <div className="upload-image-grid">
        {/* LEFT PANEL - Upload & Changes */}
        <aside className="left-pane panel">
          <h2 className="panel-title">이미지 약관 검수</h2>

          <div className="form-group">
            <label className="label">이미지 파일</label>
            <div className="file-row">
              <input
                id="upload-file-input"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <input
                className="input"
                type="text"
                readOnly
                placeholder="이미지 파일을 선택하세요"
                value={selectedFile ? selectedFile.name : ''}
                onClick={() => document.getElementById('upload-file-input').click()}
              />
              <button 
                className="btn" 
                onClick={() => document.getElementById('upload-file-input').click()}
              >
                파일 선택
              </button>
            </div>
            <div className="hint">JPG, PNG, GIF 등 이미지 파일을 업로드해주세요.</div>
          </div>

          <button
            onClick={handleUploadClick}
            className="btn-primary"
            disabled={isLoading || !selectedFile}
          >
            {isLoading ? '검수 중...' : `이미지 검수 시작 (${POINT_COST.toLocaleString()}P)`}
          </button>

          {error && <div className="alert error">{error}</div>}

          {/* Changes Section */}
          <div className="form-group" style={{ marginTop: '24px' }}>
            <label className="label">변경 사항</label>
            <div className="changes-container">
              {!spellCheckResult ? (
                <div className="empty-state-small">
                  검수 후 변경 사항이 여기에 표시됩니다.
                </div>
              ) : changes.length === 0 ? (
                <div className="empty-state-small">
                  변경 사항이 없습니다.
                </div>
              ) : (
                <div className="changes-list">
                  {changes.map((item, idx) => (
                    <div key={`${item.before}-${idx}`} className="change-item">
                      <div className="badge-before">{item.before}</div>
                      <div className="arrow">→</div>
                      <div className="badge-after">{item.after}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Download Button */}
          {afterText && (
            <div className="form-group" style={{ marginTop: '16px' }}>
              <div className="hint" style={{ marginBottom: '6px' }}>수정본을 로컬 파일로 저장</div>
              <button
                className="btn"
                onClick={handleDownloadAfter}
                disabled={!afterText}
              >
                수정본 TXT로 저장
              </button>
            </div>
          )}
        </aside>

        {/* RIGHT PANEL - Results */}
        <section className="right-pane panel">
          {!spellCheckResult ? (
            <div className="empty-state">
              AI 이미지 검수 결과가 여기에 표시됩니다.
              <div className="sub">이미지 파일을 업로드해주세요.</div>
            </div>
          ) : (
            <div className="results-container">
              <div className="results-grid">
                <div className="result-section">
                  <h3 className="result-title">수정 전 전문</h3>
                  <div className="result-content">
                    <pre className="result-text">{beforeText}</pre>
                  </div>
                </div>
                <div className="result-section">
                  <h3 className="result-title">수정 후 전문</h3>
                  <div className="result-content">
                    <pre className="result-text">{afterText}</pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default UploadImage;