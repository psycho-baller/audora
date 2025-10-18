"use client";
import { useCallback, useRef, useState, useEffect, lazy, Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// Lazy load ForceGraph2D to avoid SSR issues
const ForceGraph2D = lazy(() => import("react-force-graph-2d"));

interface GraphNode {
  id: string;
  name: string;
  email?: string;
  image?: string;
  keywords: string[];
  val?: number; // Size of node
  color?: string;
}

interface GraphLink {
  source: string;
  target: string;
  commonKeywords: string[];
  strength: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export default function ConnectionGraph() {
  const networkData = useQuery(api.userConnections.getUserNetwork);
  const fgRef = useRef<any>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<GraphLink | null>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [highlightNodes, setHighlightNodes] = useState(new Set<string>());
  const [highlightLinks, setHighlightLinks] = useState(new Set<string>());
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [isClient, setIsClient] = useState(false);

  // Set client-side flag
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Update dimensions on mount and resize
  useEffect(() => {
    if (!isClient || typeof window === 'undefined') return;
    const updateDimensions = () => {
      const container = document.getElementById('graph-container');
      if (container) {
        setDimensions({
          width: container.offsetWidth,
          height: Math.max(600, window.innerHeight/3)
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [isClient]);

  // Process network data
  useEffect(() => {
    if (!networkData) {
      console.log("No network data yet");
      return;
    }

    console.log("Network data received:", {
      nodeCount: networkData.nodes.length,
      linkCount: networkData.links.length,
      nodes: networkData.nodes,
      links: networkData.links
    });

    // Color palette for users
    const userColors = [
      "#3b82f6", // Blue
      "#8b5cf6", // Purple
      "#ec4899", // Pink
      "#10b981", // Green
      "#f59e0b", // Amber
      "#ef4444", // Red
      "#06b6d4", // Cyan
      "#a855f7", // Purple-600
    ];

    // Assign colors and sizes to nodes based on type
    let userIndex = 0;
    const processedNodes = networkData.nodes.map((node: any) => {
      if (node.type === "keyword") {
        // Keyword nodes - color based on popularity
        let keywordColor;
        if (node.userCount >= 3) {
          keywordColor = "#fbbf24"; // Gold for very popular (3+ users)
        } else if (node.userCount === 2) {
          keywordColor = "#f59e0b"; // Orange for popular (2 users)
        } else {
          keywordColor = "#fde047"; // Light yellow for single user
        }

        return {
          ...node,
          val: Math.min(6, 3 + node.userCount * 0.5), // Smaller, max size of 6
          color: keywordColor,
        };
      } else {
        // User nodes - each user gets a different color
        const color = userColors[userIndex % userColors.length];
        userIndex++;

        return {
          ...node,
          val: 6, // Smaller fixed size for users
          color: color,
        };
      }
    });

    console.log("Processed nodes:", processedNodes);

    setGraphData({
      nodes: processedNodes,
      links: networkData.links,
    });
  }, [networkData]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    setSelectedLink(null);

    // Highlight connected nodes and links
    const connectedNodeIds = new Set<string>();
    const connectedLinkIds = new Set<string>();

    graphData.links.forEach(link => {
      if (link.source === node.id || link.target === node.id) {
        connectedLinkIds.add(`${link.source}-${link.target}`);
        connectedNodeIds.add(typeof link.source === 'string' ? link.source : (link.source as any).id);
        connectedNodeIds.add(typeof link.target === 'string' ? link.target : (link.target as any).id);
      }
    });

    connectedNodeIds.add(node.id);
    setHighlightNodes(connectedNodeIds);
    setHighlightLinks(connectedLinkIds);
  }, [graphData]);

  const handleLinkClick = useCallback((link: GraphLink) => {
    setSelectedLink(link);
    setSelectedNode(null);
  }, []);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedLink(null);
    setHighlightNodes(new Set());
    setHighlightLinks(new Set());
  }, []);

  // Custom node rendering
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name;
    const fontSize = 12 / globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;

    // Determine if node should be highlighted
    const isHighlighted = highlightNodes.size === 0 || highlightNodes.has(node.id);
    const opacity = isHighlighted ? 1 : 0.3;

    // Draw node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.val || 5, 0, 2 * Math.PI);
    ctx.fillStyle = node.color || "#888";
    ctx.globalAlpha = opacity;
    ctx.fill();

    // Draw border for selected/highlighted nodes
    if (node.id === selectedNode?.id || highlightNodes.has(node.id)) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }

    // Draw label
    ctx.globalAlpha = isHighlighted ? 1 : 0.5;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText(label, node.x, node.y + (node.val || 5) + fontSize + 2);

    ctx.globalAlpha = 1;
  }, [selectedNode, highlightNodes]);

  // Custom link rendering
  const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const linkId = `${link.source.id || link.source}-${link.target.id || link.target}`;
    const isHighlighted = highlightLinks.size === 0 || highlightLinks.has(linkId);

    const start = link.source;
    const end = link.target;

    // Calculate link width based on strength
    const width = Math.max(1, link.strength / 2) / globalScale;

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = isHighlighted ? "#fbbf24" : "#444";
    ctx.globalAlpha = isHighlighted ? 0.8 : 0.2;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Draw label on hover/selection
    if (selectedLink && linkId === `${selectedLink.source}-${selectedLink.target}`) {
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      const fontSize = 10 / globalScale;
      ctx.font = `${fontSize}px Sans-Serif`;
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`${link.strength} common`, midX, midY);
    }
  }, [selectedLink, highlightLinks]);

  // Don't render until client-side
  if (!isClient) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Initializing...</p>
        </div>
      </div>
    );
  }

  if (!networkData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading network...</p>
        </div>
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-900 rounded-lg">
        <div className="text-center text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-lg font-semibold mb-2">No Network Data</p>
          <p className="text-sm">Complete conversations to build your network!</p>
          <p className="text-xs mt-2 text-gray-500">Check browser console for debug info</p>
        </div>
      </div>
    );
  }

  console.log("Rendering graph with:", {
    nodes: graphData.nodes.length,
    links: graphData.links.length
  });

  return (
    <div className="space-y-4">
      {/* Info Panel */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Your Connection Network</h3>
            <p className="text-sm text-gray-400">
              {graphData.nodes.filter((n: any) => n.type === "user").length} people • {graphData.nodes.filter((n: any) => n.type === "keyword").length} shared interests
            </p>
          </div>
          <div className="flex items-center gap-6 text-xs flex-wrap">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                <div className="w-2 h-2 rounded-full bg-pink-500"></div>
              </div>
              <span className="text-gray-400">People</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
              <span className="text-gray-400">Popular</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-300"></div>
              <span className="text-gray-400">Common</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-200"></div>
              <span className="text-gray-400">Unique</span>
            </div>
          </div>
        </div>
      </div>

      {/* Graph Container */}
      <div id="graph-container" className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
        <Suspense fallback={
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Loading graph...</p>
            </div>
          </div>
        }>
          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            nodeLabel="name"
            nodeCanvasObject={paintNode}
            linkCanvasObject={paintLink}
            onNodeClick={handleNodeClick as any}
            onLinkClick={handleLinkClick as any}
            onBackgroundClick={handleBackgroundClick}
            cooldownTicks={100}
            linkDirectionalParticles={2}
            linkDirectionalParticleWidth={(link: any) => highlightLinks.has(`${link.source.id || link.source}-${link.target.id || link.target}`) ? 2 : 0}
            d3VelocityDecay={0.3}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            enablePanInteraction={true}
          />
        </Suspense>
      </div>

      {/* Details Panel */}
      {selectedNode && (
        <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg p-6 border border-blue-700/50">
          <div className="flex items-start gap-4">
            {selectedNode.image && (
              <img
                src={selectedNode.image}
                alt={selectedNode.name}
                className="w-16 h-16 rounded-full border-2 border-blue-500"
              />
            )}
            <div className="flex-1">
              <h4 className="text-xl font-bold text-white mb-1">{selectedNode.name}</h4>
              {selectedNode.email && (
                <p className="text-sm text-gray-400 mb-3">{selectedNode.email}</p>
              )}
              <div className="space-y-2">
                <p className="text-sm text-gray-300">
                  <span className="font-semibold">Interests/Keywords:</span> {selectedNode.keywords.length}
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedNode.keywords.slice(0, 15).map((keyword, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full"
                    >
                      {keyword}
                    </span>
                  ))}
                  {selectedNode.keywords.length > 15 && (
                    <span className="px-2 py-1 bg-gray-700 text-gray-400 text-xs rounded-full">
                      +{selectedNode.keywords.length - 15} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedLink && (
        <div className="bg-gradient-to-r from-yellow-900/50 to-orange-900/50 rounded-lg p-6 border border-yellow-700/50">
          <h4 className="text-xl font-bold text-white mb-3">Connection Details</h4>
          <div className="space-y-3">
            <p className="text-sm text-gray-300">
              <span className="font-semibold">Common Keywords:</span> {selectedLink.commonKeywords.length}
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedLink.commonKeywords.map((keyword, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-yellow-500/20 text-yellow-300 text-sm rounded-full font-medium"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
