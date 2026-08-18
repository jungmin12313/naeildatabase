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
