'use client';

import React, { useState } from 'react';
import Sidebar from './sidebar';
import Navbar from './navbar';
import { useAuth } from '@/lib/auth-context';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, login, loginWithEmail, signUp, resetPassword } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 bg-orange-500/20 rounded-full animate-ping"></div>
          <div className="relative bg-white dark:bg-gray-900 p-4 rounded-full shadow-xl border border-gray-100 dark:border-gray-800 animate-bounce">
            <GraduationCap className="w-10 h-10 text-orange-500" />
          </div>
        </div>
        <p className="mt-6 text-gray-500 dark:text-gray-400 font-medium animate-pulse">Loading CUG ID...</p>
      </div>
    );
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);
    try {
      if (isResetPassword) {
        await resetPassword(email);
        setAuthSuccess('Password reset email sent! Please check your inbox.');
      } else if (isSignUp) {
        await signUp(email, password, fullName);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 p-4 sm:p-6 transition-colors overflow-y-auto">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-[2rem] shadow-xl shadow-orange-500/5 p-6 sm:p-10 text-center space-y-6 border border-gray-100 dark:border-gray-800 my-8">
          <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center text-white mx-auto shadow-lg shadow-orange-500/20">
            <GraduationCap size={32} />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              {isResetPassword ? 'Reset Password' : (isSignUp ? 'Create Account' : 'Welcome to CUG ID')}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
              {isResetPassword 
                ? 'Enter your email to receive a reset link' 
                : (isSignUp ? 'Join the digital identity platform' : 'Please sign in to manage your identity')}
            </p>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
            {isSignUp && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase ml-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-none rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 transition-all text-black dark:text-white"
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase ml-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@cug.edu.gh"
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-none rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 transition-all text-black dark:text-white"
              />
            </div>
            {!isResetPassword && (
              <div className="space-y-1">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Password</label>
                  {!isSignUp && (
                    <button 
                      type="button"
                      onClick={() => {
                        setIsResetPassword(true);
                        setAuthError('');
                        setAuthSuccess('');
                      }}
                      className="text-[10px] font-bold text-orange-600 dark:text-orange-500 hover:underline"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-none rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 transition-all text-black dark:text-white pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            {authError && (
              <p className="text-xs text-red-500 font-bold text-center bg-red-50 dark:bg-red-500/10 py-2 rounded-lg">
                {authError}
              </p>
            )}

            {authSuccess && (
              <p className="text-xs text-green-500 font-bold text-center bg-green-50 dark:bg-green-500/10 py-2 rounded-lg">
                {authSuccess}
              </p>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3.5 bg-gray-900 dark:bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-gray-800 dark:hover:bg-orange-600 transition-all active:scale-[0.98] shadow-lg shadow-gray-900/10 dark:shadow-orange-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {authLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                isResetPassword ? 'Send Reset Link' : (isSignUp ? 'Create Account' : 'Sign In')
              )}
            </button>
            
            {isResetPassword && (
              <button 
                type="button"
                onClick={() => {
                  setIsResetPassword(false);
                  setAuthError('');
                  setAuthSuccess('');
                }}
                className="w-full text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-all"
              >
                Back to Login
              </button>
            )}
          </form>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100 dark:border-gray-800"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-gray-900 px-2 text-gray-400 dark:text-gray-500 font-bold">Or continue with</span></div>
          </div>

          <button
            onClick={login}
            className="w-full py-3.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google
          </button>

          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            {!isResetPassword && (
              <>
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button 
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-orange-600 dark:text-orange-500 font-bold hover:underline"
                >
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex transition-colors overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 flex flex-col lg:ml-64 w-full min-w-0">
        <Navbar onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-80px)] overflow-y-auto overflow-x-hidden w-full">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
