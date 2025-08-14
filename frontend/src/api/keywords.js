import axios from 'axios';
import { auth } from '../firebase';

// 다른 API 파일들과 동일한 패턴으로 URL을 결정합니다.
const getApiUrl = () => {
  // 1. GCP 배포 환경 변수가 있으면 그 값을 사용합니다.
  // (keywords.py와 network.py는 같은 서비스 그룹에 속하므로, 하나의 변수를 사용할 수 있습니다.)
  if (process.env.REACT_APP_CLOUD_RUN_KEYWORDS_API_BASE_URL) {
    return process.env.REACT_APP_CLOUD_RUN_KEYWORDS_API_BASE_URL;
  }
  // 2. 기본값으로 로컬 게이트웨이 주소를 사용합니다.
  return 'http://localhost:8088';
};

const apiClient = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// 모든 요청에 Firebase 인증 토큰을 자동으로 추가하는 인터셉터입니다.
apiClient.interceptors.request.use(
  async (config) => {
    const user = auth.currentUser;
    if (user) {
      try {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        console.error('Error getting auth token: ', error);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * 게이트웨이를 통해 NER 서비스(keywords.py)를 호출하여 하이라이트 HTML을 가져옵니다.
 * @param {string} text - 계약서 내용
 * @returns {Promise<{html: string, items: any[]}>}
 */
export const getHighlightHtml = async (text) => {
  try {
    // 게이트웨이 라우팅 경로: /ner/api/visualize -> http://localhost:8081/api/visualize
    const response = await apiClient.post('/ner/api/visualize', { text });
    return response.data;
  } catch (error) {
    console.error('Error fetching highlight HTML:', error);
    // 서버에서 보낸 에러 메시지를 그대로 전달
    if (error.response && error.response.data && error.response.data.error) {
      throw new Error(error.response.data.error);
    }
    throw error;
  }
};

/**
 * 게이트웨이를 통해 Graph 서비스(network.py)를 호출하여 네트워크 그래프 HTML을 가져옵니다.
 * @param {string} text - 계약서 내용
 * @returns {Promise<{html: string, ...}>}
 */
export const getNetworkGraphHtml = async (text) => {
  try {
    // 게이트웨이 라우팅 경로: /keywords/api/graph/build -> http://localhost:8080/api/graph/build
    const response = await apiClient.post('/keywords/api/graph/build', { text });
    return response.data;
  } catch (error) {
    console.error('Error fetching network graph:', error);
    if (error.response && error.response.data && error.response.data.error) {
      throw new Error(error.response.data.error);
    }
    throw error;
  }
};
