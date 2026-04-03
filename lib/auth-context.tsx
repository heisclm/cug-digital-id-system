'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User as FirebaseUser, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, query, collection, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { sendNotification } from './notifications';

interface UserProfile {
  uid: string;
  email: string;
  role: 'STUDENT' | 'ADMIN' | 'SECURITY';
  fullName: string;
  studentId?: string;
  department?: string;
  phoneNumber?: string;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  idCard: any | null;
  loading: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, fullName: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [idCard, setIdCard] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        let userProfile: UserProfile;

        if (userDoc.exists()) {
          userProfile = userDoc.data() as UserProfile;
        } else {
          userProfile = {
            uid: user.uid,
            email: user.email || '',
            role: 'STUDENT', // Default role for new users
            fullName: user.displayName || 'New Student',
          };
          await setDoc(doc(db, 'users', user.uid), {
            ...userProfile,
            createdAt: serverTimestamp(),
          });
          // Notification should be handled by backend or admin
          // to comply with security rules (only admins can create notifications)
        }
        setProfile(userProfile);

        // Fetch ID Card if student
        if (userProfile.role === 'STUDENT') {
          const idQuery = query(collection(db, 'id_cards'), where('studentUid', '==', user.uid), where('status', '==', 'ACTIVE'));
          onSnapshot(idQuery, (snapshot) => {
            console.log('ID card snapshot received, docs count:', snapshot.size);
            if (!snapshot.empty) {
              console.log('ID card found:', snapshot.docs[0].id);
              setIdCard(snapshot.docs[0].data() as any);
            } else {
              console.log('No active ID card found for user');
              setIdCard(null);
            }
          });
        }
      } else {
        setProfile(null);
        setIdCard(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUp = async (email: string, pass: string, fullName: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(userCredential.user, { displayName: fullName });
    
    // The onAuthStateChanged will handle the Firestore document creation
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, idCard, loading, login, loginWithEmail, signUp, resetPassword, logout }}>
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
