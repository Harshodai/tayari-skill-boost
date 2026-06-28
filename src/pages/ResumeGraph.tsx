import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "@/api";
import { ResumeGraphViz, GraphData } from "@/components/ResumeGraphViz";

const ResumeGraph = () => {
  const { toast } = useToast();

  const handleDownload = async () => {
    if (!runId) return;
    try {
      const response = await fetch(`/v1/resume-graph/${runId}/export`);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resume-graph-${runId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!runId) return;
    try {
      const response = await fetch(`/v1/resume-graph/${runId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');
      setData(null);
      toast({ title: 'Graph deleted', description: 'Resume graph has been removed.', variant: 'success' });
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  };
  const [searchParams] = useSearchParams();
  const runId = searchParams.get("runId");

  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const graphRef = useRef<any>(null);

  const handleExportPNG = async () => {
    if (!runId || !graphRef.current?.exportAsPNG) return;
    try {
      const blob = await graphRef.current.exportAsPNG();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resume-graph-${runId}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const handleExportGraphML = () => {
    if (!runId || !data) return;
    const nodesXml = data.nodes.map((n) => `<node id="${n.id}"/>`).join('');
    const edgesXml = data.links.map((l) => `<edge source="${l.source}" target="${l.target}"/>`).join('');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<graphml><graph id="G">${nodesXml}${edgesXml}</graph></graphml>`;
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resume-graph-${runId}.graphml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!runId) {
      setError("runId query parameter is required");
      return;
    }
    setLoading(true);
    apiFetch(`/v1/resume-graph/${runId}`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [runId]);

  return (
    <section className="p-4">
      <h1 className="text-2xl font-bold mb-4">Resume Graph</h1>
          {data && (
            <div className="flex gap-2 mb-4">
              <Button
                variant="secondary"
                size="sm"
                aria-label="Download resume graph JSON"
                onClick={handleDownload}
              >
                Download JSON
              </Button>
              <Button
                variant="destructive"
                size="sm"
                aria-label="Delete resume graph"
                onClick={handleDelete}
              >
                Delete Graph
              </Button>
            <Button
                variant="secondary"
                size="sm"
                aria-label="Export graph as PNG"
                onClick={handleExportPNG}
              >
                Export PNG
              </Button>
              <Button
                variant="secondary"
                size="sm"
                aria-label="Export graph as GraphML"
                onClick={handleExportGraphML}
              >
                Export GraphML
              </Button>
            </div>
          )}
      {loading && (
        <div role="status" className="flex justify-center my-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" aria-label="Loading"></div>
        </div>
      )}
      {error && (
        <div role="alert" className="text-destructive mb-4">
          {error}
        </div>
      )}
      {data && <ResumeGraphViz ref={graphRef} graph={data} />}
    </section>
  );
};

export default ResumeGraph;
