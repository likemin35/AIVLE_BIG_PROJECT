// ContractRisk.js
import React, { useState, useRef } from 'react';
import './ContractRisk.css';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';

const ANALYZE_API_BASE_URL =
  process.env.REACT_APP_ANALYZE_API_BASE_URL || 'http://localhost:8082';

// 드롭다운: 레이블과 서버로 보낼 값 분리(값은 서버 키로 통일)
const CATEGORY_OPTIONS = [
  { label: '보험(암 포함)', value: 'insurance' },
  { label: '예금',         value: 'deposit'   },
  { label: '대출',         value: 'loan'      },
];

// 서버 에러 메시지 뽑아내기
async function readError(res) {
  try {
    const data = await res.json();
    return data.error || data.message || `HTTP ${res.status}`;
  } catch {
    try { return await res.text(); } catch { return `HTTP ${res.status}`; }
  }
}

function isPlainTextFile(file) {
  const type = (file.type || '').toLowerCase();
  if (type === 'text/plain') return true;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return ext === 'txt';
}

export default function ContractRisk() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [category, setCategory] = useState('insurance');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState({ count_clauses: 0, count_flagged: 0 });
  const [resultText, setResultText] = useState(''); // 하나의 큰 텍스트 블록
  const [isSaving, setIsSaving] = useState(false);
  const fileRef = useRef(null);

  const onPickFile = () => fileRef.current?.click();

  const onChangeFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const validMimes = [
      'text/plain',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const validExts = ['txt', 'pdf', 'doc', 'docx'];
    const ext = (f.name.split('.').pop() || '').toLowerCase();

    if (!validMimes.includes(f.type) && !validExts.includes(ext)) {
      alert('TXT, PDF, DOC, DOCX 파일만 선택 가능합니다.');
      e.target.value = '';
      return;
    }
    setSelectedFile(f);
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  // 저장 파일명 생성
  const getBaseFilename = () => {
    const base = selectedFile
      ? selectedFile.name.replace(/\.[^.]+$/, '')
      : '분석결과';
    const date = new Date().toISOString().slice(0, 10);
    return `${base}_리스크분석_${date}`;
  };

  const handleSaveDocx = async () => {
    if (!resultText) return;
    setIsSaving(true);
    try {
      const lines = resultText.split('\n');
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: lines.map((line) =>
              new Paragraph({
                children: [new TextRun(line || ' ')],
              })
            ),
          },
        ],
      });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${getBaseFilename()}.docx`);
    } catch (e) {
      console.error(e);
      alert('파일 저장 중 오류가 발생했습니다: ' + (e?.message || e));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTxt = () => {
    if (!resultText) return;
    try {
      const blob = new Blob([resultText], { type: 'text/plain;charset=utf-8' });
      saveAs(blob, `${getBaseFilename()}.txt`);
    } catch (e) {
      console.error(e);
      alert('TXT 저장 중 오류가 발생했습니다: ' + (e?.message || e));
    }
  };

  // 백엔드 기본값 사용: top_k/threshold/limit는 보내지 않음
  const analyze = async () => {
    setError('');
    setResultText('');
    setMeta({ count_clauses: 0, count_flagged: 0 });

    if (!selectedFile) {
      setError('분석할 약관 파일을 선택해주세요.');
      return;
    }

    try {
      setLoading(true);

      if (isPlainTextFile(selectedFile)) {
        const fileText = await selectedFile.text();

        const res = await fetch(`${ANALYZE_API_BASE_URL}/api/analyze-terms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: fileText,
            category, // 'insurance' | 'deposit' | 'loan'
          }),
        });

        if (!res.ok) throw new Error(await readError(res));
        const data = await res.json();
        setMeta({ count_clauses: data.count_clauses || 0, count_flagged: data.count_flagged || 0 });

        // 결과를 하나의 큰 텍스트로 정렬(이미 서버가 조항 순서로 넣지만 한번 더 보장)
        const big = (data.results || [])
          .sort((a, b) => (a.index || 0) - (b.index || 0))
          .map((r) => {
            const title = (r?.title || '').trim();
            const body  = (r?.analysis || '').trim();
            return [title, body].filter(Boolean).join('\n');
          })
          .filter(Boolean)
          .join('\n\n'); // 블록 간 간격
        setResultText(big);
      } else {
        const fd = new FormData();
        fd.append('file', selectedFile);
        fd.append('category', category);

        const res = await fetch(`${ANALYZE_API_BASE_URL}/api/analyze-terms-upload`, {
          method: 'POST',
          body: fd,
        });

        if (!res.ok) throw new Error(await readError(res));
        const data = await res.json();
        setMeta({ count_clauses: data.count_clauses || 0, count_flagged: data.count_flagged || 0 });

        const big = (data.results || [])
          .sort((a, b) => (a.index || 0) - (b.index || 0))
          .map((r) => [ (r?.title || '').trim(), (r?.analysis || '').trim() ].filter(Boolean).join('\n'))
          .filter(Boolean)
          .join('\n\n');
        setResultText(big);
      }
    } catch (e) {
      setError(e.message || '분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="risk-page">
      <div className="risk-grid">
        {/* LEFT */}
        <aside className="left-pane panel">
          <h2 className="panel-title">약관 리스크 분석</h2>

          <div className="form-group">
            <label className="label">분석 카테고리</label>
            <select
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="label">분석할 파일</label>
            <div className="file-row">
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.pdf,.doc,.docx"
                style={{ display: 'none' }}
                onChange={onChangeFile}
              />
              <input
                className="input"
                type="text"
                readOnly
                placeholder="파일을 선택하세요"
                value={selectedFile ? selectedFile.name : ''}
                onClick={onPickFile}
              />
              {selectedFile ? (
                <button className="btn-ghost" onClick={clearFile} title="파일 지우기">✕</button>
              ) : (
                <button className="btn" onClick={onPickFile}>파일 선택</button>
              )}
            </div>
            <div className="hint">TXT/PDF/DOCX 파일을 업로드해주세요.</div>
          </div>

          <button className="btn-primary" onClick={analyze} disabled={loading}>
            {loading ? '분석 중...' : '약관 분석'}
          </button>

          {/* ▼ 업로드 버튼 바로 아래: 저장 버튼들 */}
          <div className="form-group" style={{ marginTop: 12 }}>
            <div className="hint" style={{ marginBottom: 6 }}>결과를 로컬 파일로 저장</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn"
                onClick={handleSaveDocx}
                disabled={!resultText || isSaving}
                title={!resultText ? '먼저 약관 분석을 실행하세요.' : 'DOCX로 저장'}
              >
                {isSaving ? '저장 중...' : '저장하기 (.docx)'}
              </button>
              <button
                className="btn-ghost"
                onClick={handleSaveTxt}
                disabled={!resultText}
                title={!resultText ? '먼저 약관 분석을 실행하세요.' : 'TXT로 저장'}
              >
                TXT로 저장
              </button>
            </div>
          </div>

          {error && <div className="alert error">{error}</div>}
        </aside>

        {/* RIGHT */}
        <section className="right-pane panel" aria-busy={loading}>
          {/* 로딩 오버레이 */}
          {loading && (
            <div className="loading-overlay">
              <div className="loading-card">
                <div className="spinner" />
                <div className="loading-title">분석 중입니다…</div>
                <div className="loading-sub">약관과 판례를 대조하고 있어요</div>
              </div>
            </div>
          )}

          {!resultText ? (
            <div className="empty-state">
              AI 약관 리스크 분석 결과가 여기에 표시됩니다.
              <div className="sub">TXT/PDF/DOCX 파일을 업로드해주세요.</div>
            </div>
          ) : (
            <div className="results">
              <div className="meta">
                총 조항 {meta.count_clauses}개 / 리스크 감지 {meta.count_flagged}개
              </div>
              <pre className="results-body">{resultText}</pre>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
