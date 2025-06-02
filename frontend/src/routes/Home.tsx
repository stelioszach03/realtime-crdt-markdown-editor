/**
 * Home page with enhanced document dashboard
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  FileText, 
  Clock, 
  Users, 
  ArrowRight,
  Grid3X3,
  List,
  Filter,
  Tag,
  Star,
  Trash2,
  MoreVertical,
  Hash,
  SortAsc,
  SortDesc,
  Layout,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../hooks/useAuthSimplified';
import { useToastHelpers } from '../components/Shared/Toast';
import { Button } from '../components/Shared/Button';
import { Input } from '../components/Shared/Input';
import { Modal } from '../components/Shared/Modal';
import { NewDocumentForm } from '../components/RoomSelector/NewDocumentForm';
import { DocumentSkeleton } from '../components/Shared/DocumentSkeleton';
import { DocumentTemplates } from '../components/Templates/DocumentTemplates';
import { apiClient, Document } from '../api/apiClient';

type ViewMode = 'grid' | 'list' | 'compact';
type SortBy = 'updated' | 'created' | 'name' | 'size';
type SortOrder = 'asc' | 'desc';
type FilterTag = 'all' | 'personal' | 'work' | 'shared' | 'archived';

interface DocumentWithMeta extends Document {
  tags?: string[];
  starred?: boolean;
  wordCount?: number;
}

const HomeComponent: React.FC = () => {
  const { isAuthenticated, isGuest, user, loginAsGuest } = useAuth();
  const { error, success } = useToastHelpers();
  const navigate = useNavigate();

  // State
  const [documents, setDocuments] = useState<DocumentWithMeta[]>([]);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy] = useState<SortBy>('updated');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterTag, setFilterTag] = useState<FilterTag>('all');
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Handle guest login
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
    // Don't reload if already loading
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const response = await apiClient.getDocuments({
        search: searchQuery || undefined,
        limit: 50, // Reduce limit for better performance
      });
      
      // Use word count from API and add mock metadata
      const docsWithMeta: DocumentWithMeta[] = response.documents.map(doc => ({
        ...doc,
        tags: generateRandomTags(),
        starred: Math.random() > 0.7,
        wordCount: doc.word_count || 0
      }));
      
      setDocuments(docsWithMeta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load documents';
      error('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate random tags for demo
  const generateRandomTags = (): string[] => {
    const allTags = ['personal', 'work', 'ideas', 'draft', 'published', 'shared', 'important'];
    const numTags = Math.floor(Math.random() * 3) + 1;
    const tags: string[] = [];
    
    for (let i = 0; i < numTags; i++) {
      const tag = allTags[Math.floor(Math.random() * allTags.length)];
      if (!tags.includes(tag)) tags.push(tag);
    }
    
    return tags;
  };

  // Filter and sort documents
  const filteredAndSortedDocuments = useMemo(() => {
    let filtered = documents;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(doc => 
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply tag filter
    if (filterTag !== 'all') {
      filtered = filtered.filter(doc => doc.tags?.includes(filterTag));
    }

    // Sort documents
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'created':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'updated':
          comparison = new Date(a.updated_at || a.created_at).getTime() - 
                      new Date(b.updated_at || b.created_at).getTime();
          break;
        case 'size':
          comparison = (a.wordCount || 0) - (b.wordCount || 0);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [documents, searchQuery, filterTag, sortBy, sortOrder]);

  // Get recent documents
  const recentDocuments = useMemo(() => {
    return [...documents]
      .sort((a, b) => 
        new Date(b.updated_at || b.created_at).getTime() - 
        new Date(a.updated_at || a.created_at).getTime()
      )
      .slice(0, 5);
  }, [documents]);

  // Get statistics
  const statistics = useMemo(() => {
    const totalWords = documents.reduce((sum, doc) => sum + (doc.wordCount || 0), 0);
    const sharedDocs = documents.filter(doc => doc.is_public).length;
    const starredDocs = documents.filter(doc => doc.starred).length;
    
    return {
      total: documents.length,
      words: totalWords,
      shared: sharedDocs,
      starred: starredDocs
    };
  }, [documents]);

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

  const handleCreateFromTemplate = async (template: any) => {
    try {
      const newDoc = await apiClient.createDocument({ 
        name: template.name, 
        is_public: false 
      });
      setShowTemplatesModal(false);
      navigate(`/r/${newDoc.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create document';
      error('Error', message);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    try {
      await apiClient.deleteDocument(docId);
      success('Document deleted successfully');
      
      // Remove from local state immediately for better UX
      setDocuments(prev => prev.filter(doc => doc.id !== docId));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete document';
      error('Delete Failed', message);
      // Reload in case of error
      loadDocuments();
    }
  };

  const handleStarDocument = (docId: string) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === docId ? { ...doc, starred: !doc.starred } : doc
    ));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else if (diffInHours < 168) {
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const formatWordCount = (count: number) => {
    if (count < 1000) return `${count} words`;
    return `${(count / 1000).toFixed(1)}k words`;
  };

  // Welcome screen for unauthenticated users
  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 gradient-mesh opacity-30 animate-pulse-slow" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="mb-8">
            <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 mb-6">
              <FileText className="h-16 w-16 text-primary-600 dark:text-primary-400" />
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
              Collaborative
              <span className="text-gradient block mt-2">Markdown Editor</span>
            </h1>
            <p className="text-xl md:text-2xl text-neutral-600 dark:text-neutral-400 mb-8 max-w-2xl mx-auto leading-relaxed">
              Write, collaborate, and create beautiful documents with real-time synchronization and conflict-free editing.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="card p-8 backdrop-gradient">
              <div className="inline-flex p-3 rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 mb-4">
                <Users className="h-8 w-8 text-primary-600 dark:text-primary-400" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                Real-time Collaboration
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                See changes instantly as your team edits. No conflicts, no overwrites, just seamless teamwork.
              </p>
            </div>

            <div className="card p-8 backdrop-gradient">
              <div className="inline-flex p-3 rounded-lg bg-gradient-to-br from-secondary-100 to-secondary-200 dark:from-secondary-900/30 dark:to-secondary-800/30 mb-4">
                <Sparkles className="h-8 w-8 text-secondary-600 dark:text-secondary-400" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                Smart Markdown
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Write in Markdown with live preview, syntax highlighting, and smart formatting tools.
              </p>
            </div>

            <div className="card p-8 backdrop-gradient">
              <div className="inline-flex p-3 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 mb-4">
                <Clock className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                Always Available
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Work offline and sync automatically. Your documents are always accessible when you need them.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-neutral-600 dark:text-neutral-400 text-lg">
              Get started in seconds - no setup required
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                variant="primary"
                size="lg"
                onClick={handleTryAsGuest}
                disabled={isGuestLoading}
                rightIcon={isGuestLoading ? undefined : <ArrowRight className="h-5 w-5" />}
                className="min-w-[200px]"
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
      {/* Header with statistics */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
              {isGuest ? 'Guest Workspace' : `Welcome back, ${user?.username}`}
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 text-lg">
              {isGuest 
                ? 'Create and edit documents in guest mode'
                : 'Your collaborative document workspace'
              }
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => setShowTemplatesModal(true)}
              leftIcon={<Layout className="h-4 w-4" />}
            >
              Templates
            </Button>
            <Button
              variant="primary"
              onClick={() => setShowNewDocModal(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New Document
            </Button>
          </div>
        </div>

        {/* Statistics cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Total Documents</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{statistics.total}</p>
              </div>
              <FileText className="h-8 w-8 text-primary-500 opacity-20" />
            </div>
          </div>
          
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Total Words</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {statistics.words.toLocaleString()}
                </p>
              </div>
              <Hash className="h-8 w-8 text-secondary-500 opacity-20" />
            </div>
          </div>
          
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Shared</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{statistics.shared}</p>
              </div>
              <Users className="h-8 w-8 text-green-500 opacity-20" />
            </div>
          </div>
          
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Starred</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{statistics.starred}</p>
              </div>
              <Star className="h-8 w-8 text-yellow-500 opacity-20" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent documents section */}
      {recentDocuments.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary-500" />
            Recent Documents
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {recentDocuments.map(doc => (
              <Link
                key={doc.id}
                to={`/r/${doc.id}`}
                className="card p-4 card-hover block"
              >
                <h3 className="font-medium text-neutral-900 dark:text-neutral-100 truncate mb-1">
                  {doc.name}
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {formatDate(doc.updated_at || doc.created_at)}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Search and filters */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
              <Input
                type="text"
                placeholder="Search documents, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter button */}
            <div className="relative">
              <Button
                variant={filterTag !== 'all' ? 'secondary' : 'outline'}
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                leftIcon={<Filter className="h-4 w-4" />}
              >
                {filterTag === 'all' ? 'Filter' : filterTag}
              </Button>
              
              {showFilterMenu && (
                <div className="absolute top-full mt-2 right-0 w-48 glass rounded-lg shadow-xl p-2 z-10">
                  {(['all', 'personal', 'work', 'shared', 'archived'] as FilterTag[]).map(tag => (
                    <button
                      key={tag}
                      onClick={() => {
                        setFilterTag(tag);
                        setShowFilterMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        filterTag === tag 
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      {tag.charAt(0).toUpperCase() + tag.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sort button */}
            <Button
              variant="outline"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              leftIcon={sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
            >
              {sortBy}
            </Button>

            {/* View mode toggles */}
            <div className="flex items-center gap-1 p-1 glass rounded-lg">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="p-2"
                aria-label="Grid view"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="p-2"
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'compact' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('compact')}
                className="p-2"
                aria-label="Compact view"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Active filters */}
        {(searchQuery || filterTag !== 'all') && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Active filters:</span>
            {searchQuery && (
              <span className="tag">
                Search: {searchQuery}
                <button
                  onClick={() => setSearchQuery('')}
                  className="tag-remove"
                >
                  ×
                </button>
              </span>
            )}
            {filterTag !== 'all' && (
              <span className="tag">
                Tag: {filterTag}
                <button
                  onClick={() => setFilterTag('all')}
                  className="tag-remove"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Documents */}
      {isLoading ? (
        <div className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
            : 'space-y-4'
        }>
          {[...Array(6)].map((_, i) => (
            <DocumentSkeleton key={i} viewMode={viewMode} />
          ))}
        </div>
      ) : filteredAndSortedDocuments.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex p-4 rounded-full bg-neutral-100 dark:bg-neutral-800 mb-4">
            <FileText className="h-12 w-12 text-neutral-400" />
          </div>
          <h3 className="text-xl font-medium text-neutral-900 dark:text-neutral-100 mb-2">
            {searchQuery || filterTag !== 'all' ? 'No documents found' : 'No documents yet'}
          </h3>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6 max-w-md mx-auto">
            {searchQuery || filterTag !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Create your first document to get started'
            }
          </p>
          {!searchQuery && filterTag === 'all' && (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => setShowTemplatesModal(true)}
                leftIcon={<Layout className="h-4 w-4" />}
              >
                Start from Template
              </Button>
              <Button
                variant="primary"
                onClick={() => setShowNewDocModal(true)}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Create Blank Document
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
            : viewMode === 'compact'
            ? 'grid grid-cols-1 md:grid-cols-2 gap-3'
            : 'space-y-4'
        }>
          {filteredAndSortedDocuments.map((doc) => (
            <div
              key={doc.id}
              className={`doc-card group ${viewMode === 'list' ? 'flex items-center' : ''} ${
                viewMode === 'compact' ? 'p-4' : 'p-6'
              }`}
            >
              <Link
                to={`/r/${doc.id}`}
                className={`block ${viewMode === 'list' ? 'flex-1' : ''}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className={`font-semibold text-neutral-900 dark:text-neutral-100 truncate ${
                    viewMode === 'compact' ? 'text-base' : 'text-lg'
                  }`}>
                    {doc.name}
                  </h3>
                  <div className="flex items-center gap-2 ml-2">
                    {doc.starred && (
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                    )}
                    {doc.is_public && (
                      <Users className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                </div>
                
                {viewMode !== 'compact' && (
                  <>
                    {/* Tags */}
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {doc.tags.map(tag => (
                          <span key={tag} className="doc-card-tag">
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDate(doc.updated_at || doc.created_at)}
                      </span>
                      {doc.wordCount && (
                        <span className="flex items-center gap-1">
                          <Hash className="h-3.5 w-3.5" />
                          {formatWordCount(doc.wordCount)}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </Link>
              
              {/* Actions */}
              <div className={`flex items-center gap-2 ${
                viewMode === 'list' ? 'ml-4' : 'mt-4'
              }`}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleStarDocument(doc.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Star document"
                >
                  <Star className={`h-4 w-4 ${doc.starred ? 'fill-current text-yellow-500' : ''}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteDocument(doc.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                  title="Delete document"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
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

      {/* Templates Modal */}
      <Modal
        isOpen={showTemplatesModal}
        onClose={() => setShowTemplatesModal(false)}
        title="Choose a Template"
        size="lg"
      >
        <DocumentTemplates
          onSelect={handleCreateFromTemplate}
          onCancel={() => setShowTemplatesModal(false)}
        />
      </Modal>
    </div>
  );
};

export const Home = React.memo(HomeComponent);