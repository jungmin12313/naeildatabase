'use client';

import { useState, useEffect } from 'react';
import mockData from '@/data/mock.json';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminReviews() {
  const { role } = useAuth();
  const [mounted, setMounted] = useState(false);
  // Simulate DB state with local state
  const [texts, setTexts] = useState(() => 
    mockData.diagnosisTexts.map((t, index) => ({
      ...t,
      // Simulate created_at for testing: 
      // Make some items older than 7 days, some newer.
      created_at: new Date(Date.now() - (index % 3 === 0 ? 8 : 2) * 24 * 60 * 60 * 1000).toISOString()
    }))
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (role !== 'admin') {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-8 text-center">
        <AlertTriangle size={48} className="text-zinc-300 mb-4" />
        <h2 className="text-2xl font-bold text-zinc-900">권한이 없습니다</h2>
        <p className="mt-2 text-zinc-500">내부 운영자(Admin) 권한이 필요합니다.</p>
      </div>
    );
  }

  const pendingReviews = texts.filter(t => t.review_status === '확인필요');
  
  // Sort: over 7 days first, then by date descending
  const sortedReviews = [...pendingReviews].sort((a, b) => {
    const aDays = (Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const bDays = (Date.now() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const aUrgent = aDays >= 7 ? 1 : 0;
    const bUrgent = bDays >= 7 ? 1 : 0;
    
    if (aUrgent !== bUrgent) return bUrgent - aUrgent;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const handleApprove = (id: string) => {
    setTexts(prev => prev.map(t => 
      t.id === id ? { ...t, review_status: '검수완료', reviewed_at: new Date().toISOString() as any } : t
    ));
  };

  const handleReject = (id: string) => {
    // In a real app, this might delete, flag for recreation, or allow editing.
    // For MVP, we just mark it as cancelled/rejected or allow them to edit.
    // We'll just remove it from pending list for demonstration.
    setTexts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">AI 진단 텍스트 검수</h1>
          <p className="text-zinc-500 mt-2">자동 생성된 AI 진단 텍스트를 검토하고 승인하세요.</p>
        </header>

        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="p-6 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <h2 className="font-semibold text-zinc-800">검수 대기 목록</h2>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 font-bold rounded-full text-sm">
              {sortedReviews.length}건 남음
            </span>
          </div>

          <div className="divide-y divide-zinc-100">
            {sortedReviews.length === 0 ? (
              <div className="p-12 text-center text-zinc-400">
                <CheckCircle size={48} className="mx-auto mb-4 text-zinc-200" />
                <p>모든 검수가 완료되었습니다!</p>
              </div>
            ) : (
              sortedReviews.map(review => {
                const facility = mockData.facilities.find(f => f.id === review.facility_id);
                const daysOld = Math.floor((Date.now() - new Date(review.created_at).getTime()) / (1000 * 60 * 60 * 24));
                const isUrgent = daysOld >= 7;

                return (
                  <div key={review.id} className={`p-6 transition-colors hover:bg-zinc-50 ${isUrgent ? 'bg-red-50/30' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 pr-8">
                        <div className="flex items-center space-x-3 mb-2">
                          {isUrgent && (
                            <span className="flex items-center text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-md">
                              <AlertTriangle size={12} className="mr-1" />
                              지연 경고 (7일 경과)
                            </span>
                          )}
                          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-100 px-2 py-0.5 rounded-md">
                            {review.category.split('_')[1]}
                          </span>
                          <span className="text-sm font-medium text-zinc-700 flex items-center">
                            <Clock size={14} className="mr-1 text-zinc-400" />
                            {daysOld}일 전 생성
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-zinc-900 mb-3">
                          {facility?.name || '알 수 없는 시설'}
                        </h3>
                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-sm text-zinc-800 leading-relaxed">
                          {review.text}
                        </div>
                      </div>
                      
                      <div className="flex flex-col space-y-2 w-32 shrink-0">
                        <button 
                          onClick={() => handleApprove(review.id)}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-sm"
                        >
                          승인
                        </button>
                        <button 
                          onClick={() => handleReject(review.id)}
                          className="w-full py-2 bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700 font-medium rounded-lg transition-colors text-sm"
                        >
                          반려 / 수정
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
