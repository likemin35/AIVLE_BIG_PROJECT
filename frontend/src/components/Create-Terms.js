// src/components/Create-Terms.js
import React, { useState } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import './Create-Terms.css';

function CreateTerms() {
  const { user, authLoading } = useOutletContext();
  const navigate = useNavigate();

  // 기본 메타(입력값은 CSV가 덮어씀; 미기재 시 백엔드가 CSV에서 읽음)
  const [companyName, setCompanyName] = useState('');
  const [category, setCategory] = useState('선택');
  const [productName, setProductName] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');

  // 단일 CSV 파일 (필수)
  const [productMetaFile, setProductMetaFile] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const CLOUD_RUN_API_BASE_URL =
    process.env.REACT_APP_CLOUD_RUN_API_BASE_URL ||
    'https://terms-api-service-eck6h26cxa-uc.a.run.app';

  const categories = [
    { value: 'deposit', label: '예금' },
    { value: 'savings', label: '적금' },
    { value: 'loan', label: '주택담보대출' },
    { value: 'cancer_insurance', label: '암보험' },
    { value: 'car_insurance', label: '자동차보험' },
  ];

  // 간단 CSV 파서: "항목,내용" 섹션에서 회사명/상품명만 추출 (클라이언트 미리보기용)
  const extractMetaFromCsv = async (file) => {
    const text = await file.text();
    // BOM 제거 및 개행 분리
    const clean = text.replace(/^\uFEFF/, '');
    const lines = clean.split(/\r?\n/).filter(l => l.trim().length > 0);

    // 구분자 추정(쉼표, 세미콜론, 탭)
    const guessDelim = (sample) => {
      if (sample.includes('\t')) return '\t';
      if (sample.includes(';')) return ';';
      return ',';
    };
    const delim = guessDelim(lines[0] || ',');

    const splitRow = (row) => {
      // 큰따옴표로 감싼 셀 고려(아주 간단 버전)
      const pattern = new RegExp(
        `(?:^|${delim})(?:"([^"]*(?:""[^"]*)*)"|([^"${delim}]*))`,
        'g'
      );
      const out = [];
      row.replace(pattern, (_, quoted, plain) => {
        if (quoted !== undefined) out.push(quoted.replace(/""/g, '"'));
        else out.push((plain || '').trim());
        return '';
      });
      return out;
    };

    let inKV = false;
    for (let i = 0; i < lines.length; i++) {
      const cells = splitRow(lines[i]);
      const head0 = (cells[0] || '').trim();
      const head1 = (cells[1] || '').trim();

      // 섹션 시작/전환 감지
      if (head0 === '항목' && head1 === '내용') {
        inKV = true;
        continue;
      }
      if (
        head0 === '경과기간' || // 환급 표 시작 → KV 종료
        head0 === '급부명'      // 지급 표 시작 → KV 종료
      ) {
        inKV = false;
      }

      if (inKV && head0) {
        if (head0 === '회사명' && head1) setCompanyName(prev => prev || head1);
        if (head0 === '상품명' && head1) setProductName(prev => prev || head1);
      }
    }
  };

  const onChangeProductCsv = async (file) => {
    setProductMetaFile(file || null);
    if (file) {
      // 파일명 확장자 체크(권장)
      if (!file.name.toLowerCase().endsWith('.csv')) {
        alert('CSV 파일만 업로드해주세요.');
        setProductMetaFile(null);
        return;
      }
      try {
        await extractMetaFromCsv(file);
      } catch (e) {
        // 파싱 실패해도 백엔드가 처리하므로 치명적 오류는 아님
        console.warn('CSV 미리 파싱 실패(무시 가능):', e);
      }
    }
  };

  // 업로드 기반 약관 생성 (multipart/form-data)
  const handleSubmit = async () => {
    // 필수: 카테고리 + product_info.csv
    if (category === '선택') {
      alert('카테고리를 선택해주세요.');
      return;
    }
    if (!productMetaFile) {
      alert('product_info.csv 파일을 업로드해주세요.');
      return;
    }
    if (!user || !user.uid) {
      alert('사용자 인증 정보가 없습니다. 다시 로그인해주세요.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const fd = new FormData();
      // 카테고리는 벡터DB/백엔드 라우팅에 필요할 수 있어 필수로 전송
      fd.append('category', category);

      // 선택 메타(빈 값이어도 전송): 백엔드가 CSV에서 재확인/덮어씀
      fd.append('companyName', companyName || '');
      fd.append('productName', productName || '');
      fd.append('effectiveDate', effectiveDate || '');

      // 자유 입력 요구사항은 CSV가 대체하므로 비워도 됨(백엔드에서 무시/덮어씀)
      fd.append('requirements', '');

      // 단일 CSV 파일
      fd.append('productMeta', productMetaFile);

      // 기존 v2 엔드포인트 그대로 사용(백엔드가 통합 CSV 파싱하도록 구현됨을 전제)
      const res = await fetch(`${CLOUD_RUN_API_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'x-authenticated-user-uid': user.uid,
          'Authorization': `Bearer ${await user.getIdToken()}`,
          // Content-Type은 브라우저가 자동 설정해야 합니다.
        },
        body: fd,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '약관 생성 중 알 수 없는 오류가 발생했습니다.');
      }

      // v2 응답: { policy, meta }
      const policy = data.policy;
      const meta = data.meta || {
        companyName: companyName || '',
        category,
        productName: productName || '',
        effectiveDate: effectiveDate || '',
      };

      const draftPayload = {
        // terms: policy ? JSON.stringify(policy, null, 2) : (data.terms || ''),
        terms: policy,
        policy,
        meta,
      };

      sessionStorage.setItem('draftPayload', JSON.stringify(draftPayload));
      navigate('/terms/new/edit', { state: draftPayload });

      if (data.warning) {
        alert(data.warning);
      }
    } catch (err) {
      console.error('Error generating terms:', err);
      const msg = err.message || '';
      if (msg.includes('포인트')) {
        alert('포인트가 부족합니다.');
      } else {
        alert('오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) return <div>Loading...</div>;

  if (!user) {
    return (
      <div className="terms-main">
        <div className="login-prompt">
          <h2>로그인 필요</h2>
          <p>이 페이지에 접근하려면 로그인이 필요합니다.</p>
          <Link to="/login" className="login-btn-link">로그인 페이지로 이동</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="terms-main">
      <div className="terms-container">
        {/* 왼쪽 입력 폼 영역 (기존 우측) */}
        <div className="form-section">
          <div className="form-container">
            <div className="form-group">
              <label className="form-label">회사 이름</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="form-input"
                placeholder="CSV 업로드 시 자동 채움, 필요 시 수정 가능"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">초안 카테고리 (필수)</label>
              <div className="select-container">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="form-select"
                  disabled={isLoading}
                >
                  <option value="선택">선택</option>
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
                placeholder="CSV 업로드 시 자동 채움, 필요 시 수정 가능"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">시행 날짜 (선택)</label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="form-input"
                disabled={isLoading}
              />
            </div>

            {/* CSV 업로드 (단일) - 커스텀 툴팁 아이콘 추가 */}
            <div className="form-group">
              <label className="form-label">
                약관 csv파일 (필수)
                <div className="tooltip-container">
                  <span className="info-icon">ⓘ</span>
                  <div className="tooltip-content">
                    상단에는 '항목,내용' 섹션(회사명/상품명 등), <br />중간/하단에는 표(해약환급금, 지급기준표)를 포함해 주세요.
                  </div>
                </div>
              </label>
              <input
                type="file"
                accept=".csv"
                className="form-input file-input"
                onChange={(e) => onChangeProductCsv(e.target.files?.[0] || null)}
                disabled={isLoading}
              />
            </div>

            <button
              onClick={handleSubmit}
              className="ai-draft-btn"
              disabled={isLoading}
            >
              {isLoading ? '생성 중...' : 'AI 초안 딸각 (5,000P)'}
            </button>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽 미리보기 영역 (기존 좌측) */}
        <div className="preview-section">
          <div className="preview-placeholder">
            <p>파일 업로드 후 AI 약관 초안을 생성하면 편집 화면으로 이동합니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateTerms;