import React, { useState } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { getContractById, getTermJob, requestCreateTermsJob } from '../api/term';
import './Create-Terms.css';

const categories = [
  { value: 'deposit', label: '예금' },
  { value: 'savings', label: '적금' },
  { value: 'loan', label: '대출' },
  { value: 'insurance', label: '보험' },
];

function CreateTerms() {
  const { user, authLoading } = useOutletContext();
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState('');
  const [category, setCategory] = useState('select');
  const [productName, setProductName] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [productMetaFile, setProductMetaFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const extractMetaFromCsv = async (file) => {
    const text = await file.text();
    const clean = text.replace(/^\uFEFF/, '');
    const lines = clean.split(/\r?\n/).filter((line) => line.trim().length > 0);

    const guessDelimiter = (sample) => {
      if (sample.includes('\t')) return '\t';
      if (sample.includes(';')) return ';';
      return ',';
    };

    const delimiter = guessDelimiter(lines[0] || ',');
    const splitRow = (row) => {
      const pattern = new RegExp(
        `(?:^|${delimiter})(?:"([^"]*(?:""[^"]*)*)"|([^"${delimiter}]*))`,
        'g'
      );
      const result = [];
      row.replace(pattern, (_, quoted, plain) => {
        if (quoted !== undefined) result.push(quoted.replace(/""/g, '"'));
        else result.push((plain || '').trim());
        return '';
      });
      return result;
    };

    let inKeyValueSection = false;
    lines.forEach((line) => {
      const cells = splitRow(line);
      const head0 = (cells[0] || '').trim();
      const head1 = (cells[1] || '').trim();

      if (head0 === '항목' && head1 === '내용') {
        inKeyValueSection = true;
        return;
      }
      if (head0 === '경과기간' || head0 === '급부명') {
        inKeyValueSection = false;
      }

      if (inKeyValueSection && head0) {
        if (head0 === '회사명' && head1) setCompanyName((prev) => prev || head1);
        if (head0 === '상품명' && head1) setProductName((prev) => prev || head1);
      }
    });
  };

  const onChangeProductCsv = async (file) => {
    setProductMetaFile(file || null);
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('CSV 파일만 업로드할 수 있습니다.');
      setProductMetaFile(null);
      return;
    }

    try {
      await extractMetaFromCsv(file);
    } catch (e) {
      console.warn('CSV preview parse failed:', e);
    }
  };

  const pollJobUntilDone = async (jobId, timeoutMs = 180000, intervalMs = 3000) => {
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
  };

  const handleSubmit = async () => {
    if (category === 'select') {
      alert('카테고리를 선택해주세요.');
      return;
    }
    if (!productMetaFile) {
      alert('product_info.csv 파일을 업로드해주세요.');
      return;
    }
    if (!user?.uid) {
      alert('사용자 인증 정보가 없습니다. 다시 로그인해주세요.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('category', category);
      formData.append('companyName', companyName || '');
      formData.append('productName', productName || '');
      formData.append('effectiveDate', effectiveDate || '');
      formData.append('requirements', '');
      formData.append('productMeta', productMetaFile);

      const job = await requestCreateTermsJob(formData);
      if (!job?.jobId) {
        throw new Error('약관 생성 Job 생성에 실패했습니다.');
      }

      const latestJob = await pollJobUntilDone(job.jobId);
      if (latestJob.status !== 'DONE') {
        throw new Error(latestJob.errorMessage || '약관 생성 작업이 완료되지 않았습니다.');
      }

      const createdTerm = await getContractById(latestJob.resultId);
      const draftPayload = {
        terms: createdTerm?.content || '',
        table_of_contents: '',
        policy: createdTerm?.content || '',
        meta: {
          companyName: companyName || '',
          category,
          productName: productName || createdTerm?.productName || '',
          effectiveDate: effectiveDate || '',
        },
      };

      sessionStorage.setItem('draftPayload', JSON.stringify(draftPayload));
      alert('AI 약관 초안 생성이 완료되어 편집 화면으로 이동합니다.');
      navigate('/terms/new/edit', { state: draftPayload });
    } catch (err) {
      console.error('Error generating terms:', err);
      const message = err?.message || '오류가 발생했습니다.';
      if (message.includes('포인트')) {
        alert('포인트가 부족합니다.');
      } else {
        alert(message);
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) return <div>Loading...</div>;

  if (!user) {
    return (
      <div className="terms-main">
        <div className="login-prompt">
          <h2>로그인이 필요</h2>
          <p>이 페이지를 이용하려면 로그인이 필요합니다.</p>
          <Link to="/login" className="login-btn-link">로그인 페이지로 이동</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="terms-main">
      <div className="terms-container">
        <div className="form-section">
          <div className="form-container">
            <div className="form-group">
              <label className="form-label">회사 이름</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="form-input"
                placeholder="CSV에서 자동 채움, 필요하면 직접 수정"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">초안 카테고리</label>
              <div className="select-container">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="form-select"
                  disabled={isLoading}
                >
                  <option value="select">선택</option>
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                <div className="select-arrow">▼</div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">상품 이름</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="form-input"
                placeholder="CSV에서 자동 채움, 필요하면 직접 수정"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">시행 날짜</label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="form-input"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">약관 CSV 파일</label>
              <input
                type="file"
                accept=".csv"
                className="form-input file-input"
                onChange={(e) => onChangeProductCsv(e.target.files?.[0] || null)}
                disabled={isLoading}
              />
            </div>

            <button onClick={handleSubmit} className="ai-draft-btn" disabled={isLoading}>
              {isLoading ? '생성 중...' : 'AI 초안 생성 (5,000P)'}
            </button>

            {error && <div className="error-message">{error}</div>}
          </div>
        </div>

        <div className="preview-section">
          <div className="preview-placeholder">
            <p>비동기 Job이 완료되면 편집 화면으로 이동합니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateTerms;
