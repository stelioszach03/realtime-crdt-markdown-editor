/**
 * Markdown editor component with toolbar
 */
import React, { useRef, useEffect, useState } from 'react';
import { 
  Bold, 
  Italic, 
 
  Code, 
  Link, 
  Image, 
  List, 

  Quote,
  Heading1,
  Heading2,
  Heading3,

} from 'lucide-react';
import { Button } from '../Shared/Button';

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}

const EditorComponent: React.FC<EditorProps> = ({
  content,
  onChange,
  readOnly = false,
  placeholder = 'Start writing...',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [, setSelection] = useState({ start: 0, end: 0 });

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [content]);

  // Handle selection change
  const handleSelectionChange = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      setSelection({
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      });
      setShowToolbar(textarea.selectionStart !== textarea.selectionEnd);
    }
  };

  // Insert text at cursor position
  const insertText = (before: string, after: string = '', placeholder: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const textToInsert = selectedText || placeholder;
    
    const newContent = 
      content.substring(0, start) + 
      before + textToInsert + after + 
      content.substring(end);
    
    onChange(newContent);

    // Set cursor position
    setTimeout(() => {
      const newCursorPos = start + before.length + textToInsert.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  // Insert text at line start
  const insertAtLineStart = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lines = content.split('\n');
    let currentPos = 0;
    let lineIndex = 0;

    // Find which line the cursor is on
    for (let i = 0; i < lines.length; i++) {
      if (currentPos + lines[i].length >= start) {
        lineIndex = i;
        break;
      }
      currentPos += lines[i].length + 1; // +1 for newline
    }

    // Insert prefix at line start
    lines[lineIndex] = prefix + lines[lineIndex];
    const newContent = lines.join('\n');
    onChange(newContent);

    // Set cursor position
    setTimeout(() => {
      const newCursorPos = start + prefix.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  // Toolbar actions
  const toolbarActions = [
    {
      icon: <Bold className="h-4 w-4" />,
      label: 'Bold',
      action: () => insertText('**', '**', 'bold text'),
    },
    {
      icon: <Italic className="h-4 w-4" />,
      label: 'Italic',
      action: () => insertText('*', '*', 'italic text'),
    },
    {
      icon: <Code className="h-4 w-4" />,
      label: 'Inline Code',
      action: () => insertText('`', '`', 'code'),
    },
    {
      icon: <Heading1 className="h-4 w-4" />,
      label: 'Heading 1',
      action: () => insertAtLineStart('# '),
    },
    {
      icon: <Heading2 className="h-4 w-4" />,
      label: 'Heading 2',
      action: () => insertAtLineStart('## '),
    },
    {
      icon: <Heading3 className="h-4 w-4" />,
      label: 'Heading 3',
      action: () => insertAtLineStart('### '),
    },
    {
      icon: <List className="h-4 w-4" />,
      label: 'Bullet List',
      action: () => insertAtLineStart('- '),
    },
    {
      icon: <List className="h-4 w-4" />,
      label: 'Numbered List',
      action: () => insertAtLineStart('1. '),
    },
    {
      icon: <Quote className="h-4 w-4" />,
      label: 'Quote',
      action: () => insertAtLineStart('> '),
    },
    {
      icon: <Link className="h-4 w-4" />,
      label: 'Link',
      action: () => insertText('[', '](url)', 'link text'),
    },
    {
      icon: <Image className="h-4 w-4" />,
      label: 'Image',
      action: () => insertText('![', '](image-url)', 'alt text'),
    },
  ];

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          insertText('**', '**', 'bold text');
          break;
        case 'i':
          e.preventDefault();
          insertText('*', '*', 'italic text');
          break;
        case 'k':
          e.preventDefault();
          insertText('[', '](url)', 'link text');
          break;
        case '`':
          e.preventDefault();
          insertText('`', '`', 'code');
          break;
      }
    }

    // Tab handling for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      insertText('  '); // 2 spaces for indentation
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Floating toolbar */}
      {showToolbar && !readOnly && (
        <div className="absolute z-20 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg p-2 flex items-center space-x-1">
          {toolbarActions.map((action, index) => (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              onClick={action.action}
              className="p-1.5"
              title={action.label}
            >
              {action.icon}
            </Button>
          ))}
        </div>
      )}

      {/* Main toolbar */}
      {!readOnly && (
        <div className="border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2">
          <div className="flex items-center space-x-1 overflow-x-auto">
            {toolbarActions.map((action, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                onClick={action.action}
                className="p-2 flex-shrink-0"
                title={`${action.label} ${getShortcut(action.label)}`}
              >
                {action.icon}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          onSelect={handleSelectionChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          readOnly={readOnly}
          className={`
            w-full h-full min-h-full p-4 resize-none border-none outline-none
            bg-white dark:bg-neutral-900
            text-neutral-900 dark:text-neutral-100
            placeholder-neutral-400 dark:placeholder-neutral-500
            font-mono text-sm leading-relaxed
            ${readOnly ? 'cursor-not-allowed opacity-75' : ''}
          `}
          style={{
            minHeight: 'calc(100vh - 12rem)',
          }}
        />

        {/* Read-only overlay */}
        {readOnly && (
          <div className="absolute inset-0 bg-neutral-100/50 dark:bg-neutral-800/50 flex items-center justify-center">
            <div className="bg-white dark:bg-neutral-800 px-4 py-2 rounded-lg shadow-lg">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Editor is read-only while offline
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-4 py-2">
        <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <div className="flex items-center space-x-4">
            <span>
              {content.length} characters
            </span>
            <span>
              {content.split('\n').length} lines
            </span>
            <span>
              {content.split(/\s+/).filter(word => word.length > 0).length} words
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <span>Markdown</span>
            {readOnly && (
              <span className="text-yellow-600 dark:text-yellow-400">
                Read-only
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const Editor = React.memo(EditorComponent);

// Helper function to get keyboard shortcuts
function getShortcut(label: string): string {
  const shortcuts: Record<string, string> = {
    'Bold': '(Ctrl+B)',
    'Italic': '(Ctrl+I)',
    'Link': '(Ctrl+K)',
    'Inline Code': '(Ctrl+`)',
  };
  return shortcuts[label] || '';
}