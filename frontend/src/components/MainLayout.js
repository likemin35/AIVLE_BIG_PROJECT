// src/components/MainLayout.js
import React, { useState, useEffect, useCallback } from 'react';
import PolicyFooter from './PolicyFooter';

import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { getUserPoints } from '../api/point'; // getUserPoints로 복원

const channel = new BroadcastChannel('point-channel');

const MainLayout = ({ user, authLoading }) => {
  const [userPoints, setUserPoints] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchPoints = useCallback(async (showRefreshIndicator = false) => {
    if (!user) {
      setUserPoints(0);
      return;
    }
    if (showRefreshIndicator) setIsRefreshing(true);
    
    try {
      const pointData = await getUserPoints(user.uid); // getUserPoints로 복원
      setUserPoints(pointData.amount || 0);
    } catch (error) {
      console.error("MainLayout에서 포인트 조회 실패:", error);
      setUserPoints(0);
    } finally {
      if (showRefreshIndicator) setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data === 'points-updated') {
        fetchPoints();
      }
    };
    channel.addEventListener('message', handleMessage);
    return () => {
      channel.removeEventListener('message', handleMessage);
    };
  }, [fetchPoints]);

  const refreshPointsAndNotify = useCallback(async () => {
    await fetchPoints(true);
    channel.postMessage('points-updated');
  }, [fetchPoints]);
  
  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  return (
    <div>
      <Navbar 
        user={user} 
        userPoints={userPoints} 
        isRefreshing={isRefreshing}
        onRefreshPoints={() => fetchPoints(true)} 
      />
      <main>
        <Outlet context={{ user, authLoading, refreshPoints: refreshPointsAndNotify }} />
      </main>
    </div>
  );
};

export default MainLayout;
