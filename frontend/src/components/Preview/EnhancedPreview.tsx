/**
 * Enhanced preview component with better typography and features
 */
import React, { useMemo, useRef, useEffect } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface EnhancedPreviewProps {
  content: string;
  fontSize?: number;
  className?: string;
}

const EnhancedPreviewComponent: React.FC<EnhancedPreviewProps> = ({ 
  content, 
  fontSize = 16,
  className = '' 
}) => {
  const previewRef = useRef<HTMLDivElement>(null);
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);

  // Configure marked options
  const htmlContent = useMemo(() => {
    if (!content.trim()) {
      return `
        <div class="empty-preview">
          <p>Start typing to see preview...</p>
        </div>
      `;
    }

    try {
      // Configure marked
      marked.setOptions({
        gfm: true,
        breaks: true,
      });

      // Custom renderer for enhanced features
      const renderer = new marked.Renderer();

      // Add anchor links to headers
      renderer.heading = (text: string, level: number, raw: string) => {
        const id = raw.toLowerCase().replace(/[^\w]+/g, '-');
        return `
          <h${level} id="${id}" class="group relative">
            ${text}
            <a href="#${id}" class="header-anchor">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </a>
          </h${level}>
        `;
      };

      // Enhanced code blocks with copy button
      renderer.code = (code: string, language?: string) => {
        const id = Math.random().toString(36).substring(2, 11);
        const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        return `
          <div class="code-block-wrapper group">
            <div class="code-block-header">
              <span class="code-block-language">${language || 'text'}</span>
              <button class="code-block-copy" data-code="${btoa(code)}" data-id="${id}">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Copy</span>
              </button>
            </div>
            <pre><code class="language-${language || 'text'}">${escapedCode}</code></pre>
          </div>
        `;
      };

      // Enhanced links with external icon
      renderer.link = (href: string, title: string | null | undefined, text: string) => {
        const isExternal = href.startsWith('http') && !href.includes(window.location.hostname);
        return `
          <a href="${href}" ${title ? `title="${title}"` : ''} 
             ${isExternal ? 'target="_blank" rel="noopener noreferrer"' : ''} 
             class="inline-link ${isExternal ? 'external-link' : ''}">
            ${text}
            ${isExternal ? '<svg class="inline-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>' : ''}
          </a>
        `;
      };

      // Enhanced tables
      renderer.table = (header: string, body: string) => {
        return `
          <div class="table-wrapper">
            <table>
              <thead>${header}</thead>
              <tbody>${body}</tbody>
            </table>
          </div>
        `;
      };

      // Enhanced checkboxes
      renderer.listitem = (text: string, task?: boolean, checked?: boolean) => {
        if (task) {
          return `
            <li class="task-list-item">
              <input type="checkbox" class="task-list-checkbox" ${checked ? 'checked' : ''} disabled>
              <span class="task-list-text">${text}</span>
            </li>
          `;
        }
        return `<li>${text}</li>`;
      };

      marked.use({ renderer });

      const rawHtml = marked.parse(content) as string;
      
      // Configure DOMPurify to allow custom attributes and classes
      DOMPurify.addHook('uponSanitizeElement', (node, data) => {
        // Allow data attributes for code copy functionality
        if (data.tagName === 'button' && node instanceof Element && node.classList.contains('code-block-copy')) {
          return;
        }
      });
      
      DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
        // Allow data-code and data-id attributes on copy buttons
        if (node instanceof Element && node.classList.contains('code-block-copy') && 
            (data.attrName === 'data-code' || data.attrName === 'data-id')) {
          data.keepAttr = true;
        }
      });
      
      // Sanitize HTML to prevent XSS attacks while preserving functionality
      return DOMPurify.sanitize(rawHtml, {
        ALLOWED_TAGS: ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                      'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 
                      'a', 'strong', 'em', 'del', 'ins', 'br', 'hr',
                      'table', 'thead', 'tbody', 'tr', 'th', 'td',
                      'img', 'span', 'sup', 'sub', 'mark', 'button',
                      'svg', 'path', 'input'],
        ALLOWED_ATTR: ['href', 'title', 'src', 'alt', 'class', 'id', 
                       'target', 'rel', 'width', 'height', 'type',
                       'disabled', 'checked', 'data-code', 'data-id',
                       'fill', 'stroke', 'viewBox', 'stroke-linecap',
                       'stroke-linejoin', 'stroke-width', 'd'],
        ALLOW_DATA_ATTR: true
      });
    } catch (error) {
      console.error('Markdown parsing error:', error);
      return '<div class="error-message">Error parsing markdown</div>';
    }
  }, [content]);

  // Handle code copy functionality
  useEffect(() => {
    const handleCodeCopy = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('.code-block-copy') as HTMLButtonElement;
      
      if (button) {
        const code = atob(button.dataset.code || '');
        const id = button.dataset.id || '';
        
        navigator.clipboard.writeText(code).then(() => {
          setCopiedCode(id);
          setTimeout(() => setCopiedCode(null), 2000);
        });
      }
    };

    const preview = previewRef.current;
    if (preview) {
      preview.addEventListener('click', handleCodeCopy);
      return () => preview.removeEventListener('click', handleCodeCopy);
    }
  }, [htmlContent]);

  // Sync scroll position (optional)
  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    // Add smooth scrolling to anchor links
    const handleAnchorClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement;
      if (link) {
        e.preventDefault();
        const id = link.getAttribute('href')?.slice(1);
        const element = document.getElementById(id || '');
        element?.scrollIntoView({ behavior: 'smooth' });
      }
    };

    preview.addEventListener('click', handleAnchorClick);
    return () => preview.removeEventListener('click', handleAnchorClick);
  }, []);

  return (
    <div className={`preview-container h-full overflow-y-auto ${className}`}>
      <div 
        ref={previewRef}
        className="preview-content p-6 max-w-4xl mx-auto"
        style={{ fontSize: `${fontSize}px` }}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
      
      <style>{`
        .preview-content {
          color: inherit;
          line-height: 1.7;
        }

        .empty-preview {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-muted);
          font-style: italic;
        }

        /* Headers with anchor links */
        .preview-content h1,
        .preview-content h2,
        .preview-content h3,
        .preview-content h4,
        .preview-content h5,
        .preview-content h6 {
          position: relative;
          scroll-margin-top: 2rem;
        }

        .header-anchor {
          position: absolute;
          left: -1.5rem;
          top: 50%;
          transform: translateY(-50%);
          opacity: 0;
          transition: opacity 0.2s;
          color: var(--primary);
        }

        .group:hover .header-anchor {
          opacity: 1;
        }

        /* Code blocks */
        .code-block-wrapper {
          position: relative;
          margin: 1.5rem 0;
          border-radius: 0.5rem;
          overflow: hidden;
          background: var(--code-bg);
        }

        .code-block-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 1rem;
          background: rgba(0, 0, 0, 0.1);
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }

        .code-block-language {
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
          opacity: 0.7;
        }

        .code-block-copy {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.5rem;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 0.25rem;
          color: inherit;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
          opacity: 0;
        }

        .group:hover .code-block-copy {
          opacity: 1;
        }

        .code-block-copy:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.3);
        }

        .code-block-copy[data-id="${copiedCode}"] span {
          color: var(--success);
        }

        /* Tables */
        .table-wrapper {
          overflow-x: auto;
          margin: 1.5rem 0;
          border-radius: 0.5rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .preview-content table {
          width: 100%;
          border-collapse: collapse;
        }

        .preview-content th,
        .preview-content td {
          padding: 0.75rem 1rem;
          text-align: left;
          border-bottom: 1px solid var(--border);
        }

        .preview-content th {
          font-weight: 600;
          background: var(--bg-secondary);
        }

        .preview-content tr:hover {
          background: var(--bg-hover);
        }

        /* Task lists */
        .task-list-item {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          list-style: none;
          margin-left: -1.5rem;
        }

        .task-list-checkbox {
          margin-top: 0.25rem;
          cursor: default;
        }

        /* Links */
        .inline-link {
          color: var(--primary);
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: border-color 0.2s;
        }

        .inline-link:hover {
          border-bottom-color: var(--primary);
        }

        .inline-icon {
          display: inline-block;
          width: 0.875rem;
          height: 0.875rem;
          margin-left: 0.125rem;
          vertical-align: baseline;
        }

        /* Responsive images */
        .preview-content img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          margin: 1.5rem 0;
        }

        /* Blockquotes */
        .preview-content blockquote {
          margin: 1.5rem 0;
          padding: 1rem 1.5rem;
          border-left: 4px solid var(--primary);
          background: var(--bg-secondary);
          border-radius: 0 0.5rem 0.5rem 0;
        }

        /* Horizontal rules */
        .preview-content hr {
          margin: 2rem 0;
          border: none;
          height: 1px;
          background: linear-gradient(to right, transparent, var(--border), transparent);
        }

        /* Lists */
        .preview-content ul,
        .preview-content ol {
          margin: 1rem 0;
          padding-left: 2rem;
        }

        .preview-content li {
          margin: 0.5rem 0;
        }

        /* Inline code */
        .preview-content code:not(pre code) {
          padding: 0.125rem 0.375rem;
          background: var(--code-bg);
          border-radius: 0.25rem;
          font-size: 0.875em;
          font-family: var(--font-mono);
        }

        /* CSS Variables for theming */
        :root {
          --text-muted: #6b7280;
          --primary: #6366f1;
          --success: #10b981;
          --border: #e5e7eb;
          --bg-secondary: #f9fafb;
          --bg-hover: #f3f4f6;
          --code-bg: #1f2937;
          --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
        }

        .dark {
          --text-muted: #9ca3af;
          --primary: #818cf8;
          --success: #34d399;
          --border: #374151;
          --bg-secondary: #1f2937;
          --bg-hover: #374151;
          --code-bg: #111827;
        }
      `}</style>
    </div>
  );
};

export const EnhancedPreview = React.memo(EnhancedPreviewComponent);