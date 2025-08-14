import React from 'react';
import './NetworkModal.css';

const NetworkModal = ({ htmlContent, onClose, loading }) => {
  if (!htmlContent && !loading) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close-btn" onClick={onClose}>×</button>
        {loading ? (
          <div className="modal-loading">
            <p>네트워크 그래프를 생성 중입니다...</p>
            <p>잠시만 기다려 주세요.</p>
          </div>
        ) : (
          <iframe
            srcDoc={htmlContent}
            title="Network Visualization"
            className="modal-iframe"
            sandbox="allow-scripts allow-same-origin"
          />
        )}
      </div>
    </div>
  );
};

export default NetworkModal;
