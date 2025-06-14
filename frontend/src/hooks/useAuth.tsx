/**
 * Authentication hook for managing user state
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

export const useAuthState = () => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    isGuest: false,
  });

  const setLoading = useCallback((isLoading: boolean) => {
    setState(prev => ({ ...prev, isLoading }));
  }, []);

  const setUser = useCallback((user: User | null) => {
    const token = apiClient.getToken();
    const isGuest = token ? token.includes('guest_') : false;
    
    setState({
      user,
      isLoading: false,
      isAuthenticated: user !== null,
      isGuest,
    });
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setLoading(true);
    try {
      await apiClient.login(credentials);
      const user = await apiClient.getCurrentUser();
      setUser(user);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, [setLoading, setUser]);

  const signup = useCallback(async (userData: SignupData) => {
    setLoading(true);
    try {
      await apiClient.signup(userData);
      // Auto-login after signup
      await apiClient.login({
        username: userData.username,
        password: userData.password,
      });
      const currentUser = await apiClient.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, [setLoading, setUser]);

  const logout = useCallback(() => {
    apiClient.logout();
    setUser(null);
  }, [setUser]);

  const loginAsGuest = useCallback(async () => {
    setLoading(true);
    try {
      await apiClient.createGuestToken();
      // For guest users, we don't have a user object
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: true,
        isGuest: true,
      });
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, [setLoading]);

  const refreshUser = useCallback(async () => {
    console.log('[AUTH] refreshUser called, isAuthenticated:', apiClient.isAuthenticated());
    
    if (!apiClient.isAuthenticated()) {
      console.log('[AUTH] No token found, setting loading to false');
      // CRITICAL FIX: Must set loading to false when not authenticated
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
      // Guest user
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
      setUser(user);
    } catch (error) {
      // Don't call logout here to avoid circular dependency
      // Just clear the user
      apiClient.logout();
      setUser(null);
    }
  }, [setUser]);

  // Initialize auth state on mount
  useEffect(() => {
    console.log('[AUTH] useEffect running, calling refreshUser');
    refreshUser();
    
    // Fallback timeout to ensure loading stops
    const timeout = setTimeout(() => {
      console.log('[AUTH] Fallback timeout triggered');
      setState(prev => {
        if (prev.isLoading) {
          console.log('[AUTH] Force setting loading to false');
          return {
            ...prev,
            isLoading: false,
            isAuthenticated: false,
          };
        }
        return prev;
      });
    }, 2000); // 2 second timeout
    
    return () => clearTimeout(timeout);
  }, [refreshUser]);

  return {
    ...state,
    login,
    signup,
    logout,
    loginAsGuest,
    refreshUser,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  console.log('[AuthProvider] Rendering');
  const authState = useAuthState();
  console.log('[AuthProvider] authState:', authState);
  
  return (
    <AuthContext.Provider value={authState}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext };