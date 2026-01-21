import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface LaTeXSourceViewProps {
  latexSource: string;
  isLoading?: boolean;
  filename?: string;
}

export const LaTeXSourceView = ({ 
  latexSource, 
  isLoading,
  filename = "resume" 
}: LaTeXSourceViewProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(latexSource);
      setCopied(true);
      toast.success("LaTeX source copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([latexSource], { type: "text/x-latex" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.tex`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("LaTeX source downloaded");
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-muted rounded-lg">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Generating LaTeX source...</p>
      </div>
    );
  }

  if (!latexSource) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-muted rounded-lg">
        <p className="text-muted-foreground">No LaTeX source available</p>
        <p className="text-sm text-muted-foreground mt-1">
          Click "Generate Preview" to create the LaTeX source
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-2 text-success" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              Copy Source
            </>
          )}
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="w-4 h-4 mr-2" />
          Download .tex
        </Button>
      </div>

      {/* Code View */}
      <div className="relative">
        <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto max-h-[60vh] overflow-y-auto text-sm font-mono">
          <code>
            {latexSource.split('\n').map((line, idx) => (
              <div key={idx} className="flex">
                <span className="text-slate-500 select-none pr-4 text-right w-12">
                  {idx + 1}
                </span>
                <span className="flex-1">
                  {highlightLatex(line)}
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
};

// Simple LaTeX syntax highlighting
function highlightLatex(line: string): React.ReactNode {
  // Highlight commands
  const parts: React.ReactNode[] = [];
  const remaining = line;
  let key = 0;

  // Match LaTeX commands
  const commandRegex = /(\\[a-zA-Z]+\*?)(\{[^}]*\})?/g;
  let match;
  let lastIndex = 0;

  while ((match = commandRegex.exec(remaining)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(
        <span key={key++} className="text-slate-100">
          {remaining.slice(lastIndex, match.index)}
        </span>
      );
    }

    // Add the command
    parts.push(
      <span key={key++} className="text-emerald-400">
        {match[1]}
      </span>
    );

    // Add the argument if present
    if (match[2]) {
      parts.push(
        <span key={key++} className="text-amber-300">
          {match[2]}
        </span>
      );
    }

    lastIndex = commandRegex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < remaining.length) {
    parts.push(
      <span key={key++} className="text-slate-100">
        {remaining.slice(lastIndex)}
      </span>
    );
  }

  // Highlight comments
  const commentIndex = line.indexOf('%');
  if (commentIndex !== -1 && (commentIndex === 0 || line[commentIndex - 1] !== '\\')) {
    return (
      <>
        {highlightLatex(line.slice(0, commentIndex))}
        <span className="text-slate-500">{line.slice(commentIndex)}</span>
      </>
    );
  }

  return parts.length > 0 ? parts : line;
}

export default LaTeXSourceView;