import React, { useEffect, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import { getAuth, getIdToken as fbGetIdToken } from 'firebase/auth';
import { getTermJob, requestAnalyzeTermsFileJob, requestAnalyzeTermsJob } from '../api/term';
import './ContractRisk.css';

const TERMS_API_BASE_URL =
  process.env.REACT_APP_TERM_API_BASE_URL || 'http://localhost:8080';

const CATEGORY_OPTIONS = [
  { label: '보험', value: 'insurance' },
  { label: '예금', value: 'deposit' },
  { label: '대출', value: 'loan' },
];

const FILE_ACCEPT = '.txt,.pdf,.doc,.docx';

async function fetchWithAuth(url, init = {}, { requireAuth = true } = {}) {
  const headers = { ...(init.headers || {}) };
  if (requireAuth) {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return new Response(null, { status: 401 });

    let idToken = await fbGetIdToken(user, false).catch(() => null);
    if (!idToken) idToken = await fbGetIdToken(user, true).catch(() => null);
    if (idToken) headers.Authorization = `Bearer ${idToken}`;
    headers['x-authenticated-user-uid'] = user.uid;
  }

  if (!('Accept' in headers)) headers.Accept = 'application/json';
  return fetch(url, { ...init, headers });
}

function requireJson(res) {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('application/json')) {
    throw new Error(`Unexpected content-type from ${res.url}: ${ct || 'unknown'}`);
  }
  return res;
}

async function readError(res) {
  try {
    const data = await res.json();
    return data.error || data.errorMessage || data.message || `HTTP ${res.status}`;
  } catch {
    try {
      return await res.text();
    } catch {
      return `HTTP ${res.status}`;
    }
  }
}

function suggestBaseName(file, pickedTitle) {
  const base = pickedTitle?.trim() || (file ? file.name.replace(/\.[^.]+$/, '') : '분석결과');
  const date = new Date().toISOString().slice(0, 10);
  return `${base}_리스크분석_${date}`;
}

