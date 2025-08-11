// src/components/UploadImage.js
import React, { useState, useMemo } from 'react';
import '../App.css';
import './UploadImage.css';

// Cloud Run 서비스 URL (POST / 로 업로드)
const API_URL = 'https://image-ai-service-eck6h26cxa-uc.a.run.app';

function UploadImage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [spellCheckResult, setSpellCheckResult] = useState(''); // 원본 응답 텍스트
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // ----- 파서: "수정 전 ## 수정 후 $$변경..." 포맷 분리 -----
  const { beforeText, afterText, changes } = useMemo(() => {
    const raw = (spellCheckResult || '').trim();
    if (!raw) return { beforeText: '', afterText: '', changes: [] };

    // 먼저 변경 사항 시작 인덱스 (첫 $$)를 찾는다
    const firstChangeIdx = raw.indexOf('$$');
    const mainSection = (firstChangeIdx >= 0 ? raw.slice(0, firstChangeIdx) : raw).trim();
    const changesSection = (firstChangeIdx >= 0 ? raw.slice(firstChangeIdx) : '').trim();

    // 본문을 ##로 좌/우 분리
    const sepIdx = mainSection.indexOf('##');
    const before = (sepIdx >= 0 ? mainSection.slice(0, sepIdx) : mainSection).trim();
    const after = (sepIdx >= 0 ? mainSection.slice(sepIdx + 2) : '').trim();

    // 변경 사항 파싱: "$$수정전 -> 수정후" 라인 다수
    const items = changesSection
      .split('$$')
      .map(s => s.trim())
      .filter(Boolean)
      .map(line => {
        const firstLine = line.split('\n')[0]; // 혹시 줄바꿈 섞이면 첫 줄만
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
              {isLoading ? '검수 중...' : '이미지 업로드 및 검수'}
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

        {/* 오른쪽: 수정 전/후 전문을 좌우로 */}
        <div className="image-right">
          {!spellCheckResult ? (
            <div className="preview-placeholder">
              <p className="muted">검수 결과가 이 영역에 표시됩니다.</p>
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </main>
  );
}

export default UploadImage;
