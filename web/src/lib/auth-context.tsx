'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User, 
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';
import { fetchWithAuth } from './api';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  logout: () => Promise<void>;
  login: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  logout: async () => {},
  login: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('homeseek_dev_user');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {}
      }
    }
    return null;
  });
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchProfile = async (uid: string) => {
    try {
      const res = await fetchWithAuth(`/user-profile/${uid}`);
      if (res && res.ok) {
        const data = await res.json();
        setProfile({ ...data, id: uid });
      } else {
        setProfile({ tier: 'free', id: uid });
      }
    } catch (err) {
      console.error('[AUTH] Failed to fetch profile:', err);
      setProfile({ tier: 'free', id: uid });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        await fetchProfile(firebaseUser.uid);
      } else {
        const stored = typeof window !== 'undefined' ? localStorage.getItem('homeseek_dev_user') : null;
        if (stored) {
          try {
            const devUser = JSON.parse(stored);
            setUser(devUser);
            await fetchProfile(devUser.uid);
          } catch (e) {
            setUser(null);
            setProfile(null);
          }
        } else {
          setUser(null);
          setProfile(null);
        }
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('homeseek_dev_user');
      }
      setUser(null);
      setProfile(null);
      if (isFirebaseConfigured) {
        await firebaseSignOut(auth);
      }
    } catch (err) {
      console.error('[AUTH] Logout failed:', err);
    }
  };

  const login = async () => {
    if (!isFirebaseConfigured) {
      const devUser = {
        uid: "R4R2k7z2XAQGgRjB57ctZcOkEbp2",
        email: "taunhealy@gmail.com",
        displayName: "Taun Healy",
        photoURL: null,
        getIdToken: async () => "mock-dev-token",
      } as any;
      if (typeof window !== 'undefined') {
        localStorage.setItem('homeseek_dev_user', JSON.stringify(devUser));
      }
      setUser(devUser);
      await fetchProfile(devUser.uid);
      return;
    }
    const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('[AUTH] Login failed:', err);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout, login, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
