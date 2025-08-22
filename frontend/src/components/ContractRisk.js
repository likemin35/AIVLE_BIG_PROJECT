// src/components/ContractRisk.js
import React, { useState, useRef, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import './ContractRisk.css';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import { getAuth, getIdToken as fbGetIdToken } from 'firebase/auth';

// Firebase 토큰
const getToken = async (force = false) => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return null;
  return await fbGetIdToken(user, force);
};

// // API 베이스 결정: 배포는 동일 출처, 로컬 CRA(3000)는 게이트웨이 8088로 보정
// const resolveApiBase = () => {
//   const envBase = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/+$/, '');
//   if (envBase) return envBase;
//   if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
//     if (window.location.port === '3000') return 'http://localhost:8088';
//   }
//   return '';
// };

// const API_BASE = resolveApiBase();

// 서비스 마운트 경로 포함된 베이스
const ANALYZE_API_BASE_URL =
  process.env.REACT_APP_ANALYZE_API_BASE_URL || 'https://analyze-service-eck6h26cxa-uc.a.run.app';
const TERMS_API_BASE_URL =
  process.env.REACT_APP_TERMS_API_BASE_URL || 'https://term-service-eck6h26cxa-uc.a.run.app';

// 공통 fetch: Authorization 자동 첨부 + 401 시 1회 재시도
async function fetchWithAuth(url, init = {}, { requireAuth = true } = {}) {
  const headers = { ...(init.headers || {}) };
  if (requireAuth) {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return new Response(null, { status: 401 }); // 안전가드

    // 1차 토큰
    let idToken = await fbGetIdToken(user, false).catch(() => null);
    if (!idToken) idToken = await fbGetIdToken(user, true).catch(() => null);
    if (idToken) headers.Authorization = `Bearer ${idToken}`;

    // Term/Point 등이 기대하는 UID 헤더도 같이
    headers['x-authenticated-user-uid'] = user.uid;
  }

  // JSON 응답 사용하는 엔드포인트에서 타입 명시
  if (!('Accept' in headers)) headers['Accept'] = 'application/json';

  const res = await fetch(url, { ...init, headers });
  // (필요 시) 여기서도 401이면 호출부에서 에러 처리
  return res;
 }

// 응답이 JSON인지 확인(HTML 등 들어오면 즉시 에러)
function requireJson(res) {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('application/json')) {
    throw new Error(`Unexpected content-type from ${res.url}: ${ct || 'unknown'}`);
  }
  return res;
}

// 에러 메시지 추출
async function readError(res) {
  try { const d = await res.json(); return d.error || d.message || `HTTP ${res.status}`; }
  catch { try { return await res.text(); } catch { return `HTTP ${res.status}`; } }
}

function isPlainTextFile(file) {
  const type = (file.type || '').toLowerCase();
  if (type === 'text/plain') return true;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return ext === 'txt';
}

// 기본 파일명 제안
function suggestBaseName(file, pickedTitle) {
  const base =
    pickedTitle?.trim() ||
    (file ? file.name.replace(/\.[^.]+$/, '') : '분석결과');
  const date = new Date().toISOString().slice(0, 10);
  return `${base}_리스크분석_${date}`;
}

// 카테고리
const CATEGORY_OPTIONS = [
  { label: '보험(암 포함)', value: 'insurance' },
  { label: '예금',         value: 'deposit'   },
  { label: '대출',         value: 'loan'      },
];

const FILE_ACCEPT = '.txt,.pdf,.doc,.docx';

