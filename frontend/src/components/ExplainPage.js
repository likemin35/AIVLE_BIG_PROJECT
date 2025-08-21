// src/components/ExplainPage.js
import React from 'react';
import CreateTermsImg from '../assets/CreateTerms.png';
import ImageCheckImg from '../assets/ImageCheck.png';
import VersionManageImg from '../assets/VersionManage.png';
import TermsNodeImg from '../assets/TermsNode.png';
import RiskInsightImg from '../assets/RiskInsightImg.png';

export default function ExplainPage() {
  // 공용 섹션 컴포넌트 (문자/JSX 모두 지원하는 imgLabel)
  const Section = ({ reverse = false, eyebrow, title, desc, children, imgLabel }) => (
    <section
      style={{
        padding: '56px 0',
        borderBottom: `1px solid var(--border)`,
        background: 'var(--card)',
        color: 'var(--text)',
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: '0 20px',
          display: 'grid',
          gridTemplateColumns: reverse ? '1.05fr 1fr' : '1fr 1.05fr',
          gap: 32,
          alignItems: 'center',
        }}
      >
        {/* Text */}
        <div style={{ order: reverse ? 2 : 1 }}>
          {eyebrow && (
            <div
              style={{
                display: 'inline-block',
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: '0.08em',
                color: 'var(--primary)',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                padding: '6px 10px',
                borderRadius: 999,
                marginBottom: 14,
              }}
            >
              {eyebrow}
            </div>
          )}
          <h2
            style={{
              fontSize: 30,
              lineHeight: 1.26,
              letterSpacing: '-0.01em',
              color: 'var(--text)',
              margin: '6px 0 14px',
              fontWeight: 900,
            }}
          >
            {title}
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 16, lineHeight: 1.7, marginBottom: 18 }}>{desc}</p>
          {children}
        </div>

        {/* Image / Mock */}
        <div style={{ order: reverse ? 1 : 2 }}>
          <div
            style={{
              borderRadius: 16,
              border: `1px dashed var(--border)`,
              background: 'var(--bg)',
              padding: 18,
              minHeight: 240,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              color: 'var(--muted)',
              fontSize: 13,
            }}
          >
            {typeof imgLabel === 'string'
              ? `(이미지/스크린샷 자리) ${imgLabel}`
              : imgLabel}
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <div
      style={{
        fontFamily:
          "'Inter', system-ui, -apple-system, Segoe UI, Roboto, Arial, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif",
        color: 'var(--text)',
        background: 'var(--bg)',
      }}
    >
      {/* HERO */}
      <header
        style={{
          background: 'var(--card)',
          borderBottom: `1px solid var(--border)`,
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: '0 auto',
            padding: '64px 20px',
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: 44,
              fontWeight: 900,
              color: 'var(--text)',
              letterSpacing: '-0.02em',
              marginBottom: 10,
            }}
          >
            딸깍으로 약관 생성
          </h1>
          <p style={{ fontSize: 18, color: 'var(--muted)' }}>
            보라계약은 약관의 <strong style={{ color: 'var(--primary)' }}>생성·검수·수정·분석</strong>을 한 흐름으로
            연결한 서비스입니다. 버튼 몇 번으로 초안을 만들고, 기존 문서를 손쉽게 고치며, 리스크와 조항 간 관계까지
            한 화면에서 이해할 수 있습니다. 완성된 문서는 필요에 따라 바로 저장하거나 공유할 수 있어요.
          </p>
        </div>
      </header>

      {/* 약관 초안 생성 */}
      <Section
        eyebrow="Create"
        title="AI가 맞춤 약관 초안을 준비합니다"
        desc={
          <>
            서비스에 필요한 핵심만 입력하면 초안이 생성됩니다. 생성된 초안은 바로 편집할 수 있고, 작업이 끝나면
            문서로 저장해 보관하거나 전달할 수 있습니다.
          </>
        }
        imgLabel={
          <img
            src={CreateTermsImg}
            alt="초안 생성 폼/결과 예시"
            style={{ maxWidth: '100%', height: 'auto', borderRadius: 12 }}
          />
        }
      >
        <div
          style={{
            border: `1px solid var(--border)`,
            borderRadius: 14,
            padding: 16,
            background: 'var(--bg)',
          }}
        >
          <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 10 }}>초안 생성 시 입력 항목</div>
          <ul style={{ marginLeft: 18, color: 'var(--muted)', lineHeight: 1.8, fontSize: 15 }}>
            <li>회사 이름</li>
            <li>초안 카테고리(예금, 적금, 보험 등)</li>
            <li>상품 이름</li>
            <li>시행 날짜</li>
            <li>필수 조항 및 희망사항</li>
          </ul>
          <p style={{ marginTop: 12, fontSize: 14, color: 'var(--muted)' }}>
            입력 후 생성된 초안은 직접수정과 AI수정이 가능하며, 필요 시 문서 파일로 정리해 내부 검토·배포에 활용할 수 있습니다.
          </p>
        </div>
      </Section>

      {/* 이미지 업로드 검수 */}
      <Section
        reverse
        eyebrow="Quality Check"
        title="약관 이미지 업로드로 오탈자와 표기 용어 자동 검수"
        desc={
          <>
            스캔본이나 캡처본처럼 이미지 형태의 약관도 업로드만 하면 AI가 텍스트를 추출하고 문장·용어·표기 일관성을
            점검합니다. 반영 결과는 전체 전문으로 정리되어 확인할 수 있고, 필요할 때 텍스트 파일로 보관해 두어도
            좋아요.
          </>
        }
        imgLabel={
          <img
            src={ImageCheckImg}
            alt="이미지 업로드 & 검수 결과 예시"
            style={{ maxWidth: '100%', height: 'auto', borderRadius: 12 }}
          />
        }
      />

      {/* 기존 약관 업로드/수정 · 버전 관리 */}
      <Section
        eyebrow="Editing Flow"
        title="기존 약관 업로드부터 AI 수정, 버전 관리까지 한 번에"
        desc={
          <>
            이미 운영 중인 약관을 불러와 보라계약에 저장하세요.
            저장된 약관은 사이트에서 직접 수정하거나 AI로 손쉽게 재작성할 수 있습니다.
            모든 변경 이력은 버전으로 기록되어 언제든 과거 상태를 확인할 수 있으며,
            필요할 때 최신본을 문서 파일로 다운로드할 수 있습니다.
          </>
        }
        imgLabel={
          <img
            src={VersionManageImg}
            alt="버전관리"
            style={{ maxWidth: '100%', height: 'auto', borderRadius: 12 }}
          />
        }
      />

      {/* 리스크 탐지 */}
      <Section
        reverse
        eyebrow="Risk Insight"
        title="AI가 약관 속 리스크를 찾아 개선 방안 제시"
        desc={
          <>
            AI가 약관을 검토하여 ‘모호한 표현’, ‘설명의무 위반’, ‘오탈자’ 등 문서상의 오류를 탐지하고,
            실제 판례에 기반한 개선 사항을 제시합니다. 개선 사항은 사용자의 문서에 바로 적용하여
            팀이 신속하게 논의하고 반영할 수 있도록 돕습니다.
          </>
        }
        imgLabel={
          <img
            src={RiskInsightImg}
            alt="리스크 목록/심각도"
            style={{ maxWidth: '100%', height: 'auto', borderRadius: 12 }}
          />
        }
      />

      {/* 조항 연관도 시각화 */}
      <Section
        eyebrow="Relationship Map"
        title="약관의 시각화로 약관의 중요한 부분을 강조하고, 연관된 약관을 확인 가능."
        desc={
          <>
            노드의 크기로 각 조항이 약관에 기여하는 영향력을 확인할 수 있습니다.
            조항과 연관된 내용들이 시각적으로 표시되어서 복잡한 조항을 한번에 찾을 수 있습니다.
            조항과 연관된 내용들을 확인할 수 있어서 조항 수정시에 각 조항끼리 모순되지 않도록 도와줍니다.

          </>
        }
        imgLabel={
          <img
            src={TermsNodeImg}
            alt="시각화"
            style={{ maxWidth: '100%', height: 'auto', borderRadius: 12 }}
          />
        }
      />

      {/* FOOTER */}
      <footer
        style={{
          padding: '28px 20px 60px',
          textAlign: 'center',
          color: 'var(--muted)',
          borderTop: `1px solid var(--border)`,
          background: 'var(--card)',
        }}
      >
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 6 }}>보라계약</div>
          <div style={{ fontSize: 13 }}>
            약관 생성부터 검수·수정·분석까지, 한 흐름으로 연결해 드립니다.
          </div>
        </div>
      </footer>
    </div>
  );
}
