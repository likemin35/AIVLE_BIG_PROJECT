import React, { useState, useEffect } from 'react';
import { useParams, useOutletContext, useNavigate, useLocation } from 'react-router-dom';
import { getContractById } from '../api/term';
import LoadingSpinner from './LoadingSpinner';
import './ContractDetail.css';
import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';

const ContractDetail = () => {
  const { id } = useParams();
  const { user, authLoading } = useOutletContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLatest } = location.state || { isLatest: true };

  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    if (!authLoading && user) {
      const fetchContract = async () => {
        try {
          setLoading(true);
          const data = await getContractById(id);
          setContract(data);
        } catch (err) {
          setError('계약서 정보를 불러오는 데 실패했습니다.');
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      fetchContract();
    }
  }, [id, user, authLoading, navigate]);

  const handleEditClick = () => {
    navigate(`/terms/${id}/edit`, { state: { contract } });
  };

  const handleVisualizeClick = () => {
    navigate(`/contracts/${id}/visualize`, { state: { contractContent: contract.content } });
  };

  const formatDate = (dateString) => {
    if (!dateString) return new Date().toISOString().split('T')[0];
    return new Date(dateString).toISOString().split('T')[0];
  };

  const generateFileName = (extension) => {
    const date = formatDate(contract.modifiedAt || contract.createdAt);
    const version = contract.version || 'v1.0';
    return `${contract.title}_${date}_${version}.${extension}`;
  };

  const handleDownloadPDF = async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      const fontResponse = await fetch('/fonts/NanumGothic.ttf');
      if (!fontResponse.ok) {
        throw new Error('폰트 파일을 불러오는 데 실패했습니다.');
      }
      const font = await fontResponse.arrayBuffer();
      const fontBase64 = btoa(
        new Uint8Array(font).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const doc = new jsPDF();
      doc.addFileToVFS('NanumGothic.ttf', fontBase64);
      doc.addFont('NanumGothic.ttf', 'NanumGothic', 'normal');
      doc.setFont('NanumGothic');
      
      const margin = 15;
      const pageHeight = doc.internal.pageSize.height;
      const usableWidth = doc.internal.pageSize.width - 2 * margin;
      let cursorY = margin;

      const paragraphs = contract.content.split('\n');

      paragraphs.forEach(paragraph => {
        const lines = doc.splitTextToSize(paragraph, usableWidth);
        
        lines.forEach(line => {
          const lineHeight = doc.getTextDimensions(line).h;

          if (cursorY + lineHeight > pageHeight - margin) {
            doc.addPage();
            cursorY = margin;
          }
          
          doc.text(line, margin, cursorY);
          cursorY += lineHeight;
        });
      });

      doc.save(generateFileName('pdf'));

    } catch (err) {
      console.error(err);
      alert('PDF 생성 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadWord = () => {
    const doc = new Document({
      sections: [{
        properties: {},
        children: contract.content.split('\n').map(line => 
          new Paragraph({
            children: [new TextRun(line)],
          })
        ),
      }],
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, generateFileName('docx'));
    });
  };

  if (authLoading || loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <div className="contract-detail-container error-container"><h1>{error}</h1></div>;
  }

  if (!contract) {
    return <div className="contract-detail-container"><h1>계약서 정보를 찾을 수 없습니다.</h1></div>;
  }

  return (
    <div className="contract-detail-container">
      <div className="detail-left-panel">
        <pre className="contract-content-view">{contract.content}</pre>
      </div>
      <div className="detail-right-panel">
        <div className="info-box">
          <h2>{contract.title}</h2>
          <div className="warning-placeholder">
            {!isLatest && (
              <div className="version-warning">
                <p>이 계약서는 최신 버전이 아닙니다. 일부 기능은 최신 버전에서만 사용할 수 있습니다.</p>
              </div>
            )}
          </div>
          <div className="info-grid">
            <span className="info-label">최초 생성일</span>
            <span className="info-value">{formatDate(contract.createdAt)}</span>
            <span className="info-label">최종 수정일</span>
            <span className="info-value">{formatDate(contract.modifiedAt || contract.createdAt)}</span>
            <span className="info-label">버전</span>
            <span className="info-value">{contract.version || 'v1.0'}</span>
          </div>
          <div className="info-memo">
            <span className="info-label">수정 메모</span>
            <p className="info-value memo-content">
              {contract.memo || '수정 메모가 없습니다.'}
            </p>
          </div>
        </div>
        <div className="actions-box">
          <button className="action-btn" onClick={handleEditClick} disabled={!isLatest} title={!isLatest ? "최신 버전만 수정할 수 있습니다." : ""}>
            직접 수정하기
          </button>
          <button className="action-btn" onClick={handleVisualizeClick} disabled={!isLatest} title={!isLatest ? "최신 버전에서만 사용할 수 있습니다." : ""}>
            조항별 연관도 시각화
          </button>
          <button className="action-btn" disabled={!isLatest} title={!isLatest ? "최신 버전에서만 사용할 수 있습니다." : ""}>
            해외 법률에 부합하는 초안 생성
          </button>
          <button className="action-btn" disabled={!isLatest} title={!isLatest ? "최신 버전에서만 사용할 수 있습니다." : ""}>
            AI 딸깍 버튼
          </button>
          <hr className="divider" />
          <div className="download-actions">
            <button className="action-btn download-btn pdf" onClick={handleDownloadPDF} disabled={isDownloading}>
              {isDownloading ? '생성 중...' : 'PDF로 다운로드'}
            </button>
            <button className="action-btn download-btn word" onClick={handleDownloadWord}>Word로 다운로드</button>
          </div>
          {contract.fileUrl && (
            <a 
              href={contract.fileUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="action-btn download-btn original-file"
              style={{ textDecoration: 'none' }}
            >
              원본 파일 다운로드
            </a>
          )}
          <hr className="divider" />
          <button className="action-btn back-to-list-btn" onClick={() => navigate('/contracts')}>
            목록으로
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContractDetail;