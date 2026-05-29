import { useMemo, useRef } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import {
  JobApplicationStatus,
  jobApplicationStatusLabels,
  jobApplicationStatusOrder,
  type JobApplication,
} from "../types";
import { useTheme } from "../context/ThemeContext";
import { Button } from "./ui/button";

interface TrackerStatusSankeyProps {
  applications: JobApplication[];
}

type SankeyNode = {
  status: JobApplicationStatus;
  label: string;
  count: number;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  segmentHeight: number;
};

type SankeyLink = {
  status: JobApplicationStatus;
  count: number;
  color: string;
  sourceY: number;
  targetY: number;
  width: number;
};

const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 420;
const SOURCE_X = 56;
const SOURCE_WIDTH = 180;
const TARGET_X = 930;
const TARGET_WIDTH = 214;
const NODE_GAP = 18;
const TARGET_MIN_HEIGHT = 42;
const LINK_UNIT = 18;

  const statusPalette = [
    {
      status: JobApplicationStatus.Applied,
      label: "Waiting response",
      color: "#8fb7e8",
    },
  {
    status: JobApplicationStatus.Interviewing,
    label: jobApplicationStatusLabels[JobApplicationStatus.Interviewing],
    color: "#f2d27c",
  },
  {
    status: JobApplicationStatus.Rejected,
    label: jobApplicationStatusLabels[JobApplicationStatus.Rejected],
    color: "#e89c9c",
  },
  {
    status: JobApplicationStatus.Offer,
    label: jobApplicationStatusLabels[JobApplicationStatus.Offer],
    color: "#9fd3b4",
  },
] as const;

const buildSvgPath = (sourceX: number, sourceY: number, targetX: number, targetY: number, width: number) => {
  const startX = sourceX + SOURCE_WIDTH;
  const endX = targetX;
  const controlX = startX + (endX - startX) * 0.5;
  const halfWidth = width / 2;

  return [
    `M ${startX} ${sourceY - halfWidth}`,
    `C ${controlX} ${sourceY - halfWidth}, ${controlX} ${targetY - halfWidth}, ${endX} ${targetY - halfWidth}`,
    `L ${endX} ${targetY + halfWidth}`,
    `C ${controlX} ${targetY + halfWidth}, ${controlX} ${sourceY + halfWidth}, ${startX} ${sourceY + halfWidth}`,
    "Z",
  ].join(" ");
};

