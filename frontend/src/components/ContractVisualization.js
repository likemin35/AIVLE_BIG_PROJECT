import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { visualizeContract } from '../api/keywords';
import LoadingSpinner from './LoadingSpinner';
import './ContractVisualization.css';

const ContractVisualization = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { contractContent } = location.state || {};

  const [visualizationHtml, setVisualizationHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!contractContent) {
      setError('시각화할 계약서 내용이 없습니다. 이전 페이지로 돌아가 다시 시도해주세요.');
      setLoading(false);
      return;
    }

    const generateVisualization = async () => {
      try {
        setLoading(true);
        const response = await visualizeContract(contractContent);
        setVisualizationHtml(response.html);
      } catch (err) {
        setError(`시각화 데이터를 불러오는 데 실패했습니다: ${err.message}`);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    generateVisualization();
  }, [contractContent]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="visualization-container">
      <div className="visualization-header">
        <h1>조항별 연관도 시각화</h1>
        <button onClick={() => navigate(-1)} className="back-btn">뒤로가기</button>
      </div>
      {error ? (
        <div className="error-message">{error}</div>
      ) : (
        <div 
          className="visualization-content"
          dangerouslySetInnerHTML={{ __html: visualizationHtml }} 
        />
      )}
    </div>
  );
};

export default ContractVisualization;
