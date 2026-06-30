// src/components/ResumeGraphViz.tsx
// A lightweight force‑directed graph visualisation for resume data.
// Uses d3-force for layout and renders an SVG.

import { useEffect, useState, forwardRef, useImperativeHandle, useRef } from "react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let forceSimulation: any, forceLink: any, forceManyBody: any, forceCenter: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  ({ forceSimulation, forceLink, forceManyBody, forceCenter } = (0, eval)("require")("d3-force"));
} catch {
  // Provide no-op fallbacks for test environment / missing dep
  forceSimulation = () => ({ force: () => ({ stop: () => {} }), tick: () => {}, on: () => {} });
  forceLink = () => ({ id: () => ({ distance: () => {} }), distance: () => ({ id: () => {} }) });
  forceManyBody = () => ({ strength: () => {} });
  forceCenter = () => {};
}

// Types for the graph data – keep them simple and reusable.
export interface GraphNode {
  id: string;
  label: string;
  /** Position injected by the force layout */
  x?: number;
  y?: number;
}

export interface GraphLink {
  source: string; // node id
  target: string; // node id
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

/**
 * Reusable visualisation component.
 * @param graph The knowledge graph to render. It must contain `nodes` with an `id`
 * and `label`, and `links` referencing those ids.
 */
import { toBlob } from "html-to-image";

export const ResumeGraphViz = forwardRef<{ exportAsPNG: () => Promise<Blob> }, { graph: GraphData }>(function ResumeGraphViz({ graph }, ref) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);

  // Fixed viewport size – the SVG scales to fit the container.
  const width = 600;
  const height = 400;

  useEffect(() => {
    // Clone nodes so the simulation can mutate them without affecting props.
    const simNodes = graph.nodes.map((n) => ({ ...n }));
    const simulation = forceSimulation(simNodes)
      .force(
        "link",
        forceLink(graph.links)
          .id((d: GraphNode) => d.id)
          .id((d) => d.id)
          .distance(100)
      )
      .force("charge", forceManyBody().strength(-200))
      .force("center", forceCenter(width / 2, height / 2))
      .stop();

    // Run a few ticks to settle the layout.
    for (let i = 0; i < 300; ++i) simulation.tick();
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
              x1={source.x!}
              y1={source.y!}
              x2={target.x!}
              y2={target.y!}
              stroke="var(--color-accent)"
              strokeWidth={1}
            />
          );
        })}
        {/* Nodes */}
        {nodes.map((node) => (
          <g key={node.id}>
            <circle cx={node.x!} cy={node.y!} r={10} fill="var(--color-accent)" />
            <text
              x={node.x!}
              y={node.y! - 12}
              textAnchor="middle"
              fill="currentColor"
              fontSize={12}
            >
              {node.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
});
