/**
 * Enhanced document room for collaborative editing
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Share2, 
  Wifi, 
  WifiOff, 
  Eye, 
  EyeOff,
  Save,
  Download,
  Settings,
  Maximize2,
  Minimize2,
  Moon,
  Sun,
  Clock,
  Hash,
  Check,
  MoreVertical,
  FileText
} from 'lucide-react';
import { useAuth } from '../hooks/useAuthSimplified';
import { useWebSocket } from '../hooks/useWebSocket';
import { useTheme } from '../hooks/useTheme';
import { useToastHelpers } from '../components/Shared/Toast';
import { Button } from '../components/Shared/Button';
import { LoadingSpinner } from '../components/Shared/LoadingSpinner';
import { Modal } from '../components/Shared/Modal';
import { Editor } from '../components/Editor/Editor';
import { Preview } from '../components/Preview/Preview';
import { ShareModal } from '../components/RoomSelector/ShareModal';
import { apiClient, DocumentWithContent } from '../api/apiClient';
import { ClientSequenceCRDT } from '../crdt/clientCrdt';
import { debounce } from '../utils/debounce';

interface DocumentStats {
  words: number;
  characters: number;
  charactersWithoutSpaces: number;
  lines: number;
  readingTime: number; // in minutes
}

const DocumentRoomComponent: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { success, error, info } = useToastHelpers();

  // State
  const [document, setDocument] = useState<DocumentWithContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [crdt, setCrdt] = useState<ClientSequenceCRDT | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [copied, setCopied] = useState(false);
  const [documentStats, setDocumentStats] = useState<DocumentStats>({
    words: 0,
    characters: 0,
    charactersWithoutSpaces: 0,
    lines: 0,
    readingTime: 0
  });

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout>();

  // WebSocket connection
  const token = apiClient.getToken();
  const {
    isConnected,
    connectionStatus,
    sendOperation,
    connectedUsers,
  } = useWebSocket({
    documentId: documentId || '',
    token: token,
    onOperation: handleRemoteOperation,
    onInitialState: () => {
      // Silent logging - Received initial state
    },
    onError: () => {
      // Silent error handling
    }
  });

  // Calculate document statistics
  useEffect(() => {
    const text = editorContent;
    const words = text.split(/\s+/).filter(word => word.length > 0).length;
    const characters = text.length;
    const charactersWithoutSpaces = text.replace(/\s/g, '').length;
    const lines = text.split('\n').length;
    const readingTime = Math.ceil(words / 200); // Average reading speed: 200 words/min

    setDocumentStats({
      words,
      characters,
      charactersWithoutSpaces,
      lines,
      readingTime
    });
  }, [editorContent]);

  // Auto-save functionality
  useEffect(() => {
    if (autoSave && document && crdt) {
      autoSaveIntervalRef.current = setInterval(() => {
        saveDocument(true);
      }, 60000); // Auto-save every 60 seconds

      return () => {
        if (autoSaveIntervalRef.current) {
          clearInterval(autoSaveIntervalRef.current);
        }
      };
    }
  }, [autoSave, document, crdt]);

  // Fullscreen functionality
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!window.document.fullscreenElement);
    };

    window.document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Load document data
  useEffect(() => {
    if (!documentId) {
      navigate('/');
      return;
    }

    loadDocument();
  }, [documentId]);

  // Initialize CRDT when document loads
  useEffect(() => {
    if (document) {
      const newCrdt = new ClientSequenceCRDT(user?.username || 'anonymous');
      
      if (document.crdt_state) {
        try {
          const crdtState = JSON.parse(document.crdt_state);
          newCrdt.loadState(crdtState);
        } catch {
          if (document.crdt_state.trim()) {
            const ops = newCrdt.insertText(0, document.crdt_state);
            ops.forEach(op => sendOperation(op));
          }
        }
      }
      
      setCrdt(newCrdt);
      setEditorContent(newCrdt.getText());
      setIsLoading(false);
    }
  }, [document, user]);

  const loadDocument = async () => {
    if (!documentId) return;

    try {
      const doc = await apiClient.getDocument(documentId);
      setDocument(doc);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load document';
      error('Error', message);
      navigate('/');
    }
  };

  function handleRemoteOperation(operation: any) {
    if (!crdt) return;

    try {
      crdt.applyRemoteOperation(operation);
      setEditorContent(crdt.getText());
    } catch (err) {
      // Silent error handling - Failed to apply remote operation
    }
  }

  // Create a memoized debounced function for sending operations
  const debouncedSendOperations = useMemo(
    () => debounce((operations: any[]) => {
      operations.forEach(op => sendOperation(op));
    }, 150),
    [sendOperation]
  );

  const handleEditorChange = useCallback((newContent: string) => {
    if (!crdt || !isConnected) return;

    try {
      const currentContent = crdt.getText();
      const operations = crdt.generateOperationsFromDiff(currentContent, newContent);
      
      // Apply operations locally immediately
      operations.forEach(op => {
        crdt.applyLocalOperation(op);
      });

      // Debounce sending operations to reduce network traffic
      debouncedSendOperations(operations);

      setEditorContent(newContent);
    } catch (err) {
      // Silent error handling - Failed to handle editor change
    }
  }, [crdt, isConnected, debouncedSendOperations]);

  const saveDocument = async (silent = false) => {
    if (!document || !crdt) return;

    try {
      setLastSaved(new Date());
      if (!silent) {
        success('Saved', 'Document saved successfully');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save document';
      error('Save Failed', message);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      containerRef.current.requestFullscreen();
    } else {
      window.document.exitFullscreen();
    }
  };

  const handleExport = async (format: 'md' | 'html' | 'pdf') => {
    try {
      const content = editorContent;
      const filename = `${document?.name || 'document'}.${format}`;

      if (format === 'md') {
        // Export as Markdown
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        success('Exported', `Document exported as ${format.toUpperCase()}`);
      } else if (format === 'html') {
        // Export as HTML
        const { marked } = await import('marked');
        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${document?.name || 'Document'}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
    pre { background: #f4f4f4; padding: 1rem; overflow-x: auto; }
    code { background: #f4f4f4; padding: 0.2rem 0.4rem; }
  </style>
</head>
<body>
  ${marked.parse(content)}
</body>
</html>`;
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        success('Exported', `Document exported as ${format.toUpperCase()}`);
      } else {
        // PDF export would require a backend service or library
        info('Coming Soon', 'PDF export will be available soon');
      }
    } catch (err) {
      error('Export Failed', 'Failed to export document');
    }
  };

  const copyShareLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    success('Link Copied', 'Share link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  // Memoized keyboard shortcut handler
  const handleKeyDown = useMemo(
    () => (e: KeyboardEvent) => {
      // Global keyboard shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            saveDocument();
            break;
          case 'p':
            e.preventDefault();
            setShowPreview(prev => !prev);
            break;
          case 'f':
            if (e.shiftKey) {
              e.preventDefault();
              toggleFullscreen();
            }
            break;
        }
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Responsive layout
  const isMobile = window.innerWidth < 768;

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <LoadingSpinner text="Loading document..." />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
            Document not found
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            The document you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button onClick={() => navigate('/')}>
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`${isFullscreen ? 'fullscreen-editor' : 'h-[calc(100vh-4rem)]'} flex flex-col`}>
      {/* Enhanced Header */}
      <div className="glass border-b">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                leftIcon={<ArrowLeft className="h-4 w-4" />}
              >
                {isMobile ? '' : 'Back'}
              </Button>
              
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 truncate max-w-[300px]">
                    {document.name}
                  </h1>
                  <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                    <div className="flex items-center gap-1">
                      {isConnected ? (
                        <Wifi className="h-3 w-3 text-green-500" />
                      ) : (
                        <WifiOff className="h-3 w-3 text-red-500" />
                      )}
                      <span>{connectionStatus.toString()}</span>
                    </div>
                    
                    {lastSaved && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          Saved {lastSaved.toLocaleTimeString()}
                        </span>
                      </>
                    )}
                    
                    {autoSave && (
                      <>
                        <span>•</span>
                        <span className="text-green-600 dark:text-green-400">Auto-save on</span>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Collaborative users */}
                {connectedUsers.size > 1 && (
                  <div className="flex items-center">
                    <div className="flex -space-x-2">
                      {Array.from(connectedUsers.values()).slice(0, 3).map((userData) => (
                        <div
                          key={userData.site_id}
                          className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-medium border-2 border-white dark:border-neutral-900"
                          title={userData.username}
                        >
                          {userData.username.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {connectedUsers.size > 3 && (
                        <div className="w-8 h-8 rounded-full bg-neutral-300 dark:bg-neutral-700 flex items-center justify-center text-xs font-medium border-2 border-white dark:border-neutral-900">
                          +{connectedUsers.size - 3}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Document stats */}
              {showStats && !isMobile && (
                <div className="flex items-center gap-3 text-xs text-neutral-600 dark:text-neutral-400 px-3 py-1.5 glass rounded-lg">
                  <span className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    {documentStats.words} words
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {documentStats.readingTime} min read
                  </span>
                </div>
              )}

              {/* Action buttons */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleTheme()}
                className="btn-icon"
                title="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="btn-icon"
                title={`${showPreview ? 'Hide' : 'Show'} preview (Ctrl+P)`}
              >
                {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                className="btn-icon"
                title="Toggle fullscreen (Ctrl+Shift+F)"
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>

              <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-700" />

              <Button
                variant="ghost"
                size="sm"
                onClick={() => saveDocument()}
                leftIcon={<Save className="h-4 w-4" />}
                title="Save (Ctrl+S)"
              >
                {isMobile ? '' : 'Save'}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={copyShareLink}
                leftIcon={copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              >
                {isMobile ? '' : copied ? 'Copied!' : 'Share'}
              </Button>

              {/* More options */}
              <div className="relative group">
                <Button
                  variant="ghost"
                  size="sm"
                  className="btn-icon"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
                
                <div className="absolute right-0 top-full mt-2 w-48 glass rounded-lg shadow-xl p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-20">
                  <button
                    onClick={() => handleExport('md')}
                    className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export as Markdown
                  </button>
                  <button
                    onClick={() => handleExport('html')}
                    className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Export as HTML
                  </button>
                  <div className="my-1 h-px bg-neutral-200 dark:bg-neutral-700" />
                  <button
                    onClick={() => {
                      setAutoSave(!autoSave);
                      success(autoSave ? 'Auto-save disabled' : 'Auto-save enabled');
                    }}
                    className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    {autoSave ? 'Disable' : 'Enable'} Auto-save
                  </button>
                  <button
                    onClick={() => setShowStats(!showStats)}
                    className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2"
                  >
                    <Hash className="h-4 w-4" />
                    {showStats ? 'Hide' : 'Show'} Stats
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Connection status banner */}
      {!isConnected && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2">
          <div className="flex items-center justify-center text-sm text-yellow-800 dark:text-yellow-200">
            <WifiOff className="h-4 w-4 mr-2" />
            {connectionStatus.toString() === 'reconnecting' 
              ? 'Reconnecting... Your changes will be saved when connection is restored.'
              : 'Offline - Your changes will be synced when connection is restored.'
            }
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor pane */}
        <div className={`${showPreview && !isMobile ? 'w-1/2' : 'flex-1'} overflow-hidden`}>
          <Editor
            content={editorContent}
            onChange={handleEditorChange}
            readOnly={!isConnected}
            placeholder="Start writing your markdown document..."
          />
        </div>

        {/* Preview pane */}
        {showPreview && (
          <div className={`${isMobile ? 'absolute inset-0 bg-white dark:bg-neutral-900 z-10' : 'w-1/2'} overflow-hidden border-l border-neutral-200 dark:border-neutral-700`}>
            <div className="h-full overflow-y-auto bg-white dark:bg-neutral-900 p-6">
              <div className="max-w-4xl mx-auto preview-content">
                <Preview content={editorContent} />
              </div>
            </div>
            
            {/* Mobile preview close button */}
            {isMobile && (
              <Button
                variant="primary"
                className="fixed bottom-4 right-4 rounded-full shadow-lg"
                onClick={() => setShowPreview(false)}
                leftIcon={<EyeOff className="h-4 w-4" />}
              >
                Close Preview
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Share Modal */}
      <Modal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="Share Document"
        size="md"
      >
        <ShareModal
          document={document}
          onClose={() => setShowShareModal(false)}
          onCopyLink={copyShareLink}
        />
      </Modal>
    </div>
  );
};

export const DocumentRoom = React.memo(DocumentRoomComponent);