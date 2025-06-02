/**
 * Preview component for rendering Markdown content
 */
import React, { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
// import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

// Configure marked once at module level for performance
marked.setOptions({
  gfm: true,
  breaks: true,
  // highlight: function(code: string, lang: string) {
  //   const language = hljs.getLanguage(lang) ? lang : 'plaintext';
  //   return hljs.highlight(code, { language }).value;
  // }
});

interface PreviewProps {
  content: string;
  className?: string;
}

const PreviewComponent: React.FC<PreviewProps> = ({ content, className = '' }) => {
  // Configure marked with syntax highlighting
  const htmlContent = useMemo(() => {
    if (!content.trim()) {
      return '<div class="text-gray-500 italic">Start typing to see preview...</div>';
    }

    try {
      const rawHtml = marked.parse(content) as string;
      // Sanitize HTML to prevent XSS attacks
      return DOMPurify.sanitize(rawHtml, { 
        ALLOWED_TAGS: ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                      'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 
                      'a', 'strong', 'em', 'del', 'ins', 'br', 'hr',
                      'table', 'thead', 'tbody', 'tr', 'th', 'td',
                      'img', 'span', 'sup', 'sub', 'mark'],
        ALLOWED_ATTR: ['href', 'title', 'src', 'alt', 'class', 'id', 
                       'target', 'rel', 'width', 'height']
      });
    } catch (error) {
      // Silently handle parsing errors
      return '<div class="text-red-500">Error parsing markdown</div>';
    }
  }, [content]);

  return (
    <div className={`preview-container prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none ${className}`}>
      <div 
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  );
};

export const Preview = React.memo(PreviewComponent);