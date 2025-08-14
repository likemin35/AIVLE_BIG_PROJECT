// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Home';
import SignUp from './components/SignUp';
import Login from './components/Login';
import CreateTerms from './components/Create-Terms';
import CreateStandard from './components/Create-Standard';

import CompleteSignUp from './components/CompleteSignUp';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import MyPage from './MyPage';
import QnaList from './components/QnaList';
import QnaWrite from './components/QnaWrite';
import QnaDetail from './components/QnaDetail';
import QnaEdit from './components/QnaEdit';
import MainLayout from './components/MainLayout';
import PointLayout from './components/PointLayout';
import ResetPassword from './components/ResetPassword';
import ContractManagement from './ContractManagement';
import EditTerms from './components/Edit-Terms';
import ContractDetail from './components/ContractDetail';
import ContractVisualization from './components/ContractVisualization'; // 추가
import Settings from './components/Settings';
import { initTheme } from './utils/theme';


// 업로드 페이지
import UploadImage from './components/UploadImage';

// 설명 페이지 추가
import ExplainPage from './components/ExplainPage';

// (선택) 어디서든 설명 페이지로 이동하는 버튼 컴포넌트
import GoToExplainButton from './components/GoToExplainButton';

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (userAuth) => {
      if (userAuth && userAuth.emailVerified) {
        const userDocRef = doc(db, 'users', userAuth.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setUser(Object.assign(userAuth, userDoc.data()));
        } else {
          setUser(userAuth);
        }
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
  // 페이지 첫 진입 시 저장된 선호도/시스템 상태 반영
  initTheme();
}, []);


  return (
    <Router>
      <Routes>
        {/* 네비게이션 바가 있는 페이지들 */}
        <Route element={<MainLayout user={user} authLoading={authLoading} />}>
          <Route path="/" element={<Home user={user} />} />
          <Route path="/create-terms" element={<CreateTerms />} />
          <Route path="/create-standard" element={<CreateStandard />} />
          
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/points" element={<PointLayout />} />
          <Route path="/qna" element={<QnaList />} />
          <Route path="/qna/write" element={<QnaWrite />} />
          <Route path="/qna/:id" element={<QnaDetail />} />
          <Route path="/qna/edit/:id" element={<QnaEdit />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/contracts" element={<ContractManagement />} />
          <Route path="/contracts/:id" element={<ContractDetail />} />
          <Route path="/contracts/:id/visualize" element={<ContractVisualization />} /> {/* 추가 */}
          <Route path="/settings" element={<Settings />} />

          {/* 생성 후 편집 페이지 */}
          <Route path="/terms/new/edit" element={<EditTerms />} />
          <Route path="/terms/:termId/edit" element={<EditTerms />} />

          {/* 근로계약서 업로드 라우트 */}
          <Route path="/upload-image" element={<UploadImage />} />

          {/* 설명(소개) 페이지 라우트 — navbar 유지 */}
          <Route path="/about" element={<ExplainPage />} />
        </Route>

        {/* 네비게이션 바가 없는 페이지들 */}
        <Route
          path="/signup"
          element={
            <SignUp
              user={user}
              authLoading={authLoading}
              onHomeClick={() => (window.location.href = '/')}
            />
          }
        />
        <Route path="/login" element={<Login user={user} authLoading={authLoading} />} />
        <Route path="/complete-signup" element={<CompleteSignUp />} />
      </Routes>

      {/* (선택) 전역에서 떠다니는 소개 버튼을 쓰고 싶다면 아래를 활성화하세요.
          위치를 고정하려면 스타일을 수정하세요. */}
      {/* <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 50 }}>
        <GoToExplainButton />
      </div> */}
    </Router>
  );
}

export default App;
