'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Role = 'viewer' | 'official' | 'admin';

interface AuthContextType {
  role: Role;
  setRole: (role: Role) => void;
  assignedZoneId: string | null; 
  isAuthLoaded: boolean;
  toggleAdminMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>('viewer');
  const [assignedZoneId, setAssignedZoneId] = useState<string | null>(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(true);

  // Helper to toggle admin mode
  const toggleAdminMode = () => {
    const isCurrentlyAdmin = typeof window !== 'undefined' && localStorage.getItem('stealth_admin') === 'true';
    if (isCurrentlyAdmin) {
      localStorage.removeItem('stealth_admin');
      setRole('viewer');
      setAssignedZoneId(null);
    } else {
      localStorage.setItem('stealth_admin', 'true');
      setRole('admin');
      setAssignedZoneId(null);
    }
    window.location.reload();
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Check URL parameters (?admin=true, ?admin=1, ?mode=admin)
    const urlParams = new URLSearchParams(window.location.search);
    const adminParam = urlParams.get('admin') || urlParams.get('mode');
    if (adminParam === 'true' || adminParam === '1' || adminParam === 'admin') {
      localStorage.setItem('stealth_admin', 'true');
      setRole('admin');
      setAssignedZoneId(null);
      setIsAuthLoaded(true);
      return;
    }

    // 2. Check localStorage
    const isCurrentlyAdmin = localStorage.getItem('stealth_admin') === 'true';
    if (isCurrentlyAdmin) {
      setRole('admin');
      setAssignedZoneId(null);
      setIsAuthLoaded(true);
      return;
    }

    // Default to viewer
    setRole('viewer');
    setAssignedZoneId(null);
    setIsAuthLoaded(true);
  }, []);

  // Keyboard shortcut listener (Ctrl+Shift+Y, supports Korean/English and any keyboard state)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const isYKey = 
        e.code === 'KeyY' || 
        e.key === 'Y' || 
        e.key === 'y' || 
        e.key === 'ㅛ' || 
        e.keyCode === 89;

      if (isCtrlOrMeta && isShift && isYKey) {
        e.preventDefault();
        e.stopPropagation();
        toggleAdminMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const handleSetRole = (newRole: Role) => {
    setRole(newRole);
    if (newRole === 'admin') {
      localStorage.setItem('stealth_admin', 'true');
    } else {
      localStorage.removeItem('stealth_admin');
    }
  };

  return (
    <AuthContext.Provider value={{ role, setRole: handleSetRole, assignedZoneId, isAuthLoaded, toggleAdminMode }}>
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
