'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Role = 'viewer' | 'official' | 'admin';

interface AuthContextType {
  role: Role;
  setRole: (role: Role) => void;
  assignedZoneId: string | null; 
  isAuthLoaded: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>('viewer');
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);
  
  // For MVP, we assign 'z_1' to officials for testing
  const assignedZoneId = role === 'official' ? 'z_1' : null;

  // Persist mock role in localStorage for convenience during testing
  useEffect(() => {
    const saved = localStorage.getItem('mock_role');
    if (saved === 'viewer' || saved === 'official' || saved === 'admin') {
      setRole(saved as Role);
    }
    setIsAuthLoaded(true);
  }, []);

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSetRole = (newRole: Role) => {
    setRole(newRole);
    localStorage.setItem('mock_role', newRole);
  };

  return (
    <AuthContext.Provider value={{ role, setRole: handleSetRole, assignedZoneId, isAuthLoaded }}>
      {children}
      
      {/* Floating Mock Auth Switcher for Dev/MVP */}
      <div className="fixed bottom-4 left-4 z-[999] print:hidden">
        {!isMenuOpen ? (
          <button 
            onClick={() => setIsMenuOpen(true)}
            className="w-12 h-12 bg-zinc-800 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-zinc-700 transition-colors border-2 border-white/20"
          >
            <span className="text-xl">⚙️</span>
          </button>
        ) : (
          <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-zinc-200 flex flex-col items-center min-w-[280px]">
            <div className="w-full flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-zinc-500 tracking-wider uppercase">⚙️ 시스템/권한 설정</span>
              <button onClick={() => setIsMenuOpen(false)} className="text-zinc-400 hover:text-zinc-600 font-bold p-1">✕</button>
            </div>
            
            <div className="flex flex-col w-full space-y-1 bg-zinc-100 p-1.5 rounded-xl">
              <button 
                onClick={() => handleSetRole('viewer')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors text-left ${role === 'viewer' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                일반 사용자
              </button>
              <button 
                onClick={() => handleSetRole('official')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors text-left ${role === 'official' ? 'bg-white shadow-sm text-blue-600' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                지자체 담당자
              </button>
              <button 
                onClick={() => handleSetRole('admin')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors text-left ${role === 'admin' ? 'bg-white shadow-sm text-purple-600' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                내부 운영자
              </button>
            </div>
            
            {/* Navigation Links for MVP Testing */}
            <div className="mt-4 flex space-x-3 text-xs font-bold w-full justify-center bg-blue-50/50 p-2 rounded-lg">
              <a href="/" className="text-blue-600 hover:underline">지도 홈</a>
              {(role === 'official' || role === 'admin') && (
                <a href="/dashboard" className="text-blue-600 hover:underline">대시보드</a>
              )}
              {role === 'admin' && (
                <a href="/admin/reviews" className="text-blue-600 hover:underline">AI 검수</a>
              )}
            </div>
            
            {/* Admin/Official Tools */}
            {(role === 'admin' || role === 'official') && (
              <div className="mt-3 border-t border-zinc-200 pt-3 w-full flex flex-col items-center gap-2">
                <label className="cursor-pointer bg-zinc-800 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm hover:bg-zinc-900 transition-colors text-center w-full">
                  📥 엑셀 DB 통합 자동업로드
                  <input type="file" accept=".xlsx" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      alert('로컬에 설치된 Supabase DB로 업로드를 시작합니다. (터미널 로그를 확인해주세요)');
                      const formData = new FormData();
                      formData.append('file', file);
                      const res = await fetch('/api/upload', { method: 'POST', body: formData });
                      if (!res.ok) throw new Error('Upload failed');
                      const result = await res.json();
                      alert(`업로드 성공! 총 ${result.zonesCount || 1}개의 구역과 1개의 전체구역이 생성되었습니다. 새로고침을 해주세요.`);
                    } catch (err) {
                      alert('업로드 중 오류가 발생했습니다.');
                      console.error(err);
                    }
                  }} />
                </label>
                
                {role === 'admin' && (
                  <button
                    onClick={async () => {
                      if(confirm('정말 모든 구역/시설 데이터를 삭제하시겠습니까?')) {
                        try {
                          await fetch('/api/upload', { method: 'DELETE' });
                          alert('데이터 초기화가 완료되었습니다. 화면을 새로고침합니다.');
                          window.location.reload();
                        } catch (err) {
                          alert('초기화 중 오류가 발생했습니다.');
                        }
                      }
                    }}
                    className="bg-red-50 text-red-600 text-xs font-bold px-4 py-2.5 rounded-lg border border-red-200 hover:bg-red-100 transition-colors w-full"
                  >
                    🗑️ 전체 데이터 완전 초기화
                  </button>
                )}
              </div>
            )}
            <p className="mt-3 text-[10px] text-zinc-400 text-center">데이터 관리 및 시스템 테스트를 위한 도구입니다.</p>
          </div>
        )}
      </div>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
