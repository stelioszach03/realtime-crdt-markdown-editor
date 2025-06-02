/**
 * Enhanced Markdown editor with advanced toolbar and features
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Bold, 
  Italic, 
  Code, 
  Link, 
  Image, 
  List, 
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Minus,
  Table,
  CheckSquare,
  Strikethrough,
  FileCode,
  AlertCircle,
  Undo,
  Redo,
  Copy,
  Scissors,
  Clipboard
} from 'lucide-react';
import { Button } from '../Shared/Button';

interface EnhancedEditorProps {
  content: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  fontSize?: number;
  fontFamily?: 'mono' | 'sans' | 'serif';
  onCursorChange?: (position: { line: number; column: number }) => void;
}

interface EditorAction {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  action: () => void;
  group?: string;
}

const EnhancedEditorComponent: React.FC<EnhancedEditorProps> = ({
  content,
  onChange,
  readOnly = false,
  placeholder = 'Start writing...',
  fontSize = 14,
  fontFamily = 'mono',
  onCursorChange
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [history, setHistory] = useState<string[]>([content]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showFloatingToolbar, setShowFloatingToolbar] = useState(false);
  const [floatingToolbarPosition, setFloatingToolbarPosition] = useState({ top: 0, left: 0 });

  // Font mapping
  const fontFamilies = {
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
    sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    serif: 'Georgia, Cambria, "Times New Roman", Times, serif'
  };

  // Update history
  useEffect(() => {
    const timer = setTimeout(() => {
      if (content !== history[historyIndex]) {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(content);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [content]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(textarea.scrollHeight, 400)}px`;
    }
  }, [content]);

  // Track cursor position
  const updateCursorPosition = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || !onCursorChange) return;

    const { selectionStart } = textarea;
    const lines = content.substring(0, selectionStart).split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length;

    onCursorChange({ line, column });
  }, [content, onCursorChange]);

  // Handle selection change
  const handleSelectionChange = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      const { selectionStart, selectionEnd } = textarea;
      setSelection({ start: selectionStart, end: selectionEnd });
      
      // Show floating toolbar if text is selected
      if (selectionStart !== selectionEnd) {
        const rect = textarea.getBoundingClientRect();
        const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight);
        const lines = textarea.value.substring(0, selectionStart).split('\n');
        const top = rect.top + (lines.length - 1) * lineHeight - 40;
        const left = rect.left;
        
        setFloatingToolbarPosition({ top, left });
        setShowFloatingToolbar(true);
      } else {
        setShowFloatingToolbar(false);
      }

      updateCursorPosition();
    }
  };

  // Insert text at cursor position
  const insertText = (before: string, after: string = '', placeholder: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = selection.start;
    const end = selection.end;
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

  // Insert at line start
  const insertAtLineStart = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = selection.start;
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

  // Insert block
  const insertBlock = (block: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = selection.start;
    const end = selection.end;
    const beforeNewline = start === 0 || content[start - 1] === '\n' ? '' : '\n';
    const afterNewline = end === content.length || content[end] === '\n' ? '' : '\n';
    
    const newContent = 
      content.substring(0, start) + 
      beforeNewline + block + afterNewline + 
      content.substring(end);
    
    onChange(newContent);

    // Set cursor position
    setTimeout(() => {
      const newCursorPos = start + beforeNewline.length + block.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  // Undo/Redo
  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      onChange(history[newIndex]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      onChange(history[newIndex]);
    }
  };

  // Copy/Cut/Paste
  const copySelection = () => {
    const selectedText = content.substring(selection.start, selection.end);
    navigator.clipboard.writeText(selectedText);
  };

  const cutSelection = () => {
    const selectedText = content.substring(selection.start, selection.end);
    navigator.clipboard.writeText(selectedText);
    const newContent = content.substring(0, selection.start) + content.substring(selection.end);
    onChange(newContent);
  };

  const pasteClipboard = async () => {
    const text = await navigator.clipboard.readText();
    insertText(text);
  };

  // Define toolbar actions
  const toolbarActions: EditorAction[] = [
    // History
    {
      icon: <Undo className="h-4 w-4" />,
      label: 'Undo',
      shortcut: 'Ctrl+Z',
      action: undo,
      group: 'history'
    },
    {
      icon: <Redo className="h-4 w-4" />,
      label: 'Redo',
      shortcut: 'Ctrl+Y',
      action: redo,
      group: 'history'
    },
    // Clipboard
    {
      icon: <Copy className="h-4 w-4" />,
      label: 'Copy',
      shortcut: 'Ctrl+C',
      action: copySelection,
      group: 'clipboard'
    },
    {
      icon: <Scissors className="h-4 w-4" />,
      label: 'Cut',
      shortcut: 'Ctrl+X',
      action: cutSelection,
      group: 'clipboard'
    },
    {
      icon: <Clipboard className="h-4 w-4" />,
      label: 'Paste',
      shortcut: 'Ctrl+V',
      action: pasteClipboard,
      group: 'clipboard'
    },
    // Formatting
    {
      icon: <Bold className="h-4 w-4" />,
      label: 'Bold',
      shortcut: 'Ctrl+B',
      action: () => insertText('**', '**', 'bold text'),
      group: 'format'
    },
    {
      icon: <Italic className="h-4 w-4" />,
      label: 'Italic',
      shortcut: 'Ctrl+I',
      action: () => insertText('*', '*', 'italic text'),
      group: 'format'
    },
    {
      icon: <Strikethrough className="h-4 w-4" />,
      label: 'Strikethrough',
      action: () => insertText('~~', '~~', 'strikethrough'),
      group: 'format'
    },
    {
      icon: <Code className="h-4 w-4" />,
      label: 'Inline Code',
      shortcut: 'Ctrl+`',
      action: () => insertText('`', '`', 'code'),
      group: 'format'
    },
    // Headings
    {
      icon: <Heading1 className="h-4 w-4" />,
      label: 'Heading 1',
      action: () => insertAtLineStart('# '),
      group: 'heading'
    },
    {
      icon: <Heading2 className="h-4 w-4" />,
      label: 'Heading 2',
      action: () => insertAtLineStart('## '),
      group: 'heading'
    },
    {
      icon: <Heading3 className="h-4 w-4" />,
      label: 'Heading 3',
      action: () => insertAtLineStart('### '),
      group: 'heading'
    },
    // Lists
    {
      icon: <List className="h-4 w-4" />,
      label: 'Bullet List',
      action: () => insertAtLineStart('- '),
      group: 'list'
    },
    {
      icon: <ListOrdered className="h-4 w-4" />,
      label: 'Numbered List',
      action: () => insertAtLineStart('1. '),
      group: 'list'
    },
    {
      icon: <CheckSquare className="h-4 w-4" />,
      label: 'Task List',
      action: () => insertAtLineStart('- [ ] '),
      group: 'list'
    },
    // Blocks
    {
      icon: <Quote className="h-4 w-4" />,
      label: 'Quote',
      action: () => insertAtLineStart('> '),
      group: 'block'
    },
    {
      icon: <FileCode className="h-4 w-4" />,
      label: 'Code Block',
      action: () => insertBlock('```\ncode\n```'),
      group: 'block'
    },
    {
      icon: <Minus className="h-4 w-4" />,
      label: 'Horizontal Rule',
      action: () => insertBlock('---'),
      group: 'block'
    },
    {
      icon: <Table className="h-4 w-4" />,
      label: 'Table',
      action: () => insertBlock('| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |'),
      group: 'block'
    },
    // Insert
    {
      icon: <Link className="h-4 w-4" />,
      label: 'Link',
      shortcut: 'Ctrl+K',
      action: () => insertText('[', '](url)', 'link text'),
      group: 'insert'
    },
    {
      icon: <Image className="h-4 w-4" />,
      label: 'Image',
      action: () => insertText('![', '](url)', 'alt text'),
      group: 'insert'
    },
  ];

  // Group actions
  const actionGroups = {
    history: toolbarActions.filter(a => a.group === 'history'),
    clipboard: toolbarActions.filter(a => a.group === 'clipboard'),
    format: toolbarActions.filter(a => a.group === 'format'),
    heading: toolbarActions.filter(a => a.group === 'heading'),
    list: toolbarActions.filter(a => a.group === 'list'),
    block: toolbarActions.filter(a => a.group === 'block'),
    insert: toolbarActions.filter(a => a.group === 'insert'),
  };

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
        case 'z':
          e.preventDefault();
          undo();
          break;
        case 'y':
          e.preventDefault();
          redo();
          break;
      }
    }

    // Tab handling
    if (e.key === 'Tab') {
      e.preventDefault();
      insertText('  ');
    }
  };

  return (
    <div className="h-full flex flex-col editor-container">
      {/* Floating toolbar */}
      {showFloatingToolbar && !readOnly && (
        <div 
          className="fixed z-30 glass rounded-lg shadow-2xl p-1 flex items-center gap-0.5"
          style={{ top: floatingToolbarPosition.top, left: floatingToolbarPosition.left }}
        >
          {actionGroups.format.map((action, index) => (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              onClick={() => {
                action.action();
                setShowFloatingToolbar(false);
              }}
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
        <div className="editor-toolbar overflow-x-auto">
          <div className="flex items-center gap-1">
            {/* History group */}
            <div className="flex items-center">
              {actionGroups.history.map((action, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  onClick={action.action}
                  className="toolbar-button"
                  title={`${action.label} ${action.shortcut || ''}`}
                  disabled={
                    action.label === 'Undo' ? historyIndex === 0 :
                    action.label === 'Redo' ? historyIndex === history.length - 1 :
                    false
                  }
                >
                  {action.icon}
                </Button>
              ))}
            </div>

            <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-700 mx-1" />

            {/* Clipboard group */}
            <div className="flex items-center">
              {actionGroups.clipboard.map((action, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  onClick={action.action}
                  className="toolbar-button"
                  title={`${action.label} ${action.shortcut || ''}`}
                >
                  {action.icon}
                </Button>
              ))}
            </div>

            <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-700 mx-1" />

            {/* Format group */}
            <div className="flex items-center">
              {actionGroups.format.map((action, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  onClick={action.action}
                  className="toolbar-button"
                  title={`${action.label} ${action.shortcut || ''}`}
                >
                  {action.icon}
                </Button>
              ))}
            </div>

            <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-700 mx-1" />

            {/* Heading group */}
            <div className="flex items-center">
              {actionGroups.heading.map((action, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  onClick={action.action}
                  className="toolbar-button"
                  title={action.label}
                >
                  {action.icon}
                </Button>
              ))}
            </div>

            <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-700 mx-1" />

            {/* List group */}
            <div className="flex items-center">
              {actionGroups.list.map((action, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  onClick={action.action}
                  className="toolbar-button"
                  title={action.label}
                >
                  {action.icon}
                </Button>
              ))}
            </div>

            <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-700 mx-1" />

            {/* Block group */}
            <div className="flex items-center">
              {actionGroups.block.map((action, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  onClick={action.action}
                  className="toolbar-button"
                  title={action.label}
                >
                  {action.icon}
                </Button>
              ))}
            </div>

            <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-700 mx-1" />

            {/* Insert group */}
            <div className="flex items-center">
              {actionGroups.insert.map((action, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  onClick={action.action}
                  className="toolbar-button"
                  title={`${action.label} ${action.shortcut || ''}`}
                >
                  {action.icon}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 relative overflow-hidden">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          onSelect={handleSelectionChange}
          onKeyDown={handleKeyDown}
          onKeyUp={updateCursorPosition}
          onClick={updateCursorPosition}
          placeholder={placeholder}
          readOnly={readOnly}
          className={`
            w-full h-full min-h-full p-6 resize-none border-none outline-none
            bg-transparent
            text-neutral-900 dark:text-neutral-100
            placeholder-neutral-400 dark:placeholder-neutral-500
            leading-relaxed
            ${readOnly ? 'cursor-not-allowed opacity-75' : ''}
          `}
          style={{
            fontSize: `${fontSize}px`,
            fontFamily: fontFamilies[fontFamily],
          }}
        />

        {/* Read-only overlay */}
        {readOnly && (
          <div className="absolute inset-0 bg-neutral-100/50 dark:bg-neutral-800/50 flex items-center justify-center pointer-events-none">
            <div className="glass px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Editor is read-only while offline
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="glass-subtle border-t px-4 py-2">
        <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <div className="flex items-center gap-4">
            <span>
              Ln {selection.start ? content.substring(0, selection.start).split('\n').length : 1}, 
              Col {selection.start ? selection.start - content.lastIndexOf('\n', selection.start - 1) : 1}
            </span>
            {selection.start !== selection.end && (
              <span>
                {selection.end - selection.start} selected
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
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

export const EnhancedEditor = React.memo(EnhancedEditorComponent);