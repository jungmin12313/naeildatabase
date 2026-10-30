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
  const [assignedZoneId, setAssignedZoneId] = useState<string | null>(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);

  useEffect(() => {
    // Immediately check stealth admin from localStorage on client mount
    const isCurrentlyAdmin = localStorage.getItem('stealth_admin') === 'true';
    if (isCurrentlyAdmin) {
      setRole('admin');
      setAssignedZoneId(null);
      setIsAuthLoaded(true);
      return;
    }

    const loadSession = async () => {
      try {
        const { supabase } = await import('@/utils/supabase');
        const { data } = await supabase.auth.getSession();
        updateRoleFromSession(data?.session);
      } catch (err) {
        // Fallback for offline/no-supabase mode
        updateRoleFromSession(null);
      } finally {
        setIsAuthLoaded(true);
      }
    };

    loadSession();

    let subscription: any = null;
    import('@/utils/supabase').then(({ supabase }) => {
      try {
        const res = supabase.auth.onAuthStateChange((_event, session) => {
          updateRoleFromSession(session);
        });
        subscription = res.data?.subscription;
      } catch(e) {}
    }).catch(() => {});

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Shift + Y
      if (e.ctrlKey && e.shiftKey && (e.key === 'Y' || e.key === 'y')) {
        e.preventDefault();
        const isCurrentlyAdmin = localStorage.getItem('stealth_admin') === 'true';
        if (isCurrentlyAdmin) {
          localStorage.removeItem('stealth_admin');
          setRole('viewer');
          alert('일반 사용자(Viewer) 모드로 전환되었습니다.');
        } else {
          localStorage.setItem('stealth_admin', 'true');
          setRole('admin');
          alert('관리자(Admin) 모드로 전환되었습니다.');
        }
        window.location.reload();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const updateRoleFromSession = (session: any) => {
    if (typeof window !== 'undefined' && localStorage.getItem('stealth_admin') === 'true') {
      setRole('admin');
      setAssignedZoneId(null);
      return;
    }
    
    // For business proposal presentation, default to 'viewer'
    setRole('viewer');
    setAssignedZoneId(null);
  };

  const handleSetRole = (newRole: Role) => {
    setRole(newRole);
  };

  return (
    <AuthContext.Provider value={{ role, setRole: handleSetRole, assignedZoneId, isAuthLoaded }}>
      {children}
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
