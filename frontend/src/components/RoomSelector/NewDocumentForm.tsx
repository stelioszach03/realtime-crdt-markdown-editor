/**
 * Form for creating new documents
 */
import React, { useState } from 'react';
import { Button } from '../Shared/Button';
import { Input } from '../Shared/Input';
import { FileText, Globe, Lock } from 'lucide-react';

interface NewDocumentFormProps {
  onSubmit: (name: string, isPublic: boolean) => void;
  onCancel: () => void;
}

export const NewDocumentForm: React.FC<NewDocumentFormProps> = ({
  onSubmit,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Document name is required');
      return;
    }

    if (name.length < 3) {
      setError('Document name must be at least 3 characters');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      await onSubmit(name.trim(), isPublic);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create document');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Input
        label="Document Name"
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (error) setError('');
        }}
        error={error}
        leftIcon={<FileText className="h-4 w-4" />}
        placeholder="Enter document name"
        autoFocus
        disabled={isLoading}
      />

      <div className="space-y-3">
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Visibility
        </label>
        
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="visibility"
              checked={!isPublic}
              onChange={() => setIsPublic(false)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-neutral-300 dark:border-neutral-600"
              disabled={isLoading}
            />
            <div className="ml-3">
              <div className="flex items-center">
                <Lock className="h-4 w-4 text-neutral-500 mr-2" />
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  Private
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Only you and invited collaborators can access this document
              </p>
            </div>
          </label>

          <label className="flex items-center">
            <input
              type="radio"
              name="visibility"
              checked={isPublic}
              onChange={() => setIsPublic(true)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-neutral-300 dark:border-neutral-600"
              disabled={isLoading}
            />
            <div className="ml-3">
              <div className="flex items-center">
                <Globe className="h-4 w-4 text-neutral-500 mr-2" />
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  Public
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Anyone with the link can view and edit this document
              </p>
            </div>
          </label>
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
        >
          Create Document
        </Button>
      </div>
    </form>
  );
};