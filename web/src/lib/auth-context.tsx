'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User, 
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { auth } from './firebase';
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
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

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
      setUser(firebaseUser);
      
      if (firebaseUser) {
        await fetchProfile(firebaseUser.uid);
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error('[AUTH] Logout failed:', err);
    }
  };

  const login = async () => {
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
