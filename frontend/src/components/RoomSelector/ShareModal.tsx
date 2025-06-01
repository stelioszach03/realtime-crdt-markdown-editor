/**
 * Share modal for document collaboration
 */
import React, { useState } from 'react';
import { Copy, Globe, Lock, Users, Link as LinkIcon } from 'lucide-react';
import { Button } from '../Shared/Button';
import { Input } from '../Shared/Input';
import { useToastHelpers } from '../Shared/Toast';
import { Document } from '../../api/apiClient';

interface ShareModalProps {
  document: Document;
  onClose: () => void;
  onCopyLink: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  document,
  onClose,
  onCopyLink,
}) => {
  const { success } = useToastHelpers();
  const [inviteEmail, setInviteEmail] = useState('');

  const shareUrl = window.location.href;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    success('Link Copied', 'Share link copied to clipboard');
    onCopyLink();
  };

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    
    // TODO: Implement email invitation
    success('Invitation Sent', `Invitation sent to ${inviteEmail}`);
    setInviteEmail('');
  };

  return (
    <div className="space-y-6">
      {/* Document info */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          {document.name}
        </h3>
        <div className="flex items-center justify-center space-x-2 text-sm text-neutral-600 dark:text-neutral-400">
          {document.is_public ? (
            <>
              <Globe className="h-4 w-4" />
              <span>Public document</span>
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              <span>Private document</span>
            </>
          )}
        </div>
      </div>

      {/* Share link */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Share Link
        </label>
        
        <div className="flex space-x-2">
          <Input
            value={shareUrl}
            readOnly
            leftIcon={<LinkIcon className="h-4 w-4" />}
            className="flex-1"
          />
          <Button
            variant="outline"
            onClick={handleCopyLink}
            leftIcon={<Copy className="h-4 w-4" />}
          >
            Copy
          </Button>
        </div>
        
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {document.is_public 
            ? 'Anyone with this link can view and edit this document'
            : 'Only people you invite can access this document'
          }
        </p>
      </div>

      {/* Invite by email */}
      {!document.is_public && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Invite Collaborators
          </label>
          
          <div className="flex space-x-2">
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Enter email address"
              leftIcon={<Users className="h-4 w-4" />}
              className="flex-1"
            />
            <Button
              variant="primary"
              onClick={handleInvite}
              disabled={!inviteEmail.trim()}
            >
              Invite
            </Button>
          </div>
          
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Send an invitation email to collaborate on this document
          </p>
        </div>
      )}

      {/* Permissions info */}
      <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
          Collaboration Features
        </h4>
        <ul className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
          <li>• Real-time collaborative editing</li>
          <li>• See other users' cursors and selections</li>
          <li>• Automatic conflict resolution</li>
          <li>• Offline editing with sync when reconnected</li>
          <li>• Version history and change tracking</li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
};