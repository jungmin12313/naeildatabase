'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Role = 'viewer' | 'official' | 'admin';

interface AuthContextType {
  role: Role;
  setRole: (role: Role) => void;
  // In a real app, official would be tied to specific zone_ids
  assignedZoneId: string | null; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>('viewer');
  
  // For MVP, we assign 'z_1' to officials for testing
  const assignedZoneId = role === 'official' ? 'z_1' : null;

  // Persist mock role in localStorage for convenience during testing
  useEffect(() => {
    const saved = localStorage.getItem('mock_role');
    if (saved === 'viewer' || saved === 'official' || saved === 'admin') {
      setRole(saved);
    }
  }, []);

  const handleSetRole = (newRole: Role) => {
    setRole(newRole);
    localStorage.setItem('mock_role', newRole);
  };

  return (
    <AuthContext.Provider value={{ role, setRole: handleSetRole, assignedZoneId }}>
      {children}
      
      {/* Floating Mock Auth Switcher for Dev/MVP */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-zinc-200 flex flex-col items-center print:hidden">
        <span className="text-xs font-bold text-zinc-500 mb-2 tracking-wider uppercase">현재 접속 권한</span>
        <div className="flex space-x-1 bg-zinc-100 p-1 rounded-xl">
          <button 
            onClick={() => handleSetRole('viewer')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${role === 'viewer' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            일반 사용자
          </button>
          <button 
            onClick={() => handleSetRole('official')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${role === 'official' ? 'bg-white shadow-sm text-blue-600' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            지자체 담당자
          </button>
          <button 
            onClick={() => handleSetRole('admin')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${role === 'admin' ? 'bg-white shadow-sm text-purple-600' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            내부 운영자
          </button>
        </div>
        
        {/* Navigation Links for MVP Testing */}
        <div className="mt-3 flex space-x-2 text-xs font-semibold">
          <a href="/" className="text-blue-600 hover:underline">지도 홈</a>
          {(role === 'official' || role === 'admin') && (
            <a href="/dashboard" className="text-blue-600 hover:underline">대시보드</a>
          )}
          {role === 'admin' && (
            <a href="/admin/reviews" className="text-blue-600 hover:underline">AI 검수</a>
          )}
        </div>
        
        {/* Admin Tools */}
        {role === 'admin' && (
          <div className="mt-3 border-t border-zinc-200 pt-3 w-full flex flex-col items-center gap-2">
            <label className="cursor-pointer bg-zinc-800 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-zinc-900 transition-colors text-center w-full">
              📥 엑셀 데이터 DB 자동 업로드
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
            
            <button
              onClick={async () => {
                if(confirm('정말 모든 구역/시설 데이터를 삭제하시겠습니까?')) {
                  try {
                    const res = await fetch('/api/upload', { method: 'DELETE' });
                    if(!res.ok) throw new Error('Delete failed');
                    alert('전체 데이터가 삭제되었습니다. 새로고침을 해주세요.');
                  } catch(e) {
                    alert('삭제 실패!');
                  }
                }
              }}
              className="bg-red-50 text-red-600 border border-red-200 text-[11px] font-bold px-4 py-1.5 rounded-lg shadow-sm hover:bg-red-100 transition-colors text-center w-full"
            >
              🗑️ 전체 데이터 초기화
            </button>
            <p className="text-[10px] text-zinc-400 mt-1">
              데이터 관리를 위한 관리자 도구입니다.
            </p>
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
