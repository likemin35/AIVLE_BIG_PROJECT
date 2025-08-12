// src/components/ExplainPage.js
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function ExplainPage() {
  const navigate = useNavigate();

  const styles = {
    page: {
      fontFamily: "'Inter', system-ui, -apple-system, Segoe UI, Roboto, Arial, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif",
      color: '#1f1f1f',
      lineHeight: 1.6,
    },
    container: {
      maxWidth: 1200,
      margin: '0 auto',
      padding: '24px 20px 64px',
    },
    // color system
    purple: '#6C5CE7', // 보라 포인트
    purpleDark: '#5A4ED4',
    grayBg: '#f7f7fb',
    border: '#e9e9f3',
    // sections
    hero: {
      display: 'grid',
      gridTemplateColumns: '1.2fr 1fr',
      gap: 24,
      alignItems: 'center',
      marginTop: 12,
      padding: '36px 28px',
      borderRadius: 20,
      background: 'linear-gradient(180deg, #ffffff 0%, #faf9ff 100%)',
      border: '1px solid #efeefe',
    },
    badgeRow: {
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      marginBottom: 12,
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 10px',
      borderRadius: 999,
      fontSize: 12,
      border: '1px solid #ece7ff',
      background: '#f4f1ff',
      color: '#5a45d6',
      fontWeight: 600,
    },
    title: {
      fontSize: 44,
      fontWeight: 800,
      margin: '8px 0 8px',
      letterSpacing: '-0.02em',
      color: '#1a1635',
    },
    slogan: {
      fontSize: 18,
      color: '#4a3bc0',
      fontWeight: 700,
      marginTop: 2,
    },
    subtitle: {
      fontSize: 18,
      color: '#47435d',
      margin: '14px 0 24px',
    },
    ctaRow: {
      display: 'flex',
      gap: 12,
      flexWrap: 'wrap',
    },
    btnPrimary: {
      padding: '12px 18px',
      borderRadius: 12,
      border: '1px solid #5f51e3',
      background: '#6C5CE7',
      color: 'white',
      fontWeight: 700,
      cursor: 'pointer',
    },
    btnSecondary: {
      padding: '12px 16px',
      borderRadius: 12,
      border: '1px solid #dcd7ff',
      background: 'white',
      color: '#5a45d6',
      fontWeight: 700,
      cursor: 'pointer',
    },
    heroMock: {
      borderRadius: 16,
      border: '1px solid #efeefe',
      background: '#ffffff',
      padding: 16,
      boxShadow: '0 8px 30px rgba(108,92,231,0.08)',
      minHeight: 260,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
    },
    mockTitle: {
      fontSize: 16,
      fontWeight: 700,
      color: '#5a45d6',
      marginBottom: 8,
    },
    mockBox: {
      width: '100%',
      borderRadius: 12,
      border: '1px dashed #cfc8ff',
      padding: 18,
      background: '#fbfaff',
      color: '#6b6b82',
      fontSize: 14,
    },
    sectionTitleRow: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginTop: 42,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 26,
      fontWeight: 800,
      color: '#1a1635',
      letterSpacing: '-0.01em',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 18,
    },
    card: {
      borderRadius: 16,
      border: '1px solid #ecebfd',
      background: '#ffffff',
      padding: 18,
    },
    cardHead: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    chip: {
      fontSize: 12,
      fontWeight: 800,
      color: '#6C5CE7',
      background: '#f4f1ff',
      border: '1px solid #ece7ff',
      padding: '4px 8px',
      borderRadius: 999,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: 800,
      color: '#2b1f6b',
      marginBottom: 6,
    },
    cardDesc: {
      fontSize: 14,
      color: '#5a5872',
      marginBottom: 12,
    },
    imgBox: {
      borderRadius: 12,
      border: '1px dashed #d8d3ff',
      background: '#fbfaff',
      padding: 12,
      textAlign: 'center',
      fontSize: 12,
      color: '#7b78a7',
    },
    dlRow: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      marginTop: 10,
    },
    dlTag: {
      padding: '8px 12px',
      borderRadius: 10,
      border: '1px solid #ebe9ff',
      background: '#ffffff',
      color: '#3f36a8',
      fontWeight: 700,
      fontSize: 12,
    },
    linkRow: {
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      marginTop: 8,
    },
    smallLink: {
      fontSize: 13,
      fontWeight: 700,
      color: '#6C5CE7',
      textDecoration: 'none',
      borderBottom: '1px solid #e8e4ff',
      paddingBottom: 1,
    },
    // footer
    footer: {
      marginTop: 52,
      paddingTop: 18,
      borderTop: '1px solid #efeff7',
      display: 'flex',
      gap: 12,
      flexWrap: 'wrap',
      alignItems: 'center',
      color: '#6b6a7f',
      fontSize: 13,
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* HERO */}
        <section style={styles.hero}>
          <div>
            <div style={styles.badgeRow}>
              <span style={styles.badge}>보라계약</span>
              <span style={styles.badge}>GCP에서 안정적으로 운영</span>
              <span style={styles.badge}>JavaScript 기반</span>
            </div>

            <h1 style={styles.title}>딸깍으로 약관 생성</h1>
            <div style={styles.slogan}>버튼 클릭 몇 번으로, 약관 생성부터 검수·수정·분석까지</div>
            <p style={styles.subtitle}>
              보라색 포인트의 간결한 워크플로우로, AI가 약관을 만들고 고치고 위험을 찾아 핵심 연결까지 보여드립니다.
            </p>

            <div style={styles.ctaRow}>
              <button
                style={styles.btnPrimary}
                onClick={() => navigate('/create-terms')}
                aria-label="AI로 약관 생성 시작"
              >
                무료로 시작하기
              </button>
              <Link to="/contracts" style={styles.btnSecondary} aria-label="저장된 약관 관리로 이동">
                저장된 약관 보기
              </Link>
              <Link to="/upload-image" style={styles.btnSecondary} aria-label="약관 이미지 검수 페이지로 이동">
                이미지 검수 체험
              </Link>
            </div>
          </div>

          <div style={styles.heroMock}>
            <div style={styles.mockTitle}>보라계약 — 생성 미리보기</div>
            <div style={styles.mockBox}>
              <strong>서비스명</strong>, <strong>대상 국가</strong>, <strong>과금 방식</strong>만 입력하면<br />
              <span style={{ color: '#5a45d6', fontWeight: 700 }}>AI가 맞춤 약관 초안</span>을 바로 생성합니다.
              <div style={{ marginTop: 10, fontSize: 12 }}>※ 여기에 서비스 스크린샷/히어로 이미지 삽입</div>
            </div>
          </div>
        </section>

        {/* 기능 섹션 */}
        <div style={styles.sectionTitleRow}>
          <h2 style={styles.sectionTitle}>핵심 기능</h2>
          <div style={{ fontSize: 13, color: '#6b6a7f' }}>이미지는 각 카드 하단 영역에 첨부 가능합니다.</div>
        </div>

        <div style={styles.grid}>
          {/* 기능 1 */}
          <article style={styles.card}>
            <div style={styles.cardHead}>
              <span style={styles.chip}>기능 1</span>
            </div>
            <h3 style={styles.cardTitle}>AI로 약관 초안 생성</h3>
            <p style={styles.cardDesc}>
              서비스 정보를 입력하면 AI가 상황에 맞춘 약관을 자동으로 작성합니다. 생성된 문서는 이후 편집·버전 관리가 가능합니다.
            </p>
            <div style={styles.linkRow}>
              <Link to="/create-terms" style={styles.smallLink}>약관 생성 페이지로</Link>
              <Link to="/terms/new/edit" style={styles.smallLink}>생성 후 바로 편집</Link>
            </div>
            <div style={styles.dlRow}>
              <span style={styles.dlTag}>PDF 다운로드</span>
              <span style={styles.dlTag}>Word 다운로드</span>
            </div>
            <div style={{ ...styles.imgBox, marginTop: 12 }}>
              (이미지 삽입 영역) 생성 폼 / 생성 결과 화면
            </div>
          </article>

          {/* 기능 2 */}
          <article style={styles.card}>
            <div style={styles.cardHead}>
              <span style={styles.chip}>기능 2</span>
            </div>
            <h3 style={styles.cardTitle}>약관 이미지 업로드 검수</h3>
            <p style={styles.cardDesc}>
              약관 이미지 파일을 업로드하면 AI가 오탈자, 누락, 일관성 등을 자동 검수합니다. 검수 결과를 반영한{' '}
              <strong>수정된 약관 전문을 txt 파일</strong>로 내려받을 수 있습니다.
            </p>
            <div style={styles.linkRow}>
              <Link to="/upload-image" style={styles.smallLink}>이미지 업로드로 검수하기</Link>
            </div>
            <div style={styles.dlRow}>
              <span style={styles.dlTag}>수정본 TXT 다운로드</span>
            </div>
            <div style={{ ...styles.imgBox, marginTop: 12 }}>
              (이미지 삽입 영역) 이미지 업로드 & 검수 결과 화면
            </div>
          </article>

          {/* 기능 3 */}
          <article style={styles.card}>
            <div style={styles.cardHead}>
              <span style={styles.chip}>기능 3</span>
            </div>
            <h3 style={styles.cardTitle}>기존 약관 업로드 후 수정 & 버전 관리</h3>
            <p style={styles.cardDesc}>
              기존 약관 파일을 업로드하고 AI 보조로 쉽게 수정하세요. 모든 변경사항은 버전으로 관리되어 추적이 가능합니다.
            </p>
            <div style={styles.linkRow}>
              <Link to="/contracts" style={styles.smallLink}>약관 목록/버전 관리</Link>
              <Link to="/terms/123/edit" style={styles.smallLink}>예시: 특정 약관 편집</Link>
            </div>
            <div style={styles.dlRow}>
              <span style={styles.dlTag}>PDF 다운로드</span>
              <span style={styles.dlTag}>Word 다운로드</span>
            </div>
            <div style={{ ...styles.imgBox, marginTop: 12 }}>
              (이미지 삽입 영역) 업로드 → 수정 → 버전 타임라인
            </div>
          </article>

          {/* 기능 4 */}
          <article style={styles.card}>
            <div style={styles.cardHead}>
              <span style={styles.chip}>기능 4</span>
            </div>
            <h3 style={styles.cardTitle}>AI 리스크 탐지</h3>
            <p style={styles.cardDesc}>
              생성(기능 1) 또는 업로드(기능 3)되어 저장된 약관을 AI가 분석해 모호한 조항, 과도한 면책, 최신 규정 미반영 등의{' '}
              <strong>리스크를 자동 탐지</strong>합니다.
            </p>
            <div style={styles.linkRow}>
              <Link to="/contracts" style={styles.smallLink}>저장된 약관에서 분석 실행</Link>
            </div>
            <div style={{ ...styles.imgBox, marginTop: 12 }}>
              (이미지 삽입 영역) 위험 포인트 리스트 & 심각도 뱃지
            </div>
          </article>

          {/* 기능 5 */}
          <article style={styles.card}>
            <div style={styles.cardHead}>
              <span style={styles.chip}>기능 5</span>
            </div>
            <h3 style={styles.cardTitle}>조항별 연관도 시각화</h3>
            <p style={styles.cardDesc}>
              저장된 약관(기능 1·3)을 AI가 분석해 <strong>조항 간 영향도/연관도</strong>를 시각화합니다.
              어떤 조항을 수정하면 다른 조항에 어떤 파급효과가 있는지 한 눈에 확인할 수 있습니다.
            </p>
            <div style={styles.linkRow}>
              <Link to="/contracts/123/visualize" style={styles.smallLink}>예시 시각화 보기</Link>
            </div>
            <div style={{ ...styles.imgBox, marginTop: 12 }}>
              (이미지 삽입 영역) 그래프/네트워크 다이어그램
            </div>
          </article>
        </div>

        {/* 하단 안내 */}
        <footer style={styles.footer}>
          <span>© {new Date().getFullYear()} 보라계약</span>
          <span>·</span>
          <span>보라색 포인트 디자인</span>
          <span>·</span>
          <span>GCP 기반 안정적 인프라</span>
          <span>·</span>
          <Link to="/qna" style={{ color: '#6C5CE7', fontWeight: 700, textDecoration: 'none' }}>
            문의하기(Q&A)
          </Link>
        </footer>
      </div>
    </div>
  );
}
