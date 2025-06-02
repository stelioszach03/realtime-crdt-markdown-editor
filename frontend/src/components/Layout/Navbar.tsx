/**
 * Navigation bar component with responsive design
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { 
  Menu, 
  X, 
  Sun, 
  Moon, 
  User, 
  LogOut, 
  Settings,
  FileText,
  Plus
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuthSimplified';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../Shared/Button';
import { Modal } from '../Shared/Modal';
import { LoginForm } from '../Auth/LoginForm';
import { SignupForm } from '../Auth/SignupForm';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, isGuest, logout } = useAuth();
  const { effectiveTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);

  const handleLogout = () => {
    logout();
    setIsUserMenuOpen(false);
    navigate('/');
  };

  const handleCreateDocument = () => {
    navigate('/new');
    setIsMobileMenuOpen(false);
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <>
      <nav className="sticky top-0 z-40 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and brand */}
            <div className="flex items-center">
              <Link
                to="/"
                className="flex items-center space-x-2 text-xl font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                onClick={closeMobileMenu}
              >
                <FileText className="h-6 w-6" />
                <span className="hidden sm:block">CollabEdit</span>
              </Link>
            </div>

            {/* Desktop navigation */}
            <div className="hidden md:flex items-center space-x-4">
              {isAuthenticated && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCreateDocument}
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  New Document
                </Button>
              )}

              {/* Theme toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className="p-2"
              >
                {effectiveTheme === 'dark' ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>

              {/* User menu */}
              {isAuthenticated ? (
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center space-x-2 p-2"
                  >
                    <User className="h-4 w-4" />
                    {user && !isGuest && (
                      <span className="hidden lg:block">{user.username}</span>
                    )}
                    {isGuest && (
                      <span className="hidden lg:block text-neutral-500">Guest</span>
                    )}
                  </Button>

                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 py-1">
                      {user && !isGuest && (
                        <>
                          <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-700">
                            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              {user.username}
                            </p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                              {user.email}
                            </p>
                          </div>
                          
                          <button
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              // Navigate to profile/settings
                            }}
                            className="flex items-center w-full px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Settings
                          </button>
                        </>
                      )}
                      
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        {isGuest ? 'Exit Guest Mode' : 'Logout'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowLoginModal(true)}
                  >
                    Login
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowSignupModal(true)}
                  >
                    Sign Up
                  </Button>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle mobile menu"
                className="p-2"
              >
                {isMobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
            <div className="px-4 py-3 space-y-3">
              {isAuthenticated && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCreateDocument}
                  leftIcon={<Plus className="h-4 w-4" />}
                  className="w-full justify-center"
                >
                  New Document
                </Button>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  Theme
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleTheme}
                  className="p-2"
                >
                  {effectiveTheme === 'dark' ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {isAuthenticated ? (
                <div className="space-y-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                  {user && !isGuest && (
                    <div className="px-2 py-1">
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {user.username}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {user.email}
                      </p>
                    </div>
                  )}
                  
                  {isGuest && (
                    <div className="px-2 py-1">
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        Guest Mode
                      </p>
                    </div>
                  )}

                  {user && !isGuest && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        // Navigate to settings
                      }}
                      leftIcon={<Settings className="h-4 w-4" />}
                      className="w-full justify-start"
                    >
                      Settings
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    leftIcon={<LogOut className="h-4 w-4" />}
                    className="w-full justify-start text-red-600 dark:text-red-400"
                  >
                    {isGuest ? 'Exit Guest Mode' : 'Logout'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowLoginModal(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full justify-center"
                  >
                    Login
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setShowSignupModal(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full justify-center"
                  >
                    Sign Up
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Login Modal */}
      <Modal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        title="Welcome Back"
        size="sm"
        className="auth-modal"
      >
        <LoginForm
          onSuccess={() => setShowLoginModal(false)}
          onSwitchToSignup={() => {
            setShowLoginModal(false);
            setShowSignupModal(true);
          }}
        />
      </Modal>

      {/* Signup Modal */}
      <Modal
        isOpen={showSignupModal}
        onClose={() => setShowSignupModal(false)}
        title="Create Account"
        size="sm"
        className="auth-modal"
      >
        <SignupForm
          onSuccess={() => setShowSignupModal(false)}
          onSwitchToLogin={() => {
            setShowSignupModal(false);
            setShowLoginModal(true);
          }}
        />
      </Modal>

      {/* Click outside to close user menu */}
      {isUserMenuOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setIsUserMenuOpen(false)}
        />
      )}
    </>
  );
};