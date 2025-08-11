import React, { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { getContracts, deleteLatestContract, deleteAllContractsInGroup } from './api/term';
import LoadingSpinner from './components/LoadingSpinner';
import Tooltip from './components/Tooltip';
import './ContractManagement.css';

const ContractManagement = () => {
  const { user, authLoading } = useOutletContext();
  const [contractGroups, setContractGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const data = await getContracts();
      
      const contractMap = new Map(data.map(c => [c.id, c]));

      const findRoot = (contract) => {
        let current = contract;
        while (current.origin) {
          const parent = contractMap.get(current.origin);
          if (!parent) break;
          current = parent;
        }
        return current;
      };

      const groupedByRoot = data.reduce((acc, contract) => {
        const root = findRoot(contract);
        if (!acc[root.id]) {
          acc[root.id] = [];
        }
        acc[root.id].push(contract);
        return acc;
      }, {});

      const getVersionNumber = (version) => {
        const num = parseInt(String(version).replace(/[^0-9]/g, ''), 10);
        return isNaN(num) ? 0 : num;
      };

      const groups = Object.values(groupedByRoot).map(group => {
        group.sort((a, b) => getVersionNumber(b.version) - getVersionNumber(a.version));
        const [latest, ...history] = group;
        return { latest, history };
      });

      groups.sort((a, b) => {
        const dateA = new Date(a.latest.modifiedAt || a.latest.createdAt);
        const dateB = new Date(b.latest.modifiedAt || b.latest.createdAt);
        if (isNaN(dateA.getTime())) return 1;
        if (isNaN(dateB.getTime())) return -1;
        return dateB - dateA;
      });

      setContractGroups(groups);
    } catch (err) {
      setError('계약서 목록을 불러오는 데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchContracts();
    } else if (!authLoading && !user) {
      setError('로그인이 필요합니다.');
      setLoading(false);
    }
  }, [user, authLoading]);

  const handleDeleteLatest = async (contract) => {
    if (window.confirm(`'${contract.title}' (버전: ${contract.version}) 을(를) 삭제하시겠습니까?
이전 버전이 최신 버전이 됩니다.`)) {
      try {
        await deleteLatestContract(contract.id);
        alert('최신 버전이 삭제되었습니다.');
        fetchContracts();
      } catch (err) {
        alert('삭제 중 오류가 발생했습니다.');
        console.error(err);
      }
    }
  };

  const handleDeleteAll = async (contract) => {
    if (window.confirm(`'${contract.title}' 의 모든 버전 기록을 영구적으로 삭제하시겠습니까?
이 작업은 되돌릴 수 없습니다.`)) {
      try {
        await deleteAllContractsInGroup(contract.id);
        alert('모든 버전 기록이 삭제되었습니다.');
        fetchContracts();
      } catch (err) {
        alert('삭제 중 오류가 발생했습니다.');
        console.error(err);
      }
    }
  };

  const toggleExpand = (groupId) => {
    setExpanded(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const getDisplayDate = (contract) => {
    const date = new Date(contract.modifiedAt || contract.createdAt);
    if (isNaN(date.getTime())) return '날짜 없음';
    return date.toLocaleDateString();
  };

  const truncateMemo = (memo) => {
    if (!memo) return '';
    const firstLine = memo.split('\n')[0];
    if (memo.length > firstLine.length || firstLine.length > 40) {
      return `${firstLine.substring(0, 40)}...`;
    }
    return firstLine;
  };

  const renderMemo = (memo) => {
    if (!memo) {
      return <span className="no-memo">수정메모 없음</span>;
    }

    const truncated = truncateMemo(memo);
    const isTruncated = memo !== truncated;

    if (isTruncated) {
      return (
        <Tooltip text={memo}>
          <span>{truncated}</span>
        </Tooltip>
      );
    }
    
    return <span>{memo}</span>;
  };

  const indexOfLastGroup = currentPage * itemsPerPage;
  const indexOfFirstGroup = indexOfLastGroup - itemsPerPage;
  const currentGroups = contractGroups.slice(indexOfFirstGroup, indexOfLastGroup);
  const totalPages = Math.ceil(contractGroups.length / itemsPerPage);

  const paginate = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  if (authLoading || loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return (
      <div className="contract-management-container">
        <div className="login-prompt">
          <h2>로그인 필요</h2>
          <p>계약서 관리를 위해서는 로그인이 필요합니다.</p>
          <Link to="/login" className="login-btn-link">로그인 페이지로 이동</Link>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="contract-management-container"><h1>{error}</h1></div>;
  }

  return (
    <div className="contract-management-container">
      <h1>계약서 관리</h1>
      <div className="contract-list">
        <div className="contract-list-header">
          <div className="header-item title">제목</div>
          <div className="header-item memo">수정메모</div>
          <div className="header-item date">수정일</div>
          <div className="header-item version">버전</div>
          <div className="header-item management">관리</div>
        </div>
        {currentGroups.length > 0 ? (
          currentGroups.map(({ latest, history }) => (
            <div key={latest.id} className="contract-group">
              <div className="contract-item">
                <div className="item-data title">
                  <Link to={`/contracts/${latest.id}`} state={{ isLatest: true }}>{latest.title}</Link>
                </div>
                <div className="item-data memo">
                  {renderMemo(latest.memo)}
                </div>
                <div className="item-data date">{getDisplayDate(latest)}</div>
                <div className="item-data version">{latest.version}</div>
                <div className="item-data management">
                  {history.length > 0 && (
                    <button onClick={() => handleDeleteLatest(latest)} className="delete-button latest">버전 삭제</button>
                  )}
                  <button onClick={() => handleDeleteAll(latest)} className="delete-button all">전체 삭제</button>
                </div>
              </div>
              {history.length > 0 && (
                <div className="history-toggle">
                  <button onClick={() => toggleExpand(latest.id)} className="history-button">
                    {expanded[latest.id] ? '▲ 이전 버전 숨기기' : `▼ 이전 버전 ${history.length}개 더보기`}
                  </button>
                </div>
              )}
              {expanded[latest.id] && (
                <div className="history-list">
                  {history.map((contract) => (
                    <div key={contract.id} className="contract-item history-item">
                      <div className="item-data title">
                        <Link to={`/contracts/${contract.id}`} state={{ isLatest: false }}>{contract.title}</Link>
                      </div>
                      <div className="item-data memo">
                        {renderMemo(contract.memo)}
                      </div>
                      <div className="item-data date">{getDisplayDate(contract)}</div>
                      <div className="item-data version">{contract.version}</div>
                      <div className="item-data management"></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )) 
        ) : (
          <div className="no-contracts">
            <p>생성된 계약서가 없습니다.</p>
          </div>
        )}
      </div>
      {totalPages > 0 && (
        <div className="pagination">
          <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1}>
            &laquo; 이전
          </button>
          {[...Array(totalPages).keys()].map(number => (
            <button
              key={number + 1}
              onClick={() => paginate(number + 1)}
              className={totalPages > 1 && currentPage === number + 1 ? 'active' : ''}
              disabled={totalPages === 1}
            >
              {number + 1}
            </button>
          ))}
          <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages}>
            다음 &raquo;
          </button>
        </div>
      )}
    </div>
  );
};

export default ContractManagement;
