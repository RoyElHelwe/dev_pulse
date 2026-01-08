'use client';

/**
 * Layout Preview Component
 * 
 * Renders a 2D preview of an office layout using SVG.
 * Used in the generator UI before committing to a layout.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Grid3X3,
  Layers,
  Eye,
  EyeOff 
} from 'lucide-react';
import { OfficeLayoutData, ZoneType, RoomType, DeskType } from '@/lib/game/generators/types';

// Simplified layout interface for preview (after transformation)
interface PreviewLayout {
  width: number;
  height: number;
  zones?: Array<{
    id: string;
    name: string;
    type: string;
    bounds: { x: number; y: number; width: number; height: number };
  }>;
  desks?: Array<{
    id: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    type?: string;
  }>;
  rooms?: Array<{
    id: string;
    name: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  decorations?: Array<{
    id: string;
    type: string;
    x: number;
    y: number;
  }>;
  walls?: Array<{
    id: string;
    start: { x: number; y: number };
    end: { x: number; y: number };
    thickness: number;
    hasDoor?: boolean;
    doorPosition?: { x: number; y: number };
  }>;
  spawnPoint?: {
    x: number;
    y: number;
  };
}

/**
 * Transform OfficeLayoutData to PreviewLayout format
 * Handles both old (flat) and new (nested) data structures
 */
function transformToPreviewLayout(layout: OfficeLayoutData | PreviewLayout | any): PreviewLayout {
  // Check if it's already in preview format (has flat width/height)
  if ('width' in layout && typeof layout.width === 'number') {
    // Old format - transform desks/rooms if they have nested position/bounds
    return {
      width: layout.width,
      height: layout.height,
      zones: layout.zones?.map((z: any) => ({
        id: z.id,
        name: z.name,
        type: z.type,
        bounds: z.bounds,
      })),
      desks: layout.desks?.map((d: any) => ({
        id: d.id,
        x: d.position?.x ?? d.x,
        y: d.position?.y ?? d.y,
        width: d.dimensions?.width ?? d.width ?? 64,
        height: d.dimensions?.height ?? d.height ?? 48,
        type: d.type,
      })),
      rooms: layout.rooms?.map((r: any) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        x: r.bounds?.x ?? r.x,
        y: r.bounds?.y ?? r.y,
        width: r.bounds?.width ?? r.width,
        height: r.bounds?.height ?? r.height,
      })),
      decorations: layout.decorations?.map((d: any) => ({
        id: d.id,
        type: d.type,
        x: d.position?.x ?? d.x,
        y: d.position?.y ?? d.y,
      })),
      walls: layout.walls,
      spawnPoint: layout.spawnPoint ?? (layout.spawnPoints?.[0] ? {
        x: layout.spawnPoints[0].position?.x ?? layout.spawnPoints[0].x,
        y: layout.spawnPoints[0].position?.y ?? layout.spawnPoints[0].y,
      } : undefined),
    };
  }
  
  // New format with dimensions object
  if ('dimensions' in layout) {
    return {
      width: layout.dimensions.width,
      height: layout.dimensions.height,
      zones: layout.zones?.map((z: any) => ({
        id: z.id,
        name: z.name,
        type: z.type,
        bounds: z.bounds,
      })),
      desks: layout.desks?.map((d: any) => ({
        id: d.id,
        x: d.position.x,
        y: d.position.y,
        width: d.dimensions?.width ?? 64,
        height: d.dimensions?.height ?? 48,
        type: d.type,
      })),
      rooms: layout.rooms?.map((r: any) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        x: r.bounds.x,
        y: r.bounds.y,
        width: r.bounds.width,
        height: r.bounds.height,
      })),
      decorations: layout.decorations?.map((d: any) => ({
        id: d.id,
        type: d.type,
        x: d.position.x,
        y: d.position.y,
      })),
      walls: layout.walls,
      spawnPoint: layout.spawnPoints?.[0] ? {
        x: layout.spawnPoints[0].position.x,
        y: layout.spawnPoints[0].position.y,
      } : undefined,
    };
  }
  
  // Fallback - return as-is
  return layout as PreviewLayout;
}

interface LayoutPreviewProps {
  layout: PreviewLayout | OfficeLayoutData | any;
  interactive?: boolean;
  onDeskClick?: (deskId: string) => void;
  onRoomClick?: (roomId: string) => void;
}