const downloadSvgAsPng = async (
  svg: SVGSVGElement,
  fileName: string,
  backgroundColor: string,
) => {
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svg);
  const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const image = new Image();
  const scale = window.devicePixelRatio || 2;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to load SVG for PNG export."));
    image.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = VIEW_WIDTH * scale;
  canvas.height = VIEW_HEIGHT * scale;

  const context = canvas.getContext("2d");
  if (!context) {
    URL.revokeObjectURL(url);
    throw new Error("Canvas context unavailable.");
  }

  context.scale(scale, scale);
  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  context.drawImage(image, 0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  URL.revokeObjectURL(url);

  const pngUrl = canvas.toDataURL("image/png");
  const anchor = document.createElement("a");
  anchor.href = pngUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

const TrackerStatusSankey = ({ applications }: TrackerStatusSankeyProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { theme } = useTheme();
  const isDarkTheme = theme === "dark";

  const diagramSurfaceColor = isDarkTheme ? "#1e2326" : "#f1f5f9";
  const diagramTextColor = isDarkTheme ? "#d3c6aa" : "#1e293b";
  const diagramMutedColor = isDarkTheme ? "#859289" : "#64748b";
  const diagramBorderColor = isDarkTheme ? "#dbbc7f" : "#94a3b8";
  const diagramSourceFill = isDarkTheme ? "#2e383c" : "url(#source-gradient)";

  const nodes = useMemo(() => {
    const counts = new Map<JobApplicationStatus, number>(
      jobApplicationStatusOrder.map((status) => [status, 0]),
    );

    applications.forEach((application) => {
      counts.set(application.status, (counts.get(application.status) ?? 0) + 1);
    });

    const totalCount = applications.length;
    const sourceHeight = Math.max(totalCount * LINK_UNIT, TARGET_MIN_HEIGHT * 2);
    const targetHeights = statusPalette.map((entry) =>
      Math.max((counts.get(entry.status) ?? 0) * LINK_UNIT, TARGET_MIN_HEIGHT),
    );
    const targetAreaHeight =
      targetHeights.reduce((sum, height) => sum + height, 0) +
      NODE_GAP * (targetHeights.length - 1);
    const sourceY = (VIEW_HEIGHT - sourceHeight) / 2;
    const targetStartY = (VIEW_HEIGHT - targetAreaHeight) / 2;

    const sourceNode: SankeyNode = {
      status: JobApplicationStatus.Applied,
      label: "All applications",
      count: totalCount,
      color: "#bfd4ea",
      x: SOURCE_X,
      y: sourceY,
      width: SOURCE_WIDTH,
      height: sourceHeight,
      segmentHeight: sourceHeight,
    };

    const targetNodes = statusPalette.map((entry, index) => {
      const count = counts.get(entry.status) ?? 0;
      const height = targetHeights[index];
      const y = targetStartY + targetHeights.slice(0, index).reduce((sum, value) => sum + value, 0) + NODE_GAP * index;

      return {
        status: entry.status,
        label: entry.label,
        count,
        color: entry.color,
        x: TARGET_X,
        y,
        width: TARGET_WIDTH,
        height,
        segmentHeight: Math.max(count * LINK_UNIT, count > 0 ? TARGET_MIN_HEIGHT : 0),
      } satisfies SankeyNode;
    });

    const links: SankeyLink[] = [];
    let sourceOffset = 0;

    targetNodes.forEach((node) => {
      if (node.count === 0) {
        return;
      }

      const segmentHeight = node.count * LINK_UNIT;
      const sourceCenterY = sourceY + sourceOffset + segmentHeight / 2;
      const targetCenterY = node.y + node.height / 2;

      links.push({
        status: node.status,
        count: node.count,
        color: node.color,
        sourceY: sourceCenterY,
        targetY: targetCenterY,
        width: segmentHeight,
      });

      sourceOffset += segmentHeight;
    });

    const sourceGradientStops =
      totalCount > 0
        ? statusPalette
            .map((entry) => ({
              status: entry.status,
              color: entry.color,
              count: counts.get(entry.status) ?? 0,
            }))
            .filter((entry) => entry.count > 0)
            .flatMap((entry, index, array) => {
              const total = array.reduce((sum, current) => sum + current.count, 0);
              const previousCount = array
                .slice(0, index)
                .reduce((sum, current) => sum + current.count, 0);
              const start = `${(previousCount / total) * 100}%`;
              const end = `${((previousCount + entry.count) / total) * 100}%`;

              return [
                { offset: start, color: entry.color },
                { offset: end, color: entry.color },
              ];
            })
        : [];

    return { sourceNode, targetNodes, links, sourceGradientStops };
  }, [applications]);

  const handleDownloadPng = async () => {
    if (!svgRef.current) {
      return;
    }

    try {
      await downloadSvgAsPng(
        svgRef.current,
        "tracker-status-sankey.png",
        diagramSurfaceColor,
      );
      toast.success("Tracker diagram downloaded as PNG.");
    } catch (error) {
      console.error("Export sankey PNG failed:", error);
      toast.error("Could not export the diagram as PNG.");
    }
  };

  if (applications.length === 0) {
    return (
      <div className="deco-frame border-border-gold-muted bg-deco-surface-soft p-5 text-center text-sm text-deco-muted">
        No applications to visualize yet.
      </div>
    );
  }

  return (
    <section className="deco-frame border-border-gold bg-deco-surface-soft p-4 shadow-deco-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-gold">
            Status flow
          </p>
          <h2 className="mt-1 font-heading text-xl text-deco-foreground sm:text-2xl">
            Applications by board status
          </h2>
        </div>
        <Button
          className="h-10 w-full px-4 text-xs uppercase tracking-[0.2em] sm:w-auto"
          onClick={() => void handleDownloadPng()}
          type="button"
          variant="outline"
        >
          <Download className="h-4 w-4" />
          PNG
        </Button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <svg
          ref={svgRef}
          role="img"
          aria-label="Application status Sankey diagram"
          className="mx-auto block w-[86vw] max-w-[760px] sm:w-full sm:max-w-none"
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="source-gradient" x1="0%" x2="100%" y1="0%" y2="0%">
              {nodes.sourceGradientStops.map((stop, index) => (
                <stop
                  key={`${stop.offset}-${index}`}
                  offset={stop.offset}
                  stopColor={stop.color}
                  stopOpacity="0.65"
                />
              ))}
            </linearGradient>
            {nodes.targetNodes.map((node) => (
              <linearGradient
                id={`status-gradient-${node.status}`}
                key={node.status}
                x1="0%"
                x2="100%"
                y1="0%"
                y2="0%"
              >
                <stop offset="0%" stopColor={node.color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={node.color} stopOpacity="0.72" />
              </linearGradient>
            ))}
          </defs>

          <rect
            fill={diagramSurfaceColor}
            height={VIEW_HEIGHT}
            rx="0"
            width={VIEW_WIDTH}
            x="0"
            y="0"
          />

          {nodes.links.map((link) => {
            const target = nodes.targetNodes.find((node) => node.status === link.status);
            if (!target) {
              return null;
            }

            return (
              <path
                d={buildSvgPath(SOURCE_X, link.sourceY, TARGET_X, link.targetY, link.width)}
                fill={`url(#status-gradient-${link.status})`}
                key={link.status}
                opacity="0.9"
              />
            );
          })}

          <rect
            fill={diagramSourceFill}
            height={nodes.sourceNode.height}
            rx="10"
            stroke={diagramBorderColor}
            strokeWidth="2"
            width={nodes.sourceNode.width}
            x={nodes.sourceNode.x}
            y={nodes.sourceNode.y}
          />
          <text
            fill={diagramTextColor}
            fontSize="18"
            fontWeight="700"
            textAnchor="middle"
            x={nodes.sourceNode.x + nodes.sourceNode.width / 2}
            y={nodes.sourceNode.y + nodes.sourceNode.height / 2 - 18}
          >
            <tspan x={nodes.sourceNode.x + nodes.sourceNode.width / 2} dy="0">
              Total
            </tspan>
            <tspan x={nodes.sourceNode.x + nodes.sourceNode.width / 2} dy="20">
              Applications
            </tspan>
            <tspan
              x={nodes.sourceNode.x + nodes.sourceNode.width / 2}
              dy="18"
              fill={diagramMutedColor}
              fontSize="14"
              fontWeight="600"
            >
              ({nodes.sourceNode.count})
            </tspan>
          </text>

          {nodes.targetNodes.map((node) => (
            <g key={node.status}>
              <rect
                fill={`url(#status-gradient-${node.status})`}
                height={node.height}
                rx="10"
                stroke={node.color}
                strokeWidth="2"
                width={node.width}
                x={node.x}
                y={node.y}
              />
              <text
                fill={diagramTextColor}
                fontSize="16"
                fontWeight="700"
                dominantBaseline="middle"
                textAnchor="middle"
                x={node.x + node.width / 2}
                y={node.y + node.height / 2}
              >
                {node.label} ({node.count})
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-[0.12em] text-deco-muted sm:text-xs sm:tracking-[0.12em]">
        {statusPalette.map((status) => (
          <div className="inline-flex items-center gap-2" key={status.status}>
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: status.color }}
            />
            <span>{status.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default TrackerStatusSankey;
