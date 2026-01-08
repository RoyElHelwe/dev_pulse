'use client';

/**
 * Layout Preview Component
 * 
 * Renders a 2D preview of an office layout using clean SVG graphics.
 * Used in the generator UI before committing to a layout.
 * 
 * Uses shared theme from @/lib/game/assets/office-theme for consistent
 * styling with the Phaser game on /office page.
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
import { 
  OFFICE_COLORS, 
  OFFICE_DIMENSIONS,
  SVG_PATHS,
  getZoneColor,
  getRoomColor 
} from '@/lib/game/assets/office-theme';

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

// Use shared theme colors - these aliases provide backward compatibility
const ZONE_COLORS = OFFICE_COLORS.zones;
const ROOM_COLORS = OFFICE_COLORS.rooms;
const DESK_COLORS: Record<string, string> = {
  standard: OFFICE_COLORS.desk.body,
  standing: '#5d4037',
  executive: '#3e2723',
  hot: OFFICE_COLORS.hotDesk.fill,
  hotdesk: OFFICE_COLORS.hotDesk.fill,
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
            {/* Define patterns */}
            <defs>
              {/* Wood floor pattern - using shared theme colors */}
              <pattern id="woodFloor" x="0" y="0" width="40" height="20" patternUnits="userSpaceOnUse">
                <rect width="40" height="20" fill={OFFICE_COLORS.floor.wood.primary} />
                <rect x="0" y="0" width="20" height="10" fill={OFFICE_COLORS.floor.wood.secondary} />
                <rect x="20" y="10" width="20" height="10" fill={OFFICE_COLORS.floor.wood.secondary} />
                <line x1="0" y1="10" x2="40" y2="10" stroke={OFFICE_COLORS.floor.wood.line} strokeWidth="0.5" />
                <line x1="20" y1="0" x2="20" y2="10" stroke={OFFICE_COLORS.floor.wood.line} strokeWidth="0.5" />
                <line x1="0" y1="10" x2="0" y2="20" stroke={OFFICE_COLORS.floor.wood.line} strokeWidth="0.5" />
              </pattern>
              {/* Carpet pattern - using shared theme colors */}
              <pattern id="carpetPattern" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
                <rect width="8" height="8" fill={OFFICE_COLORS.floor.carpet.primary} />
                <rect x="0" y="0" width="4" height="4" fill={OFFICE_COLORS.floor.carpet.secondary} />
                <rect x="4" y="4" width="4" height="4" fill={OFFICE_COLORS.floor.carpet.secondary} />
              </pattern>
            </defs>
            
            {/* Background floor */}
            <rect 
              x={0} 
              y={0} 
              width={width} 
              height={height}
              fill="url(#woodFloor)"
              stroke={OFFICE_COLORS.wall.primary}
              strokeWidth={6}
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
              const colors = getZoneColor(zone.type);
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
              const colors = getRoomColor(room.type);
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
                  
                  {/* Room furniture - Conference table for meeting rooms */}
                  {(room.type === 'meeting' || room.type === 'conference') && (
                    <>
                      <rect
                        x={room.x + room.width * 0.15}
                        y={room.y + room.height * 0.35}
                        width={room.width * 0.7}
                        height={room.height * 0.35}
                        fill={OFFICE_COLORS.desk.body}
                        stroke={OFFICE_COLORS.desk.border}
                        strokeWidth={2}
                        rx={4}
                      />
                      {/* Chairs around table */}
                      {[0.25, 0.5, 0.75].map((pos) => (
                        <React.Fragment key={`chair-top-${pos}`}>
                          <ellipse
                            cx={room.x + room.width * pos}
                            cy={room.y + room.height * 0.28}
                            rx={8}
                            ry={6}
                            fill={OFFICE_COLORS.chair.seat}
                          />
                          <ellipse
                            cx={room.x + room.width * pos}
                            cy={room.y + room.height * 0.78}
                            rx={8}
                            ry={6}
                            fill={OFFICE_COLORS.chair.seat}
                          />
                        </React.Fragment>
                      ))}
                    </>
                  )}
                  
                  {/* Break room furniture */}
                  {room.type === 'break' && (
                    <>
                      {/* Round table */}
                      <circle
                        cx={room.x + room.width * 0.5}
                        cy={room.y + room.height * 0.5}
                        r={Math.min(room.width, room.height) * 0.2}
                        fill={OFFICE_COLORS.desk.surface}
                        stroke={OFFICE_COLORS.desk.body}
                        strokeWidth={2}
                      />
                      {/* Coffee machine icon */}
                      <rect
                        x={room.x + room.width * 0.8}
                        y={room.y + room.height * 0.3}
                        width={room.width * 0.12}
                        height={room.height * 0.25}
                        fill={OFFICE_COLORS.coffeeMachine.body}
                        rx={2}
                      />
                    </>
                  )}
                  
                  {/* Phone booth / huddle */}
                  {(room.type === 'phone' || room.type === 'phone-booth' || room.type === 'huddle') && (
                    <>
                      <rect
                        x={room.x + room.width * 0.3}
                        y={room.y + room.height * 0.4}
                        width={room.width * 0.4}
                        height={room.height * 0.3}
                        fill={OFFICE_COLORS.desk.surface}
                        stroke={OFFICE_COLORS.desk.body}
                        strokeWidth={1}
                        rx={2}
                      />
                      <ellipse
                        cx={room.x + room.width * 0.5}
                        cy={room.y + room.height * 0.75}
                        rx={10}
                        ry={8}
                        fill={OFFICE_COLORS.chair.seat}
                      />
                    </>
                  )}
                </g>
              );
            })}
            
            {/* Desks */}
            {layout.desks?.map((desk) => {
              const color = DESK_COLORS[desk.type || 'standard'] || DESK_COLORS.standard;
              const isHovered = hoveredElement === `desk-${desk.id}`;
              const width = desk.width || 60;
              const height = desk.height || 40;
              
              return (
                <g 
                  key={desk.id}
                  className={interactive ? 'cursor-pointer' : ''}
                  onMouseEnter={() => setHoveredElement(`desk-${desk.id}`)}
                  onMouseLeave={() => setHoveredElement(null)}
                  onClick={() => onDeskClick?.(desk.id)}
                  style={{ filter: isHovered ? 'brightness(1.1)' : 'none' }}
                >
                  {/* Desk body */}
                  <rect
                    x={desk.x}
                    y={desk.y}
                    width={width}
                    height={height}
                    fill={color}
                    stroke={isHovered ? '#000' : OFFICE_COLORS.desk.border}
                    strokeWidth={isHovered ? 2 : 1}
                    rx={3}
                  />
                  {/* Desk surface */}
                  <rect
                    x={desk.x + 2}
                    y={desk.y + 2}
                    width={width - 4}
                    height={height - 4}
                    fill={OFFICE_COLORS.desk.surface}
                    rx={2}
                  />
                  {/* Monitor */}
                  <rect
                    x={desk.x + width / 2 - 8}
                    y={desk.y + 6}
                    width={16}
                    height={10}
                    fill={OFFICE_COLORS.monitor.frame}
                    rx={1}
                  />
                  {/* Monitor stand */}
                  <rect
                    x={desk.x + width / 2 - 3}
                    y={desk.y + 16}
                    width={6}
                    height={4}
                    fill={OFFICE_COLORS.monitor.stand}
                  />
                  {/* Keyboard */}
                  <rect
                    x={desk.x + width / 2 - 10}
                    y={desk.y + height - 12}
                    width={20}
                    height={6}
                    fill={OFFICE_COLORS.keyboard}
                    rx={1}
                  />
                  {/* Chair */}
                  <ellipse
                    cx={desk.x + width / 2}
                    cy={desk.y + height + 16}
                    rx={12}
                    ry={10}
                    fill={OFFICE_COLORS.chair.seat}
                    stroke={OFFICE_COLORS.chair.border}
                    strokeWidth={1}
                  />
                  {/* Chair back */}
                  <rect
                    x={desk.x + width / 2 - 10}
                    y={desk.y + height + 20}
                    width={20}
                    height={8}
                    fill={OFFICE_COLORS.chair.back}
                    stroke={OFFICE_COLORS.chair.border}
                    strokeWidth={1}
                    rx={3}
                  />
                  
                  {/* Hot desk indicator */}
                  {(desk.type === 'hot' || desk.type === 'hotdesk') && (
                    <>
                      <circle
                        cx={desk.x + width - 6}
                        cy={desk.y + 6}
                        r={6}
                        fill={OFFICE_COLORS.hotDesk.fill}
                        stroke={OFFICE_COLORS.hotDesk.stroke}
                        strokeWidth={1}
                      />
                      <text
                        x={desk.x + width - 6}
                        y={desk.y + 9}
                        fill="#000"
                        fontSize={8}
                        textAnchor="middle"
                        fontWeight="bold"
                      >
                        H
                      </text>
                    </>
                  )}
                </g>
              );
            })}
            
            {/* Decorations */}
            {layout.decorations?.map((deco, i) => {
              const decoType = deco.type || 'plant';
              
              return (
                <g key={`deco-${deco.id || i}`}>
                  {/* Plant */}
                  {(decoType === 'plant' || decoType === 'plantSmall' || decoType === 'plantMedium' || decoType === 'plantLarge') && (
                    <>
                      {/* Pot */}
                      <path
                        d={`M${deco.x - 10} ${deco.y + 5} L${deco.x - 8} ${deco.y + 18} L${deco.x + 8} ${deco.y + 18} L${deco.x + 10} ${deco.y + 5} Z`}
                        fill={OFFICE_COLORS.plant.pot}
                        stroke={OFFICE_COLORS.plant.potBorder}
                        strokeWidth={1}
                      />
                      {/* Leaves */}
                      <ellipse cx={deco.x} cy={deco.y - 8} rx={14} ry={12} fill={OFFICE_COLORS.plant.leaf1} />
                      <ellipse cx={deco.x - 8} cy={deco.y - 2} rx={8} ry={7} fill={OFFICE_COLORS.plant.leaf2} />
                      <ellipse cx={deco.x + 8} cy={deco.y - 2} rx={8} ry={7} fill={OFFICE_COLORS.plant.leaf2} />
                      <ellipse cx={deco.x} cy={deco.y - 14} rx={6} ry={5} fill={OFFICE_COLORS.plant.leaf3} />
                    </>
                  )}
                  
                  {/* Whiteboard */}
                  {decoType === 'whiteboard' && (
                    <>
                      <rect
                        x={deco.x - 35}
                        y={deco.y - 20}
                        width={70}
                        height={45}
                        fill="#fff"
                        stroke={OFFICE_COLORS.whiteboard.frame}
                        strokeWidth={3}
                        rx={2}
                      />
                      <rect
                        x={deco.x - 30}
                        y={deco.y - 15}
                        width={60}
                        height={35}
                        fill={OFFICE_COLORS.whiteboard.surface}
                      />
                      {/* Marker tray */}
                      <rect
                        x={deco.x - 25}
                        y={deco.y + 20}
                        width={50}
                        height={4}
                        fill={OFFICE_COLORS.whiteboard.tray}
                      />
                    </>
                  )}
                  
                  {/* Coffee Machine */}
                  {decoType === 'coffeeMachine' && (
                    <>
                      <rect
                        x={deco.x - 12}
                        y={deco.y - 20}
                        width={24}
                        height={40}
                        fill={OFFICE_COLORS.coffeeMachine.body}
                        stroke="#333"
                        strokeWidth={1}
                        rx={3}
                      />
                      <rect
                        x={deco.x - 8}
                        y={deco.y - 15}
                        width={16}
                        height={10}
                        fill={OFFICE_COLORS.coffeeMachine.panel}
                        rx={2}
                      />
                      <circle cx={deco.x} cy={deco.y + 5} r={5} fill={OFFICE_COLORS.coffeeMachine.indicator} />
                    </>
                  )}
                  
                  {/* Couch */}
                  {decoType === 'couch' && (
                    <>
                      <rect
                        x={deco.x - 35}
                        y={deco.y - 12}
                        width={70}
                        height={30}
                        fill={OFFICE_COLORS.couch.body}
                        stroke={OFFICE_COLORS.couch.border}
                        strokeWidth={1}
                        rx={6}
                      />
                      <rect
                        x={deco.x - 30}
                        y={deco.y - 8}
                        width={60}
                        height={18}
                        fill={OFFICE_COLORS.couch.cushion}
                        rx={4}
                      />
                      {/* Arm rests */}
                      <rect
                        x={deco.x - 38}
                        y={deco.y - 10}
                        width={8}
                        height={24}
                        fill={OFFICE_COLORS.couch.body}
                        rx={3}
                      />
                      <rect
                        x={deco.x + 30}
                        y={deco.y - 10}
                        width={8}
                        height={24}
                        fill={OFFICE_COLORS.couch.body}
                        rx={3}
                      />
                    </>
                  )}
                  
                  {/* Bean Bag */}
                  {decoType === 'beanBag' && (
                    <>
                      <ellipse
                        cx={deco.x}
                        cy={deco.y}
                        rx={28}
                        ry={24}
                        fill={OFFICE_COLORS.couch.cushion}
                        stroke={OFFICE_COLORS.couch.border}
                        strokeWidth={2}
                      />
                      <ellipse
                        cx={deco.x}
                        cy={deco.y - 8}
                        rx={20}
                        ry={16}
                        fill={OFFICE_COLORS.couch.body}
                        opacity={0.6}
                      />
                    </>
                  )}
                  
                  {/* Water Cooler */}
                  {decoType === 'waterCooler' && (
                    <>
                      <rect
                        x={deco.x - 12}
                        y={deco.y - 16}
                        width={24}
                        height={32}
                        fill="#4fc3f7"
                        stroke="#0288d1"
                        strokeWidth={2}
                        rx={4}
                      />
                      <rect
                        x={deco.x - 8}
                        y={deco.y - 12}
                        width={16}
                        height={20}
                        fill="#81d4fa"
                        opacity={0.5}
                        rx={2}
                      />
                      <circle cx={deco.x} cy={deco.y + 12} r={3} fill="#0288d1" />
                    </>
                  )}
                </g>
              );
            })}
            
            {/* Spawn Point */}
            {layout.spawnPoint && (
              <g>
                <circle
                  cx={layout.spawnPoint.x}
                  cy={layout.spawnPoint.y}
                  r={15}
                  fill={OFFICE_COLORS.spawn.fill}
                  fillOpacity={OFFICE_COLORS.spawn.fillOpacity}
                  stroke={OFFICE_COLORS.spawn.stroke}
                  strokeWidth={2}
                />
                <circle
                  cx={layout.spawnPoint.x}
                  cy={layout.spawnPoint.y}
                  r={6}
                  fill={OFFICE_COLORS.spawn.fill}
                />
                <text
                  x={layout.spawnPoint.x}
                  y={layout.spawnPoint.y + 30}
                fill={OFFICE_COLORS.spawn.fill}
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
                    fill={OFFICE_COLORS.wall.secondary}
                    stroke={OFFICE_COLORS.wall.primary}
                    strokeWidth={1}
                  />
                  {/* Wall highlight (3D effect) */}
                  <rect
                    x={minX}
                    y={minY}
                    width={isHorizontal ? wallWidth : 4}
                    height={isHorizontal ? 4 : wallHeight}
                    fill={OFFICE_COLORS.wall.highlight}
                  />
                  {/* Door gap indicator */}
                  {wall.hasDoor && wall.doorPosition && (
                    <rect
                      x={wall.doorPosition.x - 48}
                      y={wall.doorPosition.y - 48}
                      width={96}
                      height={96}
                      fill="#f5f5dc"
                      stroke={OFFICE_COLORS.wall.secondary}
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
                stroke={OFFICE_COLORS.wall.secondary}
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
            <div className="w-3 h-3 rounded-sm bg-[#5c4033]" />
            <span>Wall</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 rounded-sm bg-[#8b4513]" />
            <span>Desk</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#3b82f6]" />
            <span>Chair</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#fbbf24] border border-[#f59e0b]" />
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
