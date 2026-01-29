import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase.js';
import { UserRole } from '../types';

type AuthContextValue = {
  user: FirebaseUser | null;
  loading: boolean;
  role: UserRole | null;
  isAdmin: boolean;
  loginWithGoogle: (requestedRole: UserRole) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const parseAdminAllowlist = (): Set<string> => {
  const raw = (import.meta.env.VITE_ADMIN_EMAILS ?? '') as string;
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const adminAllowlist = useMemo(() => parseAdminAllowlist(), []);

  const isAdmin = useMemo(() => {
    const email = user?.email?.toLowerCase();
    return !!email && adminAllowlist.has(email);
  }, [user, adminAllowlist]);

  const role = useMemo(() => {
    if (!user) return null;
    return isAdmin ? UserRole.ADMIN : UserRole.USER;
  }, [user, isAdmin]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setLoading(false);

      if (nextUser) {
        // Create/update user profile document (optional, but useful).
        try {
          await setDoc(
            doc(db, 'users', nextUser.uid),
            {
              id: nextUser.uid,
              email: nextUser.email ?? '',
              name: nextUser.displayName ?? '',
              avatarUrl: nextUser.photoURL ?? '',
              lastLoginAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (e) {
          // Non-fatal; rules or network may block.
          console.warn('Failed to upsert user profile:', e);
        }
      }
    });

    return () => unsub();
  }, []);

  const loginWithGoogle = async (requestedRole: UserRole) => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    const res = await signInWithPopup(auth, provider);
    const email = res.user.email?.toLowerCase();

    if (requestedRole === UserRole.ADMIN) {
      if (!email || !adminAllowlist.has(email)) {
        await signOut(auth);
        throw new Error(
          'This Google account is not authorized for Admin. Add the email to VITE_ADMIN_EMAILS.'
        );
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const value: AuthContextValue = {
    user,
    loading,
    role,
    isAdmin,
    loginWithGoogle,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};
