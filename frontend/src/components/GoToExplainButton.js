// src/components/GoToExplainButton.js
import React from 'react';
import { Link } from 'react-router-dom';

export default function GoToExplainButton() {
  return (
    <Link
      to="/about"
      style={{
        padding: '10px 14px',
        borderRadius: 12,
        border: '1px solid #5f51e3',
        background: '#6C5CE7',
        color: '#fff',
        fontWeight: 800,
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
      }}
      aria-label="보라계약 설명 페이지로 이동"
    >
      보라계약 소개 보기 <span aria-hidden>→</span>
    </Link>
  );
}