function esc(s) {
  return (s || '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

function colorize(raw) {
  return (raw || '')
    .split(/\r?\n/)
    .map((line) => {
      const safe = esc(line);
      const isSuggest = /^\s*수정\s*제안\s*:/.test(line);
      const isProblemTag = /^\s*(\d+[.)]\s*)?\[문제가 되는 조항\]/.test(line);
      if (isSuggest) return `<span class="suggest">${safe}</span>`;
      if (isProblemTag) return `<span class="problem">${safe}</span>`;
      return safe;
    })
    .join('\n');
}

export default function ContractRisk() {
  const { user, authLoading } = useOutletContext();
  const [mode, setMode] = useState('local');
  const [selectedFile, setSelectedFile] = useState(null);
  const [category, setCategory] = useState('insurance');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState({ count_clauses: 0, count_flagged: 0 });
  const [resultText, setResultText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveName, setSaveName] = useState(suggestBaseName(null));
  const [myTerms, setMyTerms] = useState([]);
  const [selectedTermId, setSelectedTermId] = useState('');
  const [selectedTermTitle, setSelectedTermTitle] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    setSaveName(suggestBaseName(selectedFile, mode === 'library' ? selectedTermTitle : undefined));
  }, [selectedFile, selectedTermTitle, mode]);

  useEffect(() => {
    if (mode === 'library') {
      refreshMyTerms();
    }
  }, [mode]);

  const onPickFile = () => fileRef.current?.click();

  const onChangeFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validMimes = [
      'text/plain',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const validExts = ['txt', 'pdf', 'doc', 'docx'];
    const ext = (file.name.split('.').pop() || '').toLowerCase();

    if (!validMimes.includes(file.type) && !validExts.includes(ext)) {
      alert('TXT, PDF, DOC, DOCX 파일만 선택 가능합니다.');
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
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
          { children: lines.map((line) => new Paragraph({ children: [new TextRun(line || ' ')] })) },
        ],
      });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, getFinalFilename());
    } catch (e) {
      alert(`파일 저장 중 오류가 발생했습니다: ${e?.message || e}`);
    } finally {
      setIsSaving(false);
    }
  };

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
        setSelectedTermId(sorted[0].id);
        setSelectedTermTitle(sorted[0].title || '');
      } else {
        setSelectedTermId('');
        setSelectedTermTitle('');
      }
    } catch (e) {
      setError(`약관 목록을 불러오지 못했습니다. ${e.message}`);
    }
  }

  async function pollJobUntilDone(jobId, timeoutMs = 180000, intervalMs = 3000) {
    const startedAt = Date.now();
    let currentJob = await getTermJob(jobId);

    while (Date.now() - startedAt < timeoutMs) {
      if (currentJob.status === 'DONE' || currentJob.status === 'FAILED') {
        return currentJob;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      currentJob = await getTermJob(jobId);
    }

    return currentJob;
  }

  const analyze = async () => {
    setError('');
    setResultText('');
    setMeta({ count_clauses: 0, count_flagged: 0 });

    try {
      setLoading(true);

      if (mode === 'library') {
        if (!selectedTermId) {
          setError('불러올 약관을 선택해주세요.');
          return;
        }

        const termRes = await fetchWithAuth(`${TERMS_API_BASE_URL}/${selectedTermId}`, {}, { requireAuth: true });
        if (!termRes.ok) throw new Error(await readError(termRes));
        requireJson(termRes);
        const term = await termRes.json();
        setSelectedTermTitle(term?.title || selectedTermTitle || '');

        if (!(term?.content || '').trim()) {
          setError('선택한 약관의 본문(content)이 없습니다.');
          return;
        }

        const job = await requestAnalyzeTermsJob(selectedTermId, category);
        if (!job?.jobId) {
          throw new Error('약관 분석 Job 생성에 실패했습니다.');
        }

        const latestJob = await pollJobUntilDone(job.jobId);
        if (latestJob.status !== 'DONE') {
          throw new Error(latestJob.errorMessage || '약관 분석 작업이 완료되지 않았습니다.');
        }

        const completedTermRes = await fetchWithAuth(`${TERMS_API_BASE_URL}/${selectedTermId}`, {}, { requireAuth: true });
        if (!completedTermRes.ok) throw new Error(await readError(completedTermRes));
        requireJson(completedTermRes);
        const completedTerm = await completedTermRes.json();

        const riskText = (completedTerm?.risk || '').trim();
        setMeta({ count_clauses: 0, count_flagged: riskText ? 1 : 0 });
        setResultText(riskText || '분석 결과가 비어 있습니다.');
        return;
      }

      if (!selectedFile) {
        setError('분석할 약관 파일을 선택해주세요.');
        return;
      }

      const job = await requestAnalyzeTermsFileJob(selectedFile, category);
      if (!job?.jobId) {
        throw new Error('?쎄? 遺꾩꽍 Job ?앹꽦???ㅽ뙣?덉뒿?덈떎.');
      }

      const latestJob = await pollJobUntilDone(job.jobId);
      if (latestJob.status !== 'DONE') {
        throw new Error(latestJob.errorMessage || '?쎄? 遺꾩꽍 ?묒뾽???꾨즺?섏? ?딆븯?듬땲??');
      }

      const result = latestJob.result || {};
      const riskText = (result.text || '').trim();
      setMeta({
        count_clauses: result.count_clauses || 0,
        count_flagged: result.count_flagged || 0,
      });
      setResultText(riskText || '遺꾩꽍 寃곌낵媛 鍮꾩뼱 ?덉뒿?덈떎.');
    } catch (e) {
      setError(e.message || '분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return <div className="loading-spinner">Loading...</div>;
  }

  if (!user) {
    return (
      <main className="risk-page">
        <div className="login-prompt" style={{ textAlign: 'center', paddingTop: '50px' }}>
          <h2>로그인이 필요</h2>
          <p>이 페이지를 이용하려면 로그인이 필요합니다.</p>
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
          <aside className="left-pane panel">
            <div className="group-box">
              <div className="group-title">입력 방식</div>
              <div className="seg">
                <button
                  type="button"
                  className={`seg-btn ${mode === 'local' ? 'active' : ''}`}
                  onClick={() => setMode('local')}
                >
                  내 PC 파일
                </button>
                <button
                  type="button"
                  className={`seg-btn ${mode === 'library' ? 'active' : ''}`}
                  onClick={() => setMode('library')}
                >
                  저장된 약관
                </button>
              </div>
            </div>

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
                          onPickFile();
                        }}
                      >
                        파일 변경
                      </button>
                    </div>
                  ) : (
                    <div className="file-placeholder">TXT/PDF/DOCX 파일을 업로드해주세요</div>
                  )}
                </div>
                <button className="btn-primary analyze-btn" onClick={analyze} disabled={loading}>
                  {loading ? '분석 중...' : '약관 분석'}
                </button>
              </div>
            ) : (
              <div className="group-box">
                <div className="group-title">저장된 약관 선택</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  <select
                    className="select"
                    value={selectedTermId}
                    onChange={(e) => {
                      setSelectedTermId(e.target.value);
                      const term = myTerms.find((item) => item.id === e.target.value);
                      setSelectedTermTitle(term?.title || '');
                    }}
                  >
                    {myTerms.length === 0 && <option value="">불러올 약관이 없습니다</option>}
                    {myTerms.map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.title} {term.version ? `(${term.version})` : ''}
                      </option>
                    ))}
                  </select>
                  <button className="btn" onClick={refreshMyTerms}>새로고침</button>
                </div>
                <button className="btn-primary analyze-btn" onClick={analyze} disabled={loading} style={{ marginTop: 10 }}>
                  {loading ? '분석 중...' : '약관 분석'}
                </button>
                <div className="hint" style={{ marginTop: 6 }}>
                  저장된 약관은 비동기 Job으로 분석됩니다.
                </div>
              </div>
            )}

            <div className="group-box">
              <div className="group-title">결과 저장</div>
              <label className="label" htmlFor="saveName">파일명</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                <input
                  id="saveName"
                  className="input"
                  type="text"
                  placeholder="파일명을 입력하세요"
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
                style={{ marginTop: 10 }}
              >
                {isSaving ? '저장 중...' : 'DOCX로 저장'}
              </button>
              {error && <div className="alert error" style={{ marginTop: 10 }}>{error}</div>}
            </div>
          </aside>

          <section className="right-pane panel" aria-busy={loading}>
            {loading && (
              <div className="loading-overlay">
                <div className="loading-card">
                  <div className="spinner" />
                  <div className="loading-title">분석 중입니다</div>
                  <div className="loading-sub">긴 작업은 비동기 Job으로 처리됩니다.</div>
                </div>
              </div>
            )}

            {!resultText ? (
              <div className="empty-state">
                AI 약관 리스크 분석 결과가 여기에 표시됩니다.
                <div className="sub">좌측에서 파일을 업로드하거나 저장된 약관을 선택하세요.</div>
              </div>
            ) : (
              <div className="results">
                <div className="meta">리스크 감지 {meta.count_flagged}건</div>
                <pre
                  className="results-body"
                  style={{ whiteSpace: 'pre-wrap' }}
                  dangerouslySetInnerHTML={{ __html: colorize(resultText) }}
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
