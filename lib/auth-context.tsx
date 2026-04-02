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
          // Ensure the primary admin email always has the ADMIN role in the profile state
          const isAdminEmail = user.email?.toLowerCase() === 'feraclem@gmail.com';
          if (isAdminEmail && userProfile.role !== 'ADMIN') {
            userProfile.role = 'ADMIN';
            // Also update it in Firestore to persist the change
            await setDoc(doc(db, 'users', user.uid), { role: 'ADMIN' }, { merge: true });
          }
        } else {
          const isAdminEmail = user.email?.toLowerCase() === 'feraclem@gmail.com';
          userProfile = {
            uid: user.uid,
            email: user.email || '',
            role: isAdminEmail ? 'ADMIN' : 'STUDENT',
            fullName: user.displayName || (isAdminEmail ? 'Admin' : 'New Student'),
          };
          await setDoc(doc(db, 'users', user.uid), {
            ...userProfile,
            createdAt: serverTimestamp(),
          });
          // Send registration notification
          await sendNotification(
            user.uid,
            'Registration Successful',
            `Welcome to CUG ID, ${userProfile.fullName}! Your account has been successfully created.`,
            'success'
          );
        }
        setProfile(userProfile);

        // Fetch ID Card if student
        if (userProfile.role === 'STUDENT') {
          const idQuery = query(collection(db, 'id_cards'), where('studentUid', '==', user.uid), where('status', '==', 'ACTIVE'));
          onSnapshot(idQuery, (snapshot) => {
            if (!snapshot.empty) {
              setIdCard(snapshot.docs[0].data() as any);
            } else {
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
