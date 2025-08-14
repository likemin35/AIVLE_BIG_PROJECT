// src/components/UploadImage.js
import React, { useState, useMemo } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { reduceUserPoints } from '../api/point'; // 포인트 API import
import '../App.css';
import './UploadImage.css';

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
      <main className="image-main">
        <div className="login-prompt" style={{ textAlign: 'center', paddingTop: '50px' }}>
          <h2>로그인 필요</h2>
          <p>이 페이지에 접근하려면 로그인이 필요합니다.</p>
          <Link to="/login" className="login-btn-link">로그인 페이지로 이동</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="image-main">
      <div className="image-container">
        {/* 왼쪽: 업로드 패널 + 변경 사항 */}
        <div className="image-left">
          <div className="panel-card">
            <h2 className="panel-title">이미지 업로드</h2>

            <div className="file-picker">
              <input
                id="upload-file-input"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="file-input-hidden"
              />
              <label htmlFor="upload-file-input" className="file-select-btn">
                파일 선택
              </label>
              <div className="file-selected-name">
                {selectedFile ? selectedFile.name : '선택된 파일이 없습니다.'}
              </div>
            </div>

            <button
              onClick={handleUploadClick}
              className="action-btn"
              disabled={isLoading || !selectedFile}
              title={!selectedFile ? '이미지를 먼저 선택하세요' : undefined}
            >
              {isLoading ? '검수 중...' : `이미지 업로드 및 검수 (${POINT_COST.toLocaleString()}P)`}
            </button>

            {error && <div className="error-banner">{error}</div>}
          </div>

          {/* 변경 사항: 업로드 카드 아래에 출력 */}
          <div className="changes-card">
            <h3 className="result-title">변경 사항</h3>
            {!spellCheckResult ? (
              <div className="muted">업로드 후 변경 사항이 여기에 표시됩니다.</div>
            ) : changes.length === 0 ? (
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

        {/* 오른쪽: 수정 전/후 전문을 좌우로 + 다운로드 버튼 */}
        <div className="image-right">
          {!spellCheckResult ? (
            <div className="preview-placeholder">
              <p className="muted">검수 결과가 이 영역에 표시됩니다.</p>
            </div>
          ) : (
            <>
              <div className="download-bar">
                <button
                  className="download-btn"
                  onClick={handleDownloadAfter}
                  disabled={!afterText}
                  title={!afterText ? '수정 후 전문이 없습니다.' : undefined}
                >
                  수정본 txt로 다운로드
                </button>
              </div>

              <div className="two-col-results">
                <div className="result-card">
                  <h3 className="result-title">수정 전 전문</h3>
                  <pre className="result-pre">{beforeText}</pre>
                </div>
                <div className="result-card">
                  <h3 className="result-title">수정 후 전문</h3>
                  <pre className="result-pre">{afterText}</pre>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default UploadImage;