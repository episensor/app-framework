import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { Card } from '../../components/base/card';
import { Button } from '../../components/base/button';
import { ScrollArea } from '../../components/base/scroll-area';
import { Copy, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MarkdownViewerProps {
  content: string;
  className?: string;
  showCopyButton?: boolean;
}

export function MarkdownViewer({ 
  content, 
  className,
  showCopyButton = true
}: MarkdownViewerProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const components = useMemo(() => ({
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const code = String(children).replace(/\n$/, '');
      
      return !inline && match ? (
        <div className="relative group">
          <SyntaxHighlighter
            style={oneDark}
            language={match[1]}
            PreTag="div"
            className="!rounded-md !my-4"
            {...props}
          >
            {code}
          </SyntaxHighlighter>
          {showCopyButton && (
            <Button
              size="sm"
              variant="ghost"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => copyToClipboard(code)}
            >
              {copiedCode === code ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      ) : (
        <code className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono" {...props}>
          {children}
        </code>
      );
    },
    pre({ children }: any) {
      return <>{children}</>;
    },
    h1: ({ children }: any) => (
      <h1 className="text-2xl font-bold mt-6 mb-4">{children}</h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-xl font-semibold mt-5 mb-3">{children}</h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>
    ),
    p: ({ children }: any) => (
      <p className="mb-4 leading-relaxed">{children}</p>
    ),
    ul: ({ children }: any) => (
      <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>
    ),
    ol: ({ children }: any) => (
      <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-muted-foreground/30 pl-4 my-4 italic">
        {children}
      </blockquote>
    ),
    a: ({ href, children }: any) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
      >
        {children}
      </a>
    ),
    table: ({ children }: any) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full divide-y divide-border">{children}</table>
      </div>
    ),
    th: ({ children }: any) => (
      <th className="px-4 py-2 text-left font-medium">{children}</th>
    ),
    td: ({ children }: any) => (
      <td className="px-4 py-2 border-t">{children}</td>
    ),
  }), [copiedCode, showCopyButton]);

  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * MarkdownViewer component wrapped in a Card
 */
export function MarkdownCard({ 
  content, 
  className,
  title,
  ...props 
}: MarkdownViewerProps & { title?: string }) {
  return (
    <Card className={cn("p-6", className)}>
      {title && <h2 className="text-xl font-semibold mb-4">{title}</h2>}
      <MarkdownViewer content={content} {...props} />
    </Card>
  );
}

/**
 * MarkdownViewer component wrapped in a ScrollArea
 */
export function MarkdownScrollArea({ 
  content, 
  className,
  height = "400px",
  ...props 
}: MarkdownViewerProps & { height?: string }) {
  return (
    <ScrollArea className={cn("w-full", className)} style={{ height }}>
      <div className="pr-4">
        <MarkdownViewer content={content} {...props} />
      </div>
    </ScrollArea>
  );
}
