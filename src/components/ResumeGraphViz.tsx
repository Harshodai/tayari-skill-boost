import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { forceSimulation, forceLink, forceManyBody, forceCenter } from "d3-force";
import { toBlob } from "html-to-image";

export interface GraphNode {
  id: string;
  label: string;
  x?: number;
  y?: number;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

function getBoundedPosition(idx: number, total: number, width: number = 600, height: number = 400) {
  const cols = Math.ceil(Math.sqrt(total)) || 1;
  const rows = Math.ceil(total / cols) || 1;
  const col = idx % cols;
  const row = Math.floor(idx / cols);
  const marginX = 80;
  const marginY = 60;
  const stepX = cols > 1 ? (width - 2 * marginX) / (cols - 1) : 0;
  const stepY = rows > 1 ? (height - 2 * marginY) / (rows - 1) : 0;
  const x = cols > 1 ? marginX + col * stepX : width / 2;
  const y = rows > 1 ? marginY + row * stepY : height / 2;
  return { x: Math.round(x), y: Math.round(y) };
}

export const ResumeGraphViz = forwardRef<{ exportAsPNG: () => Promise<Blob> }, { graph: GraphData }>(function ResumeGraphViz({ graph }, ref) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);

  // Fixed viewport size – the SVG scales to fit the container.
  const width = 600;
  const height = 400;

  useEffect(() => {
    // Clone nodes and assign deterministic bounded fallback positions up front
    const simNodes = graph.nodes.map((n, idx) => {
      const pos = getBoundedPosition(idx, graph.nodes.length, width, height);
      return {
        ...n,
        x: Number.isFinite(n.x) ? n.x! : pos.x,
        y: Number.isFinite(n.y) ? n.y! : pos.y,
      };
    });

    // Clone link objects so D3 forceLink does not mutate graph.links props
    const simLinks = graph.links.map((l) => ({
      source: typeof l.source === 'object' ? (l.source as any).id : l.source,
      target: typeof l.target === 'object' ? (l.target as any).id : l.target,
    }));

    try {
      const simulation = forceSimulation(simNodes);
      if (simulation && typeof simulation.force === "function") {
        simulation.force("link", forceLink(simLinks).id((d: any) => d.id).distance(100) as any);
        simulation.force("charge", forceManyBody().strength(-200) as any);
        simulation.force("center", forceCenter(width / 2, height / 2) as any);
        if (typeof simulation.stop === "function") simulation.stop();
        if (typeof simulation.tick === "function") {
          for (let i = 0; i < 300; ++i) simulation.tick();
        }
      }
    } catch {
      // In headless / HappyDOM environments, retain bounded positions
    }

    // Ensure all node coordinates remain bounded within the 600x400 viewBox
    simNodes.forEach((n, idx) => {
      if (!Number.isFinite(n.x) || n.x! < 20 || n.x! > width - 20) {
        n.x = getBoundedPosition(idx, simNodes.length, width, height).x;
      }
      if (!Number.isFinite(n.y) || n.y! < 20 || n.y! > height - 20) {
        n.y = getBoundedPosition(idx, simNodes.length, width, height).y;
      }
    });

    setNodes(simNodes);
  }, [graph]);

  const findNode = (id: string) => nodes.find((n) => n.id === id);

  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    exportAsPNG: async () => {
      if (!containerRef.current) {
        throw new Error('Export container not found');
      }
      const blob = await toBlob(containerRef.current);
      return blob;
    },
  }));

  return (
    <div ref={containerRef} role="img" aria-label="Resume knowledge graph" className="overflow-auto">
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="bg-muted"
      >
        {/* Links */}
        {graph.links.map((link, i) => {
          const source = findNode(link.source);
          const target = findNode(link.target);
          if (!source || !target) return null;
          return (
            <line
              key={`link-${i}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="var(--color-accent)"
              strokeWidth={1}
            />
          );
        })}
        {/* Nodes */}
        {nodes.map((node) => (
          <g key={node.id}>
            <circle cx={node.x} cy={node.y} r={10} fill="var(--color-accent)" />
            <text
              x={node.x}
              y={(node.y ?? 0) - 12}
              textAnchor="middle"
              fontSize={12}
              fill="currentColor"
            >
              {node.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
});
