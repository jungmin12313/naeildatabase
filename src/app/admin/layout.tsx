'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  LayoutDashboard, ClipboardCheck, Users, Map, BarChart2, Repeat, Settings, LogOut
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { role, setRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (role === 'viewer') {
      router.push('/');
    }
  }, [role, router]);

  if (!mounted || role === 'viewer') {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center text-zinc-500">
        <p className="mb-4 text-lg">권한 확인 중이거나 접근 권한이 없습니다.</p>
        <button onClick={() => router.push('/')} className="px-4 py-2 bg-blue-600 text-white rounded">홈으로 돌아가기</button>
        <div style={{ display: 'none' }}>{children}</div>
      </div>
    );
  }

  const menuItems = [
    { name: '홈 (통합 현황)', path: '/admin', icon: LayoutDashboard },
    { name: 'Tier 1. 미니 진단', path: '/admin/tier1', icon: ClipboardCheck },
    { name: 'Tier 2. 워크숍', path: '/admin/tier2', icon: Users },
    { name: 'Tier 3. 표준 지도', path: '/admin/tier3', icon: Map },
    { name: 'Tier 4. 통합 전수조사', path: '/admin/tier4', icon: BarChart2 },
    { name: 'Tier 5. 구독 모니터링', path: '/admin/tier5', icon: Repeat },
    { name: '시스템 관리', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      {/* Sidebar LNB (Retool Style) */}
      <aside className="w-64 bg-zinc-900 text-zinc-300 flex flex-col print:hidden">
        <div className="p-6">
          <Link href="/admin">
            <h1 className="text-xl font-bold text-white tracking-tight">NAEIL Admin</h1>
          </Link>
          <div className="mt-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="text-xs font-medium text-zinc-400">내부 운영자 모드</span>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const currentPath = pathname || '';
            const isActive = currentPath === item.path || (currentPath.startsWith(item.path) && item.path !== '/admin');
            
            return (
              <Link key={item.path} href={item.path}>
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-blue-600 text-white font-medium' 
                    : 'hover:bg-zinc-800 hover:text-white'
                }`}>
                  <Icon size={18} />
                  <span className="text-sm">{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <button 
            onClick={() => {
              setRole('viewer');
              router.push('/');
            }}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <LogOut size={18} />
            <span>로그아웃 (권한 해제)</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto bg-zinc-50">
        {children}
      </main>
    </div>
  );
}
