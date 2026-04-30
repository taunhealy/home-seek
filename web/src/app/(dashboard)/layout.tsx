'use client';

import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';
import { redirect } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading, logout, login, refreshProfile } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      redirect('/');
    }
  }, [user, loading]);

  const handleUpdateProfile = async (updates: any) => {
    // This logic can be moved to auth-context later if preferred
    try {
      const { fetchWithAuth } = await import('@/lib/api');
      await fetchWithAuth(`/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.uid, ...updates })
      });
      await refreshProfile();
    } catch (e) {
      console.error("Failed to update profile telemetry:", e);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.3em]">
            {!user && !loading ? 'Unauthorized. Redirecting...' : 'Synchronizing Identity...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <Navbar 
        user={user} 
        profile={profile} 
        loading={loading}
        handleLogout={logout} 
        handleLogin={login}
        onUpdateProfile={handleUpdateProfile}
      />
      <div className="h-32 w-full" />
      <main className="max-w-[1600px] mx-auto p-6 md:p-12">
        {children}
      </main>
    </div>
  );
}