const ZONE_COLORS: Record<string, { fill: string; stroke: string }> = {
  // Work zones by department
  engineering: { fill: '#e3f2fd', stroke: '#2196f3' },
  product: { fill: '#e0f7fa', stroke: '#00bcd4' },
  design: { fill: '#fce4ec', stroke: '#e91e63' },
  sales: { fill: '#e8f5e9', stroke: '#4caf50' },
  marketing: { fill: '#fff3e0', stroke: '#ff9800' },
  operations: { fill: '#fff8e1', stroke: '#ffc107' },
  leadership: { fill: '#ede7f6', stroke: '#673ab7' },
  hr: { fill: '#fce4ec', stroke: '#e91e63' },
  finance: { fill: '#c8e6c9', stroke: '#4caf50' },
  support: { fill: '#bbdefb', stroke: '#2196f3' },
  // Special zones
  work: { fill: '#e3f2fd', stroke: '#2196f3' },
  meeting: { fill: '#e8f5e9', stroke: '#4caf50' },
  break: { fill: '#fff3e0', stroke: '#ff9800' },
  focus: { fill: '#f3e5f5', stroke: '#9c27b0' },
  social: { fill: '#fffde7', stroke: '#ffc107' },
  collaboration: { fill: '#e0f2f1', stroke: '#009688' },
  creative: { fill: '#fce4ec', stroke: '#e91e63' },
  reception: { fill: '#e0f7fa', stroke: '#00bcd4' },
  executive: { fill: '#ede7f6', stroke: '#673ab7' },
};

const ROOM_COLORS: Record<string, { fill: string; stroke: string }> = {
  meeting: { fill: '#c8e6c9', stroke: '#4caf50' },
  break: { fill: '#ffe0b2', stroke: '#ff9800' },
  phone: { fill: '#bbdefb', stroke: '#2196f3' },
  'phone-booth': { fill: '#bbdefb', stroke: '#2196f3' },
  private: { fill: '#e1bee7', stroke: '#9c27b0' },
  conference: { fill: '#c5cae9', stroke: '#3f51b5' },
  huddle: { fill: '#f8bbd0', stroke: '#e91e63' },
  focus: { fill: '#fff3e0', stroke: '#ff9800' },
};

const DESK_COLORS: Record<string, string> = {
  standard: '#8b4513',
  standing: '#5d4037',
  executive: '#3e2723',
  hot: '#f59e0b',
  hotdesk: '#f59e0b',
  'l-shaped': '#6d4c41',
};

