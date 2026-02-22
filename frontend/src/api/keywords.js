import axios from 'axios';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const NER_API_BASE_URL = process.env.REACT_APP_KEYWORD_NER_API_BASE_URL;
const GRAPH_API_BASE_URL = process.env.REACT_APP_KEYWORD_GRAPH_API_BASE_URL;

// ===================================================================

const getFirebaseToken = () => {
  return new Promise((resolve, reject) => {
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (user) {
        user.getIdToken().then(resolve).catch(reject);
      } else {
        reject(new Error('사용자가 로그인되어 있지 않습니다.'));
      }
    });
  });
};

const createApi = (baseURL) => {
  const api = axios.create({
    baseURL,
  });

  api.interceptors.request.use(async (config) => {
    try {
      const token = await getFirebaseToken();
      config.headers.Authorization = `Bearer ${token}`;
    } catch (error) {
      console.error('Firebase 토큰을 가져오는 데 실패했습니다.', error);
      // 토큰 없이 요청을 보내거나, 요청을 취소할 수 있습니다.
      // 여기서는 일단 토큰 없이 요청을 보냅니다.
    }
    return config;
  }, (error) => {
    return Promise.reject(error);
  });

  return api;
};

const nerApi = createApi(NER_API_BASE_URL);
const graphApi = createApi(GRAPH_API_BASE_URL);

/**
 * NER 서비스의 /api/visualize 엔드포인트를 호출하여 하이라이트된 HTML을 가져옵니다.
 * @param {string} text - 분석할 계약서 텍스트
 */
export const getHighlightHtml = async (text) => {
  try {
    // 이제 nerApi 인스턴스를 사용합니다.
    const response = await nerApi.post('/api/visualize', { text });
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
export const getNetworkGraphHtml = async (text) => {
  try {
    // 이제 graphApi 인스턴스를 사용합니다.
    const response = await graphApi.post('/api/graph/build', { text });
    return response.data;
  } catch (error)    {
    console.error('Error fetching graph data:', error);
    throw error;
  }
};
