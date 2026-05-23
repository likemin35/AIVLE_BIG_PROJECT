import axios from 'axios';
import { auth } from '../firebase';

const getApiUrl = () => {
  if (process.env.REACT_APP_USER_API_BASE_URL) {
    return process.env.REACT_APP_USER_API_BASE_URL;
  }
  return 'http://localhost:8088';
};

const apiClient = axios.create({
  baseURL: getApiUrl(),
  timeout: Number(process.env.REACT_APP_API_TIMEOUT_MS || 10000),
});

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
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      error.message = '사용자 서비스 요청 시간이 초과되었습니다.';
    } else if (!error.response) {
      error.message = '사용자 서비스에 연결하지 못했습니다.';
    }
    return Promise.reject(error);
  }
);

export const getCurrentUserProfile = async () => {
  try {
    const response = await apiClient.get('/api/users/me');
    return response.data;
  } catch (error) {
    console.error('Error fetching current user profile:', error);
    throw error;
  }
};

export const saveCurrentUserProfile = async (profile) => {
  try {
    const response = await apiClient.post('/api/users/me/profile', profile);
    return response.data;
  } catch (error) {
    console.error('Error saving current user profile:', error);
    throw error;
  }
};
