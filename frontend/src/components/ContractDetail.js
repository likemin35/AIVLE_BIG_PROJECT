import React, { useState, useEffect } from 'react';
import { useParams, useOutletContext, useNavigate, useLocation } from 'react-router-dom';
import { getContractById } from '../api/term';
import LoadingSpinner from './LoadingSpinner';
import './ContractDetail.css';

const ContractDetail = () => {
  const { id } = useParams();
  const { user, authLoading } = useOutletContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLatest } = location.state || { isLatest: true }; // 기본값을 true로 설정

  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR');
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
          {!isLatest && (
            <div className="version-warning">
              <p>이 계약서는 최신 버전이 아닙니다. 일부 기능은 최신 버전에서만 사용할 수 있습니다.</p>
            </div>
          )}
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
          <button 
            className="action-btn" 
            onClick={handleEditClick} 
            disabled={!isLatest}
            title={!isLatest ? "최신 버전만 수정할 수 있습니다." : ""}
          >
            직접 수정하기
          </button>
          <button 
            className="action-btn" 
            disabled={!isLatest}
            title={!isLatest ? "최신 버전에서만 사용할 수 있습니다." : ""}
          >
            조항별 연관도 시각화
          </button>
          <button 
            className="action-btn" 
            disabled={!isLatest}
            title={!isLatest ? "최신 버전에서만 사용할 수 있습니다." : ""}
          >
            해외 법률에 부합하는 초안 생성
          </button>
          <button 
            className="action-btn" 
            disabled={!isLatest}
            title={!isLatest ? "최신 버전에서만 사용할 수 있습니다." : ""}
          >
            AI 딸깍 버튼
          </button>
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