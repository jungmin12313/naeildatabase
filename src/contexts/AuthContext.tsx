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

  const updateRoleFromSession = (session: any) => {
    // For business proposal presentation, force ALL users to be 'viewer'
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
