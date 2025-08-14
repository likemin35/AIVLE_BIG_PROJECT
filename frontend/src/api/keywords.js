import axios from 'axios';

// ===================================================================
// TODO: 아래 URL을 실제 배포된 서비스의 주소로 변경하세요.
// ===================================================================

// 1. NER 서비스 URL
const NER_API_BASE_URL = 'https://ner-api-service-902267887946.us-central1.run.app';

// 2. Graph 서비스 URL
const GRAPH_API_BASE_URL = 'https://graph-api-service-902267887946.us-central1.run.app';

// ===================================================================

/**
 * NER 서비스의 /api/visualize 엔드포인트를 호출하여 하이라이트된 HTML을 가져옵니다.
 * @param {string} text - 분석할 계약서 텍스트
 */
export const fetchHighlightHTML = async (text) => {
  try {
    const response = await axios.post(`${NER_API_BASE_URL}/api/visualize`, { text });
    return response.data;
  } catch (error) {
    console.error('Error fetching highlight HTML:', error);
    throw error;
  }
};

/**
 * Graph 서비스의 /api/graph/build 엔드포인트를 호출하여 그래프 데이터를 가져옵니다.
 * @param {string} text - 분석할 계약서 텍스트
 */
export const fetchGraphData = async (text) => {
  try {
    const response = await axios.post(`${GRAPH_API_BASE_URL}/api/graph/build`, { text });
    return response.data;
  } catch (error) {
    console.error('Error fetching graph data:', error);
    throw error;
  }
};