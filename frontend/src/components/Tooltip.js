import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import './Tooltip.css';

const Tooltip = ({ children, text }) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef(null);
  const hideTimerRef = useRef(null);

  const handleMouseEnter = () => {
    // Hide timer가 있다면 취소
    clearTimeout(hideTimerRef.current);
    
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX + rect.width / 2,
      });
      setVisible(true);
    }
  };

  const handleMouseLeave = () => {
    // 100ms 후에 툴팁을 숨기는 타이머 설정
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
    }, 100);
  };

  if (!text) {
    return <>{children}</>;
  }

  return (
    <span 
      ref={wrapperRef} 
      className="tooltip-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {visible && createPortal(
        <div 
          className="tooltip-box-portal" 
          style={{ 
            top: `${coords.top}px`, 
            left: `${coords.left}px` 
          }}
          onMouseEnter={handleMouseEnter} // 툴팁 위로 마우스가 올라가도 타이머 취소
          onMouseLeave={handleMouseLeave} // 툴팁을 벗어나면 숨김 타이머 시작
        >
          {text}
        </div>,
        document.body
      )}
    </span>
  );
};

export default Tooltip;