export default function ContractRisk() {
  // 입력 방식: 로컬 업로드 / My약관
  const [mode, setMode] = useState('local'); // 'local' | 'library'

  // 공통 상태
  const { user, authLoading } = useOutletContext();
  const [selectedFile, setSelectedFile] = useState(null);
  const [category, setCategory] = useState('insurance');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState({ count_clauses: 0, count_flagged: 0 });
  const [resultText, setResultText] = useState('');

  // 저장
  const [isSaving, setIsSaving] = useState(false);
  const [saveName, setSaveName] = useState(suggestBaseName(null));
  const fileRef = useRef(null);

  // My약관(라이브러리)
  const [myTerms, setMyTerms] = useState([]);     // [{id,title,version,createdAt,...}]
  const [selectedTermId, setSelectedTermId] = useState('');
  const [selectedTermTitle, setSelectedTermTitle] = useState('');

  // 파일명 제안 갱신
  useEffect(() => {
    setSaveName(suggestBaseName(selectedFile, mode === 'library' ? selectedTermTitle : undefined));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, selectedTermTitle, mode]);

  // 입력 방식이 라이브러리로 바뀌면 목록 로딩
  useEffect(() => {
    if (mode !== 'library') return;
    refreshMyTerms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // 로컬 파일 UI
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

  const getFinalFilename = () => {
    const base = (saveName || '분석결과').trim().replace(/[\\/:*?"<>|]+/g, '_');
    return `${base}.docx`;
  };

  const handleSaveDocx = async () => {
    if (!resultText) return;
    setIsSaving(true);
    try {
      const lines = resultText.split('\n');
      const doc = new Document({
        sections: [
          { children: lines.map(line => new Paragraph({ children: [new TextRun(line || ' ')] })) }
        ],
      });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, getFinalFilename());
    } catch (e) {
      console.error(e);
      alert('파일 저장 중 오류가 발생했습니다: ' + (e?.message || e));
    } finally {
      setIsSaving(false);
    }
  };

  // My약관 불러오기
  async function refreshMyTerms() {
    setError('');
    try {
      const res = await fetchWithAuth(`${TERMS_API_BASE_URL}`, {}, { requireAuth: true });
      if (!res.ok) throw new Error(await readError(res));
      requireJson(res);
      const list = await res.json();
      const sorted = (list || []).sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
      setMyTerms(sorted);
      if (sorted.length) {
        const first = sorted[0];
        setSelectedTermId(first.id);
        setSelectedTermTitle(first.title || '');
      } else {
        setSelectedTermId('');
        setSelectedTermTitle('');
      }
    } catch (e) {
      console.error(e);
      setError(`약관 목록을 불러오지 못했습니다: ${e.message}`);
    }
  }

  // 분석
  const analyze = async () => {
    setError('');
    setResultText('');
    setMeta({ count_clauses: 0, count_flagged: 0 });

    try {
      setLoading(true);

      if (mode === 'library') {
        // 내 약관 content로 분석
        if (!selectedTermId) {
          setError('불러올 약관을 선택하세요.');
          return;
        }

        const termRes = await fetchWithAuth(`${TERMS_API_BASE_URL}/${selectedTermId}`, {}, { requireAuth: true });
        if (!termRes.ok) throw new Error(await readError(termRes));
        requireJson(termRes);
        const term = await termRes.json();
        const text = (term?.content || '').trim();
        setSelectedTermTitle(term?.title || selectedTermTitle || '');
        if (!text) { setError('선택한 약관에 본문(content)이 없습니다.'); return; }

        const res = await fetchWithAuth(`${ANALYZE_API_BASE_URL}/api/analyze-terms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, category }),
        }, { requireAuth: true });
        if (!res.ok) throw new Error(await readError(res));
        requireJson(res);
        const data = await res.json();

        setMeta({ count_clauses: data.count_clauses || 0, count_flagged: data.count_flagged || 0 });
        const big = (data.results || [])
          .sort((a, b) => (a.index || 0) - (b.index || 0))
          .map(r => [ (r?.title || '').trim(), (r?.analysis || '').trim() ].filter(Boolean).join('\n'))
          .filter(Boolean)
          .join('\n\n');
        setResultText(big);
        return;
      }

      // 로컬 파일 업로드
      if (!selectedFile) {
        setError('분석할 약관 파일을 선택해주세요.');
        return;
      }

      if (isPlainTextFile(selectedFile)) {
        const fileText = await selectedFile.text();
        const res = await fetchWithAuth(`${ANALYZE_API_BASE_URL}/api/analyze-terms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: fileText, category }),
        }, { requireAuth: true });
        if (!res.ok) throw new Error(await readError(res));
        requireJson(res);
        const data = await res.json();
        setMeta({ count_clauses: data.count_clauses || 0, count_flagged: data.count_flagged || 0 });
        const big = (data.results || [])
          .sort((a, b) => (a.index || 0) - (b.index || 0))
          .map(r => [ (r?.title || '').trim(), (r?.analysis || '').trim() ].filter(Boolean).join('\n'))
          .filter(Boolean)
          .join('\n\n');
        setResultText(big);
      } else {
        const fd = new FormData();
        fd.append('file', selectedFile);
        fd.append('category', category);
        const res = await fetchWithAuth(`${ANALYZE_API_BASE_URL}/api/analyze-terms-upload`, {
          method: 'POST',
          body: fd
        }, { requireAuth: true });
        if (!res.ok) throw new Error(await readError(res));
        requireJson(res);
        const data = await res.json();
        setMeta({ count_clauses: data.count_clauses || 0, count_flagged: data.count_flagged || 0 });
        const big = (data.results || [])
          .sort((a, b) => (a.index || 0) - (b.index || 0))
          .map(r => [ (r?.title || '').trim(), (r?.analysis || '').trim() ].filter(Boolean).join('\n'))
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

  // 인증 상태에 따른 렌더링
  if (authLoading) {
    return <div className="loading-spinner">Loading...</div>;
  }

  if (!user) {
    return (
      <main className="risk-page">
        <div className="login-prompt" style={{ textAlign: 'center', paddingTop: '50px' }}>
          <h2>로그인 필요</h2>
          <p>이 페이지에 접근하려면 로그인이 필요합니다.</p>
          <Link to="/login" className="login-btn-link">로그인 페이지로 이동</Link>
        </div>
      </main>
    );
  }

  return (
    <div className="risk-page">
      <div className="main-card">
        <div className="main-card-header">약관 리스크 분석</div>

        <div className="risk-grid">
          {/* LEFT */}
          <aside className="left-pane panel">
            {/* 입력 방식 토글 */}
            <div className="group-box">
              <div className="group-title">입력 방식</div>
              <div className="seg">
                <button
                  type="button"
                  className={`seg-btn ${mode === 'local' ? 'active' : ''}`}
                  onClick={() => setMode('local')}
                >
                  내 PC에서 업로드
                </button>
                <button
                  type="button"
                  className={`seg-btn ${mode === 'library' ? 'active' : ''}`}
                  onClick={() => setMode('library')}
                >
                  My약관에서 불러오기
                </button>
              </div>
            </div>

            {/* 카테고리 */}
            <div className="group-box">
              <div className="group-title">약관 카테고리</div>
              <div className="seg">
                {CATEGORY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`seg-btn ${category === opt.value ? 'active' : ''}`}
                    onClick={() => setCategory(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 파일 업로드 or My약관 선택 */}
            {mode === 'local' ? (
              <div className="group-box">
                <div className="group-title">파일 업로드</div>

                <input
                  ref={fileRef}
                  type="file"
                  accept={FILE_ACCEPT}
                  style={{ display: 'none' }}
                  onChange={onChangeFile}
                />

                <div className="file-drop" onClick={onPickFile} role="button" tabIndex={0}>
                  {selectedFile ? (
                    <div className="file-selected">
                      <div className="file-name">{selectedFile.name}</div>
                      <button
                        type="button"
                        className="file-clear"
                        style={{ whiteSpace: 'nowrap' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (fileRef.current) fileRef.current.value = '';
                          onPickFile(); // 같은 파일 재선택 허용
                        }}
                      >
                        파일 변경
                      </button>
                    </div>
                  ) : (
                    <div className="file-placeholder">
                      TXT/PDF/DOCX 파일을 업로드 해주세요
                    </div>
                  )}
                </div>

                <button className="btn-primary analyze-btn" onClick={analyze} disabled={loading}>
                  {loading ? '분석 중...' : '약관 분석'}
                </button>
              </div>
            ) : (
              <div className="group-box">
                <div className="group-title">My약관 선택</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  <select
                    className="select"
                    value={selectedTermId}
                    onChange={(e) => {
                      setSelectedTermId(e.target.value);
                      const t = myTerms.find(x => x.id === e.target.value);
                      setSelectedTermTitle(t?.title || '');
                    }}
                  >
                    {myTerms.length === 0 && <option value="">불러올 약관이 없습니다</option>}
                    {myTerms.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.title} {t.version ? `(${t.version})` : ''}
                      </option>
                    ))}
                  </select>
                  <button className="btn" onClick={refreshMyTerms}>새로고침</button>
                </div>

                <button className="btn-primary analyze-btn" onClick={analyze} disabled={loading} style={{ marginTop: 10 }}>
                  {loading ? '분석 중...' : '약관 분석'}
                </button>
                <div className="hint" style={{ marginTop: 6 }}>
                  Firebase Storage의 PDF 원본에서 추출·저장된 <b>content</b> 텍스트로 분석합니다.
                </div>
              </div>
            )}

            {/* 결과 저장: 파일명 직접 입력 */}
            <div className="group-box">
              <div className="group-title">결과 저장</div>

              <label className="label" htmlFor="saveName">파일명</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                <input
                  id="saveName"
                  className="input"
                  type="text"
                  placeholder="파일명을 입력하세요 (확장자 자동 .docx)"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveDocx(); }}
                />
                <div className="hint" style={{ padding: '0 4px' }}>.docx</div>
              </div>

              <button
                className="btn-primary"
                onClick={handleSaveDocx}
                disabled={!resultText || isSaving}
                title={!resultText ? '먼저 약관 분석을 실행하세요.' : 'DOCX로 저장'}
                style={{ marginTop: 10 }}
              >
                {isSaving ? '저장 중...' : 'DOCX로 저장'}
              </button>

              {error && <div className="alert error" style={{ marginTop: 10 }}>{error}</div>}
            </div>
          </aside>

          {/* RIGHT */}
          <section className="right-pane panel" aria-busy={loading}>
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
                <div className="sub">
                  좌측에서 파일을 업로드하거나 My약관을 선택한 뒤 ‘약관 분석’을 눌러주세요.
                </div>
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
    </div>
  );
}