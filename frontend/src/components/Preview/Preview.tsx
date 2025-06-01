/**
 * Preview component for rendering Markdown content
 */
import React, { useMemo } from 'react';
import { marked } from 'marked';
// import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

interface PreviewProps {
  content: string;
  className?: string;
}

export const Preview: React.FC<PreviewProps> = ({ content, className = '' }) => {
  // Configure marked with syntax highlighting
  const htmlContent = useMemo(() => {
    if (!content.trim()) {
      return '<div class="text-gray-500 italic">Start typing to see preview...</div>';
    }

    try {
      // Configure marked options
      marked.setOptions({
        gfm: true,
        breaks: true,
        // highlight: function(code: string, lang: string) {
        //   const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        //   return hljs.highlight(code, { language }).value;
        // }
      });

      return marked.parse(content);
    } catch (error) {
      console.error('Markdown parsing error:', error);
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