export function LayoutPreview({ 
  layout: rawLayout, 
  interactive = false,
  onDeskClick,
  onRoomClick 
}: LayoutPreviewProps) {
  // Transform layout to preview format (handles both old and new structures)
  const layout = useMemo(() => transformToPreviewLayout(rawLayout), [rawLayout]);
  
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  const [showZones, setShowZones] = useState(true);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Calculate viewBox and scaling
  const padding = 100;
  const width = layout.width || 1200;
  const height = layout.height || 800;
  const viewBox = `${-padding} ${-padding} ${width + padding * 2} ${height + padding * 2}`;
  
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  }, []);
  
  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.25, 0.3));
  }, []);
  
  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  return (
    <Card className="overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Badge variant="outline">{Math.round(zoom * 100)}%</Badge>
          <Button variant="outline" size="icon" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleResetZoom}>
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant={showGrid ? "default" : "outline"} 
            size="sm"
            onClick={() => setShowGrid(!showGrid)}
          >
            <Grid3X3 className="h-4 w-4 mr-1" />
            Grid
          </Button>
          <Button 
            variant={showZones ? "default" : "outline"} 
            size="sm"
            onClick={() => setShowZones(!showZones)}
          >
            <Layers className="h-4 w-4 mr-1" />
            Zones
          </Button>
        </div>
      </div>
      
      {/* Preview Area */}
      <CardContent className="p-0 overflow-hidden bg-slate-100">
        <div 
          className="w-full h-[700px] flex items-center justify-center"
          style={{ 
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <svg 
            viewBox={viewBox}
            className="w-full h-full"
            style={{ 
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}
          >
            {/* Background */}
            <rect 
              x={0} 
              y={0} 
              width={width} 
              height={height}
              fill="#f5f5dc"
              stroke="#333"
              strokeWidth={4}
            />
            
            {/* Grid */}
            {showGrid && (
              <g opacity={0.2}>
                {Array.from({ length: Math.ceil(layout.width / 32) }).map((_, i) => (
                  <line
                    key={`vline-${i}`}
                    x1={i * 32}
                    y1={0}
                    x2={i * 32}
                    y2={layout.height}
                    stroke="#666"
                    strokeWidth={1}
                  />
                ))}
                {Array.from({ length: Math.ceil(layout.height / 32) }).map((_, i) => (
                  <line
                    key={`hline-${i}`}
                    x1={0}
                    y1={i * 32}
                    x2={layout.width}
                    y2={i * 32}
                    stroke="#666"
                    strokeWidth={1}
                  />
                ))}
              </g>
            )}
            
            {/* Zones */}
            {showZones && layout.zones?.map((zone) => {
              const colors = ZONE_COLORS[zone.type] || ZONE_COLORS.engineering;
              return (
                <g key={zone.id}>
                  <rect
                    x={zone.bounds.x}
                    y={zone.bounds.y}
                    width={zone.bounds.width}
                    height={zone.bounds.height}
                    fill={colors.fill}
                    fillOpacity={0.5}
                    stroke={colors.stroke}
                    strokeWidth={2}
                    strokeDasharray="8,4"
                  />
                  <text
                    x={zone.bounds.x + 10}
                    y={zone.bounds.y + 20}
                    fill="#666"
                    fontSize={14}
                    fontWeight="bold"
                  >
                    {zone.name}
                  </text>
                </g>
              );
            })}
            
            {/* Rooms */}
            {layout.rooms?.map((room) => {
              const colors = ROOM_COLORS[room.type] || ROOM_COLORS.meeting;
              const isHovered = hoveredElement === `room-${room.id}`;
              
              return (
                <g 
                  key={room.id}
                  className={interactive ? 'cursor-pointer' : ''}
                  onMouseEnter={() => setHoveredElement(`room-${room.id}`)}
                  onMouseLeave={() => setHoveredElement(null)}
                  onClick={() => onRoomClick?.(room.id)}
                >
                  <rect
                    x={room.x}
                    y={room.y}
                    width={room.width}
                    height={room.height}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth={isHovered ? 4 : 3}
                    rx={4}
                  />
                  <text
                    x={room.x + room.width / 2}
                    y={room.y + 18}
                    fill="#333"
                    fontSize={12}
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {room.name}
                  </text>
                  
                  {/* Room furniture (simplified) */}
                  {(room.type === 'meeting' || room.type === 'conference') && (
                    <rect
                      x={room.x + room.width * 0.2}
                      y={room.y + room.height * 0.35}
                      width={room.width * 0.6}
                      height={room.height * 0.35}
                      fill="#8b4513"
                      rx={4}
                    />
                  )}
                </g>
              );
            })}
            
            {/* Desks */}
            {layout.desks?.map((desk) => {
              const color = DESK_COLORS[desk.type || 'standard'];
              const isHovered = hoveredElement === `desk-${desk.id}`;
              const width = desk.width || 70;
              const height = desk.height || 45;
              
              return (
                <g 
                  key={desk.id}
                  className={interactive ? 'cursor-pointer' : ''}
                  onMouseEnter={() => setHoveredElement(`desk-${desk.id}`)}
                  onMouseLeave={() => setHoveredElement(null)}
                  onClick={() => onDeskClick?.(desk.id)}
                >
                  {/* Desk */}
                  <rect
                    x={desk.x}
                    y={desk.y}
                    width={width}
                    height={height}
                    fill={color}
                    stroke={isHovered ? '#000' : '#5d4037'}
                    strokeWidth={isHovered ? 3 : 2}
                    rx={3}
                  />
                  
                  {/* Desk top */}
                  <rect
                    x={desk.x + 3}
                    y={desk.y + 3}
                    width={width - 6}
                    height={height - 6}
                    fill="#d2b48c"
                    rx={2}
                  />
                  
                  {/* Monitor */}
                  <rect
                    x={desk.x + width / 2 - 10}
                    y={desk.y + 8}
                    width={20}
                    height={14}
                    fill="#333"
                    rx={2}
                  />
                  
                  {/* Chair */}
                  <circle
                    cx={desk.x + width / 2}
                    cy={desk.y + height + 12}
                    r={10}
                    fill="#2563eb"
                    stroke="#1e40af"
                    strokeWidth={2}
                  />
                  
                  {/* Hot desk indicator */}
                  {desk.type === 'hot' && (
                    <circle
                      cx={desk.x + width - 8}
                      cy={desk.y + 8}
                      r={6}
                      fill="#fbbf24"
                      stroke="#f59e0b"
                      strokeWidth={1}
                    />
                  )}
                </g>
              );
            })}
            
            {/* Decorations */}
            {layout.decorations?.map((deco, i) => (
              <g key={`deco-${i}`}>
                {deco.type === 'plant' && (
                  <>
                    {/* Pot */}
                    <rect
                      x={deco.x - 10}
                      y={deco.y + 5}
                      width={20}
                      height={15}
                      fill="#d2691e"
                      rx={2}
                    />
                    {/* Leaves */}
                    <circle cx={deco.x} cy={deco.y - 5} r={12} fill="#228b22" />
                    <circle cx={deco.x - 8} cy={deco.y} r={8} fill="#2d8f2d" />
                    <circle cx={deco.x + 8} cy={deco.y} r={8} fill="#2d8f2d" />
                  </>
                )}
                
                {deco.type === 'whiteboard' && (
                  <rect
                    x={deco.x}
                    y={deco.y}
                    width={80}
                    height={55}
                    fill="#fff"
                    stroke="#9e9e9e"
                    strokeWidth={3}
                    rx={2}
                  />
                )}
                
                {deco.type === 'coffeeMachine' && (
                  <rect
                    x={deco.x}
                    y={deco.y}
                    width={30}
                    height={40}
                    fill="#5d4037"
                    rx={3}
                  />
                )}
                
                {deco.type === 'couch' && (
                  <rect
                    x={deco.x}
                    y={deco.y}
                    width={70}
                    height={35}
                    fill="#6b5b95"
                    rx={6}
                  />
                )}
              </g>
            ))}
            
            {/* Spawn Point */}
            {layout.spawnPoint && (
              <g>
                <circle
                  cx={layout.spawnPoint.x}
                  cy={layout.spawnPoint.y}
                  r={15}
                  fill="#4caf50"
                  fillOpacity={0.3}
                  stroke="#4caf50"
                  strokeWidth={2}
                />
                <circle
                  cx={layout.spawnPoint.x}
                  cy={layout.spawnPoint.y}
                  r={6}
                  fill="#4caf50"
                />
                <text
                  x={layout.spawnPoint.x}
                  y={layout.spawnPoint.y + 30}
                fill="#4caf50"
                fontSize={10}
                textAnchor="middle"
                fontWeight="bold"
              >
                Spawn
              </text>
              </g>
            )}
            
            {/* Walls */}
            {layout.walls?.map((wall) => {
              // Calculate wall rectangle from start/end points
              const isHorizontal = Math.abs(wall.end.y - wall.start.y) < Math.abs(wall.end.x - wall.start.x);
              const minX = Math.min(wall.start.x, wall.end.x);
              const minY = Math.min(wall.start.y, wall.end.y);
              const wallWidth = isHorizontal 
                ? Math.abs(wall.end.x - wall.start.x) || wall.thickness
                : wall.thickness;
              const wallHeight = isHorizontal 
                ? wall.thickness
                : Math.abs(wall.end.y - wall.start.y) || wall.thickness;
              
              return (
                <g key={wall.id}>
                  {/* Main wall */}
                  <rect
                    x={minX}
                    y={minY}
                    width={wallWidth}
                    height={wallHeight}
                    fill="#4a5568"
                    stroke="#2d3748"
                    strokeWidth={1}
                  />
                  {/* Wall highlight (3D effect) */}
                  <rect
                    x={minX}
                    y={minY}
                    width={isHorizontal ? wallWidth : 4}
                    height={isHorizontal ? 4 : wallHeight}
                    fill="#718096"
                  />
                  {/* Door gap indicator */}
                  {wall.hasDoor && wall.doorPosition && (
                    <rect
                      x={wall.doorPosition.x - 48}
                      y={wall.doorPosition.y - 48}
                      width={96}
                      height={96}
                      fill="#f5f5dc"
                      stroke="#4a5568"
                      strokeWidth={2}
                      strokeDasharray="4,4"
                    />
                  )}
                </g>
              );
            })}
            
            {/* Walls border (fallback if no walls defined) */}
            {(!layout.walls || layout.walls.length === 0) && (
              <rect
                x={0}
                y={0}
                width={layout.width}
                height={layout.height}
                fill="none"
                stroke="#4a5568"
                strokeWidth={16}
              />
            )}
          </svg>
        </div>
      </CardContent>
      
      {/* Legend */}
      <div className="p-3 border-t bg-muted/30">
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-[#4a5568]" />
            <span>Wall</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-[#8b4513]" />
            <span>Standard Desk</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-[#f59e0b]" />
            <span>Hot Desk</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-[#c8e6c9] border border-[#4caf50]" />
            <span>Meeting Room</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-[#ffe0b2] border border-[#ff9800]" />
            <span>Break Room</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#228b22]" />
            <span>Plant</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#4caf50]" />
            <span>Spawn Point</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
