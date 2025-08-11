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

// 업로드 페이지
import UploadImage from './components/UploadImage';

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

          {/* 생성 후 편집 페이지 */}
          <Route path="/terms/new/edit" element={<EditTerms />} />
          <Route path="/terms/:termId/edit" element={<EditTerms />} />

          {/* 근로계약서 업로드 라우트 */}
          <Route path="/upload-image" element={<UploadImage />} />
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
    </Router>
  );
}

export default App;