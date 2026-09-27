'use client';

import { useState } from 'react';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [secretCode, setSecretCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // AuthContext will automatically detect state change, so just route
        router.push('/');
      } else {
        let role = 'viewer';
        let assignedZoneId = null;

        if (secretCode === 'admin_123') {
          role = 'admin';
        } else if (secretCode.startsWith('official_')) {
          role = 'official';
          assignedZoneId = secretCode.replace('official_', '');
        } else if (secretCode !== '') {
          throw new Error('유효하지 않은 권한 코드입니다.');
        }

        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              role: role,
              assignedZoneId: assignedZoneId
            }
          }
        });
        
        if (error) throw error;
        alert('회원가입이 완료되었습니다. 이메일 확인 없이 바로 로그인 가능합니다.');
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message || '인증 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4">
      <Link href="/" className="absolute top-8 left-8 flex items-center text-zinc-500 hover:text-zinc-900 transition-colors">
        <ArrowLeft size={20} className="mr-2" /> 지도 홈으로 돌아가기
      </Link>
      
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-zinc-100">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-zinc-900 tracking-tight">모두의 내일 진단</h1>
          <p className="text-zinc-500 mt-2 text-sm">{isLogin ? '로그인하여 시스템에 접속하세요' : '계정을 생성하고 시스템을 이용하세요'}</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">이메일 주소</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              placeholder="example@email.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">비밀번호</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              placeholder="••••••••"
            />
          </div>

          {!isLogin && (
            <div className="pt-2 border-t border-zinc-100 mt-2">
              <label className="block text-xs font-bold text-zinc-700 mb-1">권한 부여 코드 (선택)</label>
              <input 
                type="text" 
                value={secretCode}
                onChange={e => setSecretCode(e.target.value)}
                className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                placeholder="지자체/운영자 코드 입력"
              />
              <p className="text-[10px] text-zinc-400 mt-1">
                일반 사용자는 비워두세요.<br/>
                관리자: <code>admin_123</code><br/>
                담당자 예시: <code>official_z_1</code>
              </p>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '처리 중...' : (isLogin ? '로그인' : '회원가입')}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <button 
            type="button" 
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-blue-600 hover:underline font-medium"
          >
            {isLogin ? '아직 계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
          </button>
        </div>
      </div>
    </div>
  );
}
