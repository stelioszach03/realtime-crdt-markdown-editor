/**
 * New document creation page
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuthSimplified';
import { useToastHelpers } from '../components/Shared/Toast';
import { NewDocumentForm } from '../components/RoomSelector/NewDocumentForm';
import { apiClient } from '../api/apiClient';

const NewDocumentComponent: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loginAsGuest } = useAuth();
  const { error } = useToastHelpers();

  const handleCreateDocument = async (name: string, isPublic: boolean = false) => {
    try {
      // If not authenticated, login as guest first
      if (!isAuthenticated) {
        await loginAsGuest();
      }

      const newDoc = await apiClient.createDocument({ name, is_public: isPublic });
      navigate(`/r/${newDoc.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create document';
      error('Error', message);
    }
  };

  const handleCancel = () => {
    navigate('/');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="card p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
              Create New Document
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              Start collaborating on a new Markdown document
            </p>
          </div>

          <NewDocumentForm
            onSubmit={handleCreateDocument}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </div>
  );
};

export const NewDocument = React.memo(NewDocumentComponent);