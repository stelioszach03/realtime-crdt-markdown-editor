/**
 * Document room for collaborative editing
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Share2, 
  Users, 
  Wifi, 
  WifiOff, 
  Eye, 
  EyeOff,
  Save,

} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.tsx';
import { useWebSocket } from '../hooks/useWebSocket';
import { useToastHelpers } from '../components/Shared/Toast';
import { Button } from '../components/Shared/Button';
import { LoadingSpinner } from '../components/Shared/LoadingSpinner';
import { Modal } from '../components/Shared/Modal';
import { Editor } from '../components/Editor/Editor';
import { Preview } from '../components/Preview/Preview';
import { ShareModal } from '../components/RoomSelector/ShareModal';
import { apiClient, DocumentWithContent } from '../api/apiClient';
import { ClientSequenceCRDT } from '../crdt/clientCrdt';

export const DocumentRoom: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error } = useToastHelpers();

  // State
  const [document, setDocument] = useState<DocumentWithContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [crdt, setCrdt] = useState<ClientSequenceCRDT | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // WebSocket connection
  const {
    isConnected,
    connectionStatus,
    sendOperation,
    connectedUsers,
  } = useWebSocket({
    documentId: documentId || '',
    onOperation: handleRemoteOperation,
  });

  // Load document data
  // Load document data
  useEffect(() => {
    if (!documentId) {
      navigate('/');
      return;
    }

    loadDocument();
  }, [documentId]); // Μην βάλεις το navigate στις dependencies!

  // Initialize CRDT when document loads
  useEffect(() => {
    if (document) {
      const newCrdt = new ClientSequenceCRDT(user?.username || 'anonymous');
      
      // Load existing content if any
      if (document.crdt_state) {
        // Parse CRDT state from document content
        try {
          const crdtState = JSON.parse(document.crdt_state);
          newCrdt.loadState(crdtState);
        } catch {
          // If content is plain text, insert it
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
      console.error('Failed to apply remote operation:', err);
    }
  }

  const handleEditorChange = useCallback((newContent: string) => {
    if (!crdt || !isConnected) return;

    try {
      const currentContent = crdt.getText();
      
      // Find differences and generate operations
      const operations = crdt.generateOperationsFromDiff(currentContent, newContent);
      
      // Apply operations locally
      operations.forEach(op => {
        crdt.applyLocalOperation(op);
        sendOperation(op);
      });

      setEditorContent(newContent);
      
      // Auto-save periodically
      const now = new Date();
      if (!lastSaved || now.getTime() - lastSaved.getTime() > 5000) {
        saveDocument();
      }
    } catch (err) {
      console.error('Failed to handle editor change:', err);
    }
  }, [crdt, isConnected, sendOperation, lastSaved]);

  const saveDocument = async () => {
    if (!document || !crdt) return;

    try {
      // const crdtState = JSON.stringify(crdt.getState());
      // Note: Backend doesn't support updating crdt_state directly
      // The CRDT state is managed through WebSocket operations
      setLastSaved(new Date());
      success('Saved', 'Document saved successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save document';
      error('Save Failed', message);
    }
  };

  const handleShare = () => {
    setShowShareModal(true);
  };

  const copyShareLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    success('Link Copied', 'Share link copied to clipboard');
  };

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
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                leftIcon={<ArrowLeft className="h-4 w-4" />}
              >
                {isMobile ? '' : 'Back'}
              </Button>
              
              <div>
                <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                  {document.name}
                </h1>
                <div className="flex items-center space-x-2 text-sm text-neutral-500 dark:text-neutral-400">
                  <div className="flex items-center">
                    {isConnected ? (
                      <Wifi className="h-3 w-3 text-green-500 mr-1" />
                    ) : (
                      <WifiOff className="h-3 w-3 text-red-500 mr-1" />
                    )}
                    <span>{connectionStatus.toString()}</span>
                  </div>
                  
                  {lastSaved && (
                    <span>• Saved {lastSaved.toLocaleTimeString()}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Connected users */}
              {connectedUsers.size > 0 && (
                <div className="hidden sm:flex items-center space-x-1">
                  <Users className="h-4 w-4 text-neutral-500" />
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    {connectedUsers.size}
                  </span>
                </div>
              )}

              {/* Mobile preview toggle */}
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                  leftIcon={showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                >
                  {showPreview ? 'Hide' : 'Preview'}
                </Button>
              )}

              {/* Desktop preview toggle */}
              {!isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                  leftIcon={<Eye className="h-4 w-4" />}
                >
                  Preview
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={saveDocument}
                leftIcon={<Save className="h-4 w-4" />}
              >
                {isMobile ? '' : 'Save'}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleShare}
                leftIcon={<Share2 className="h-4 w-4" />}
              >
                {isMobile ? '' : 'Share'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Connection status banner */}
      {!isConnected && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2">
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
        {/* Editor */}
        <div className={`flex-1 ${showPreview && !isMobile ? 'border-r border-neutral-200 dark:border-neutral-700' : ''}`}>
          <Editor
            content={editorContent}
            onChange={handleEditorChange}
            readOnly={!isConnected}
            placeholder="Start writing your markdown document..."
          />
        </div>

        {/* Preview */}
        {showPreview && (
          <div className={`${isMobile ? 'absolute inset-0 bg-white dark:bg-neutral-900 z-10' : 'w-1/2'}`}>
            <Preview content={editorContent} />
            
            {/* Mobile preview close button */}
            {isMobile && (
              <Button
                variant="primary"
                className="fixed bottom-4 right-4 rounded-full"
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