/**
 * Home page with document list and welcome screen
 */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  FileText, 
  Clock, 
  Users, 
  ArrowRight,

  Grid,
  List
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.tsx';
import { useToastHelpers } from '../components/Shared/Toast';
import { Button } from '../components/Shared/Button';
import { Input } from '../components/Shared/Input';
import { LoadingSpinner } from '../components/Shared/LoadingSpinner';
import { Modal } from '../components/Shared/Modal';
import { NewDocumentForm } from '../components/RoomSelector/NewDocumentForm';
import { apiClient, Document } from '../api/apiClient';

export const Home: React.FC = () => {
  const { isAuthenticated, isGuest, user, loginAsGuest } = useAuth();
  const { error } = useToastHelpers();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showNewDocModal, setShowNewDocModal] = useState(false);

  // Handle guest login and navigation
  const handleTryAsGuest = async () => {
    setIsGuestLoading(true);
    try {
      await loginAsGuest();
      navigate('/new');
    } catch (err) {
      error('Failed to start guest session');
    } finally {
      setIsGuestLoading(false);
    }
  };

  // Load documents when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadDocuments();
    }
  }, [isAuthenticated]);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.getDocuments({
        search: searchQuery || undefined,
        limit: 50,
      });
      setDocuments(response.documents);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load documents';
      error('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDocument = async (name: string, isPublic: boolean = false) => {
    try {
      const newDoc = await apiClient.createDocument({ name, is_public: isPublic });
      setShowNewDocModal(false);
      navigate(`/r/${newDoc.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create document';
      error('Error', message);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthenticated) {
      loadDocuments();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  // Welcome screen for unauthenticated users
  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-8">
            <FileText className="h-16 w-16 text-primary-600 dark:text-primary-400 mx-auto mb-4" />
            <h1 className="text-4xl md:text-6xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
              Collaborative
              <span className="text-primary-600 dark:text-primary-400"> Markdown</span>
            </h1>
            <p className="text-xl text-neutral-600 dark:text-neutral-400 mb-8 max-w-2xl mx-auto">
              Edit documents together in real-time with conflict-free collaborative editing. 
              No more version conflicts, just seamless teamwork.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="card p-6">
              <Users className="h-8 w-8 text-primary-600 dark:text-primary-400 mb-3" />
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                Real-time Collaboration
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400">
                See changes instantly as your team edits. No conflicts, no overwrites.
              </p>
            </div>

            <div className="card p-6">
              <FileText className="h-8 w-8 text-primary-600 dark:text-primary-400 mb-3" />
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                Markdown Support
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400">
                Write in Markdown with live preview and syntax highlighting.
              </p>
            </div>

            <div className="card p-6">
              <Clock className="h-8 w-8 text-primary-600 dark:text-primary-400 mb-3" />
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                Offline-First
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400">
                Keep working offline. Changes sync automatically when you reconnect.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-neutral-600 dark:text-neutral-400">
              Get started in seconds - no setup required
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                variant="primary"
                size="lg"
                onClick={handleTryAsGuest}
                disabled={isGuestLoading}
                rightIcon={isGuestLoading ? undefined : <ArrowRight className="h-4 w-4" />}
              >
                {isGuestLoading ? 'Starting...' : 'Try as Guest'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Document dashboard for authenticated users
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {isGuest ? 'Guest Dashboard' : `Welcome back, ${user?.username}`}
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              {isGuest 
                ? 'Create and edit documents in guest mode'
                : 'Manage your collaborative documents'
              }
            </p>
          </div>

          <Button
            variant="primary"
            onClick={() => setShowNewDocModal(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            New Document
          </Button>
        </div>
      </div>

      {/* Search and filters */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <form onSubmit={handleSearch} className="flex-1">
            <Input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </form>

          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Documents */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner text="Loading documents..." />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
            {searchQuery ? 'No documents found' : 'No documents yet'}
          </h3>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            {searchQuery 
              ? 'Try adjusting your search terms'
              : 'Create your first document to get started'
            }
          </p>
          {!searchQuery && (
            <Button
              variant="primary"
              onClick={() => setShowNewDocModal(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Create Document
            </Button>
          )}
        </div>
      ) : (
        <div className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
            : 'space-y-4'
        }>
          {documents.map((doc) => (
            <Link
              key={doc.id}
              to={`/r/${doc.id}`}
              className={`card card-hover p-6 block ${
                viewMode === 'list' ? 'flex items-center' : ''
              }`}
            >
              <div className={viewMode === 'list' ? 'flex-1' : ''}>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 truncate">
                    {doc.name}
                  </h3>
                  {doc.is_public && (
                    <span className="ml-2 px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                      Public
                    </span>
                  )}
                </div>
                
                <div className="flex items-center text-sm text-neutral-500 dark:text-neutral-400 space-x-4">
                  <span className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    {formatDate(doc.updated_at || doc.created_at)}
                  </span>
                </div>
              </div>
              
              {viewMode === 'list' && (
                <ArrowRight className="h-4 w-4 text-neutral-400 ml-4" />
              )}
            </Link>
          ))}
        </div>
      )}

      {/* New Document Modal */}
      <Modal
        isOpen={showNewDocModal}
        onClose={() => setShowNewDocModal(false)}
        title="Create New Document"
        size="sm"
      >
        <NewDocumentForm
          onSubmit={handleCreateDocument}
          onCancel={() => setShowNewDocModal(false)}
        />
      </Modal>
    </div>
  );
};