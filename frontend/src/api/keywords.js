const KEYWORDS_AI_BASE_URL = 
  window.location.hostname === 'localhost' 
    ? 'http://localhost:8080' 
    : 'https://keywords-ai-service-placeholder.run.app'; // 실제 배포 URL로 변경 필요

export const visualizeContract = async (text) => {
  const response = await fetch(`${KEYWORDS_AI_BASE_URL}/api/visualize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: '서버 응답을 파싱할 수 없습니다.' }));
    throw new Error(errorData.error || `서버 오류: ${response.status}`);
  }

  return response.json();
};
