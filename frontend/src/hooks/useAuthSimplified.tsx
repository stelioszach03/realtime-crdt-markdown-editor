/**
 * Simplified authentication hook to fix infinite loading issue
 */
import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { apiClient, User, LoginCredentials, SignupData } from '../api/apiClient';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
}

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (userData: SignupData) => Promise<void>;
  logout: () => void;
  loginAsGuest: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    isGuest: false,
  });

  const login = useCallback(async (credentials: LoginCredentials) => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      await apiClient.login(credentials);
      const user = await apiClient.getCurrentUser();
      setState({
        user,
        isLoading: false,
        isAuthenticated: true,
        isGuest: false,
      });
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const signup = useCallback(async (userData: SignupData) => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      await apiClient.signup(userData);
      await apiClient.login({
        username: userData.username,
        password: userData.password,
      });
      const user = await apiClient.getCurrentUser();
      setState({
        user,
        isLoading: false,
        isAuthenticated: true,
        isGuest: false,
      });
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    apiClient.logout();
    setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      isGuest: false,
    });
  }, []);

  const loginAsGuest = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      await apiClient.createGuestToken();
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: true,
        isGuest: true,
      });
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!apiClient.isAuthenticated()) {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        isGuest: false,
      });
      return;
    }

    const token = apiClient.getToken();
    if (token && token.includes('guest_')) {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: true,
        isGuest: true,
      });
      return;
    }

    try {
      const user = await apiClient.getCurrentUser();
      setState({
        user,
        isLoading: false,
        isAuthenticated: true,
        isGuest: false,
      });
    } catch (error) {
      apiClient.logout();
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        isGuest: false,
      });
    }
  }, []);

  // Initialize auth state on mount - ONLY ONCE
  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      if (!mounted) return;
      await refreshUser();
    };
    
    init();
    
    return () => {
      mounted = false;
    };
  }, []); // Empty dependency array - run only once

  const value: AuthContextType = {
    ...state,
    login,
    signup,
    logout,
    loginAsGuest,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext };