import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getHighlightHtml, getNetworkGraphHtml } from '../api/keywords';
import LoadingSpinner from './LoadingSpinner';
import NetworkModal from './NetworkModal'; // 모달 컴포넌트 import
import './ContractVisualization.css';

const ContractVisualization = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { contractContent } = location.state || {};

  const [highlightHtml, setHighlightHtml] = useState('');
  const [networkHtml, setNetworkHtml] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isNetworkLoading, setIsNetworkLoading] = useState(false);

  useEffect(() => {
    if (!contractContent) {
      setError('시각화할 계약서 내용이 없습니다. 이전 페이지로 돌아가 다시 시도해주세요.');
      setLoading(false);
      return;
    }

    const generateHighlight = async () => {
      try {
        setLoading(true);
        const response = await getHighlightHtml(contractContent);
        setHighlightHtml(response.html);
      } catch (err) {
        setError(`하이라이트 데이터를 불러오는 데 실패했습니다: ${err.message}`);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    generateHighlight();
  }, [contractContent]);

  const handleOpenNetworkModal = async () => {
    setIsModalOpen(true);
    setIsNetworkLoading(true);
    try {
      const response = await getNetworkGraphHtml(contractContent);
      setNetworkHtml(response.html);
    } catch (err) {
      alert(`네트워크 그래프를 불러오는 데 실패했습니다: ${err.message}`);
      // 모달을 닫거나, 모달 내에 에러 메시지를 표시할 수 있습니다.
      setIsModalOpen(false); 
    } finally {
      setIsNetworkLoading(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setNetworkHtml(''); // 모달을 닫을 때 내용 초기화
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="visualization-container">
      <div className="visualization-header">
        <h1>키워드 하이라이트</h1>
        <div>
          <button onClick={handleOpenNetworkModal} className="network-btn">
            네트워크 시각화 보기
          </button>
          <button onClick={() => navigate(-1)} className="back-btn">뒤로가기</button>
        </div>
      </div>
      {error ? (
        <div className="error-message">{error}</div>
      ) : (
        <div 
          className="highlight-content"
          dangerouslySetInnerHTML={{ __html: highlightHtml }} 
        />
      )}
      
      {isModalOpen && (
        <NetworkModal 
          htmlContent={networkHtml}
          onClose={handleCloseModal}
          loading={isNetworkLoading}
        />
      )}
    </div>
  );
};

export default ContractVisualization;