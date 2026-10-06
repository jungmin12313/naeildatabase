'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';

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
    const loadSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      updateRoleFromSession(session);
      setIsAuthLoaded(true);
    };

    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      updateRoleFromSession(session);
    });

    return () => {
      subscription.unsubscribe();
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
          alert('Viewer 모드로 전환되었습니다.');
        } else {
          localStorage.setItem('stealth_admin', 'true');
          setRole('admin');
          alert('Admin 모드로 전환되었습니다.');
        }
        window.location.reload();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const updateRoleFromSession = (session: any) => {
    // Check stealth admin
    if (typeof window !== 'undefined' && localStorage.getItem('stealth_admin') === 'true') {
      setRole('admin');
      setAssignedZoneId(null);
      return;
    }
    
    // For business proposal presentation, force ALL users to be 'viewer' by default
    setRole('viewer');
    setAssignedZoneId(null);
  };

  const handleSetRole = (newRole: Role) => {
    // Only for fallback / type compatibility, actual role is determined by Supabase session
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
