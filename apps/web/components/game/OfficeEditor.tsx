'use client';

/**
 * Office Editor Component
 * 
 * Interactive drag-and-drop editor for modifying office layouts.
 * Supports adding/removing/moving desks, rooms, and decorations.
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import {
  Plus,
  Trash2,
  Move,
  Copy,
  Save,
  Undo,
  Redo,
  Grid3X3,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize,
  MousePointer,
  Square,
  Monitor,
  TreePine,
  Coffee,
  Sofa,
  BookOpen,
  Lamp,
  PenTool,
  Settings2,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  OfficeLayoutData,
  DeskData,
  RoomData,
  DecorationData,
  ZoneData,
  DeskType,
  RoomType,
  DecorationType,
  ZoneType,
} from '@/lib/game/generators/types';

interface OfficeEditorProps {
  initialLayout: OfficeLayoutData;
  onSave: (layout: OfficeLayoutData) => void;
  onCancel?: () => void;
}

type EditorTool = 'select' | 'desk' | 'room' | 'decoration' | 'zone' | 'erase';
type SelectedElement = {
  type: 'desk' | 'room' | 'decoration' | 'zone';
  id: string;
} | null;

interface HistoryState {
  past: OfficeLayoutData[];
  future: OfficeLayoutData[];
}

// Palette items
const DESK_PALETTE = [
  { type: 'standard' as DeskType, label: 'Standard Desk', icon: Monitor },
  { type: 'standing' as DeskType, label: 'Standing Desk', icon: Monitor },
  { type: 'hot' as DeskType, label: 'Hot Desk', icon: Monitor },
  { type: 'executive' as DeskType, label: 'Executive Desk', icon: Monitor },
];

const ROOM_PALETTE = [
  { type: 'meeting' as RoomType, label: 'Meeting Room', defaultSize: { width: 200, height: 150 } },
  { type: 'phone' as RoomType, label: 'Phone Booth', defaultSize: { width: 80, height: 80 } },
  { type: 'break' as RoomType, label: 'Break Room', defaultSize: { width: 250, height: 180 } },
  { type: 'huddle' as RoomType, label: 'Huddle Space', defaultSize: { width: 120, height: 100 } },
  { type: 'conference' as RoomType, label: 'Conference Room', defaultSize: { width: 300, height: 200 } },
  { type: 'private' as RoomType, label: 'Private Office', defaultSize: { width: 150, height: 120 } },
];

const DECORATION_PALETTE = [
  { type: 'plant' as DecorationType, label: 'Plant', icon: TreePine },
  { type: 'coffeeMachine' as DecorationType, label: 'Coffee Machine', icon: Coffee },
  { type: 'couch' as DecorationType, label: 'Couch', icon: Sofa },
  { type: 'bookshelf' as DecorationType, label: 'Bookshelf', icon: BookOpen },
  { type: 'whiteboard' as DecorationType, label: 'Whiteboard', icon: Square },
  { type: 'lamp' as DecorationType, label: 'Lamp', icon: Lamp },
];

export function OfficeEditor({ initialLayout, onSave, onCancel }: OfficeEditorProps) {
  // Layout state
  const [layout, setLayout] = useState<OfficeLayoutData>({ ...initialLayout });
  const [history, setHistory] = useState<HistoryState>({ past: [], future: [] });
  
  // Editor state
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [selectedElement, setSelectedElement] = useState<SelectedElement>(null);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  
  // Palette selection
  const [selectedDeskType, setSelectedDeskType] = useState<DeskType>('standard');
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType>('meeting');
  const [selectedDecorationType, setSelectedDecorationType] = useState<DecorationType>('plant');
  
  // Dialogs
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingElement, setEditingElement] = useState<any>(null);
  
  const canvasRef = useRef<SVGSVGElement>(null);
  
  // History management
  const pushHistory = useCallback((newLayout: OfficeLayoutData) => {
    setHistory(prev => ({
      past: [...prev.past.slice(-50), layout], // Keep last 50 states
      future: [],
    }));
    setLayout(newLayout);
  }, [layout]);
  
  const undo = useCallback(() => {
    if (history.past.length === 0) return;
    const previous = history.past[history.past.length - 1];
    setHistory(prev => ({
      past: prev.past.slice(0, -1),
      future: [layout, ...prev.future],
    }));
    setLayout(previous);
  }, [history, layout]);
  
  const redo = useCallback(() => {
    if (history.future.length === 0) return;
    const next = history.future[0];
    setHistory(prev => ({
      past: [...prev.past, layout],
      future: prev.future.slice(1),
    }));
    setLayout(next);
  }, [history, layout]);
  
  // Get clicked position in layout coordinates
  const getLayoutPosition = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = layout.width / rect.width / zoom;
    return {
      x: Math.round((e.clientX - rect.left) * scale - panOffset.x),
      y: Math.round((e.clientY - rect.top) * scale - panOffset.y),
    };
  }, [layout.width, zoom, panOffset]);
  
  // Snap to grid
  const snapToGrid = useCallback((value: number, gridSize: number = 32) => {
    return Math.round(value / gridSize) * gridSize;
  }, []);
  
  // Add desk
  const addDesk = useCallback((x: number, y: number, type: DeskType) => {
    const newDesk: DeskData = {
      id: `desk-${Date.now()}`,
      x: snapToGrid(x),
      y: snapToGrid(y),
      width: type === 'executive' ? 100 : 80,
      height: type === 'executive' ? 60 : 50,
      type,
    };
    
    pushHistory({
      ...layout,
      desks: [...layout.desks, newDesk],
    });
  }, [layout, pushHistory, snapToGrid]);
  
  // Add room
  const addRoom = useCallback((x: number, y: number, type: RoomType) => {
    const defaults = ROOM_PALETTE.find(r => r.type === type)?.defaultSize || { width: 200, height: 150 };
    const newRoom: RoomData = {
      id: `room-${Date.now()}`,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Room`,
      x: snapToGrid(x),
      y: snapToGrid(y),
      width: defaults.width,
      height: defaults.height,
      type,
    };
    
    pushHistory({
      ...layout,
      rooms: [...layout.rooms, newRoom],
    });
  }, [layout, pushHistory, snapToGrid]);
  
  // Add decoration
  const addDecoration = useCallback((x: number, y: number, type: DecorationType) => {
    const newDecoration: DecorationData = {
      id: `deco-${Date.now()}`,
      x: snapToGrid(x),
      y: snapToGrid(y),
      type,
    };
    
    pushHistory({
      ...layout,
      decorations: [...layout.decorations, newDecoration],
    });
  }, [layout, pushHistory, snapToGrid]);
  
  // Delete element
  const deleteElement = useCallback((type: string, id: string) => {
    const newLayout = { ...layout };
    
    if (type === 'desk') {
      newLayout.desks = layout.desks.filter(d => d.id !== id);
    } else if (type === 'room') {
      newLayout.rooms = layout.rooms.filter(r => r.id !== id);
    } else if (type === 'decoration') {
      newLayout.decorations = layout.decorations.filter(d => d.id !== id);
    }
    
    pushHistory(newLayout);
    setSelectedElement(null);
  }, [layout, pushHistory]);
  
  // Move element
  const moveElement = useCallback((type: string, id: string, newX: number, newY: number) => {
    const x = snapToGrid(newX);
    const y = snapToGrid(newY);
    const newLayout = { ...layout };
    
    if (type === 'desk') {
      newLayout.desks = layout.desks.map(d => 
        d.id === id ? { ...d, x, y } : d
      );
    } else if (type === 'room') {
      newLayout.rooms = layout.rooms.map(r => 
        r.id === id ? { ...r, x, y } : r
      );
    } else if (type === 'decoration') {
      newLayout.decorations = layout.decorations.map(d => 
        d.id === id ? { ...d, x, y } : d
      );
    }
    
    pushHistory(newLayout);
  }, [layout, pushHistory, snapToGrid]);
  
  // Handle canvas click
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    const pos = getLayoutPosition(e);
    
    if (activeTool === 'desk') {
      addDesk(pos.x, pos.y, selectedDeskType);
    } else if (activeTool === 'room') {
      addRoom(pos.x, pos.y, selectedRoomType);
    } else if (activeTool === 'decoration') {
      addDecoration(pos.x, pos.y, selectedDecorationType);
    } else if (activeTool === 'select') {
      // Deselect if clicking empty area
      setSelectedElement(null);
    }
  }, [activeTool, getLayoutPosition, addDesk, addRoom, addDecoration, selectedDeskType, selectedRoomType, selectedDecorationType]);
  
  // Handle element click
  const handleElementClick = useCallback((e: React.MouseEvent, type: 'desk' | 'room' | 'decoration', id: string) => {
    e.stopPropagation();
    
    if (activeTool === 'erase') {
      deleteElement(type, id);
    } else if (activeTool === 'select') {
      setSelectedElement({ type, id });
    }
  }, [activeTool, deleteElement]);
  
  // Get selected element data
  const selectedData = useMemo(() => {
    if (!selectedElement) return null;
    
    if (selectedElement.type === 'desk') {
      return layout.desks.find(d => d.id === selectedElement.id);
    } else if (selectedElement.type === 'room') {
      return layout.rooms.find(r => r.id === selectedElement.id);
    } else if (selectedElement.type === 'decoration') {
      return layout.decorations.find(d => d.id === selectedElement.id);
    }
    return null;
  }, [selectedElement, layout]);
  
  // Calculate metrics
  const metrics = useMemo(() => ({
    totalDesks: layout.desks.length,
    totalRooms: layout.rooms.length,
    totalDecorations: layout.decorations.length,
    hotDesks: layout.desks.filter(d => d.type === 'hot').length,
  }), [layout]);
  
  return (
    <div className="flex h-screen bg-slate-100">
      {/* Left Sidebar - Tools */}
      <div className="w-16 bg-white border-r flex flex-col items-center py-4 gap-2">
        <Button
          variant={activeTool === 'select' ? 'default' : 'ghost'}
          size="icon"
          onClick={() => setActiveTool('select')}
          title="Select"
        >
          <MousePointer className="h-5 w-5" />
        </Button>
        <Button
          variant={activeTool === 'desk' ? 'default' : 'ghost'}
          size="icon"
          onClick={() => setActiveTool('desk')}
          title="Add Desk"
        >
          <Monitor className="h-5 w-5" />
        </Button>
        <Button
          variant={activeTool === 'room' ? 'default' : 'ghost'}
          size="icon"
          onClick={() => setActiveTool('room')}
          title="Add Room"
        >
          <Square className="h-5 w-5" />
        </Button>
        <Button
          variant={activeTool === 'decoration' ? 'default' : 'ghost'}
          size="icon"
          onClick={() => setActiveTool('decoration')}
          title="Add Decoration"
        >
          <TreePine className="h-5 w-5" />
        </Button>
        <Button
          variant={activeTool === 'erase' ? 'default' : 'ghost'}
          size="icon"
          onClick={() => setActiveTool('erase')}
          title="Erase"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
        
        <div className="flex-1" />
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowGrid(!showGrid)}
          title="Toggle Grid"
        >
          <Grid3X3 className={`h-5 w-5 ${showGrid ? 'text-primary' : ''}`} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowZones(!showZones)}
          title="Toggle Zones"
        >
          <Layers className={`h-5 w-5 ${showZones ? 'text-primary' : ''}`} />
        </Button>
      </div>
      
      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="h-14 bg-white border-b flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={undo} disabled={history.past.length === 0}>
              <Undo className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={redo} disabled={history.future.length === 0}>
              <Redo className="h-4 w-4" />
            </Button>
            
            <div className="h-6 w-px bg-border mx-2" />
            
            <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Badge variant="outline">{Math.round(zoom * 100)}%</Badge>
            <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(2, z + 0.1))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setZoom(1)}>
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{metrics.totalDesks} desks</span>
            <span>{metrics.totalRooms} rooms</span>
            <span>{layout.width}×{layout.height}</span>
          </div>
          
          <div className="flex items-center gap-2">
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button onClick={() => onSave(layout)}>
              <Save className="h-4 w-4 mr-2" />
              Save Layout
            </Button>
          </div>
        </div>
        
        {/* Canvas */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
          <svg
            ref={canvasRef}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            className="max-w-full max-h-full shadow-lg"
            style={{
              width: layout.width * zoom * 0.5,
              height: layout.height * zoom * 0.5,
              cursor: activeTool === 'select' ? 'default' : 'crosshair',
            }}
            onClick={handleCanvasClick}
          >
            {/* Background */}
            <rect x={0} y={0} width={layout.width} height={layout.height} fill="#f5f5dc" />
            
            {/* Grid */}
            {showGrid && (
              <g opacity={0.15}>
                {Array.from({ length: Math.ceil(layout.width / 32) }).map((_, i) => (
                  <line key={`v${i}`} x1={i * 32} y1={0} x2={i * 32} y2={layout.height} stroke="#666" strokeWidth={1} />
                ))}
                {Array.from({ length: Math.ceil(layout.height / 32) }).map((_, i) => (
                  <line key={`h${i}`} x1={0} y1={i * 32} x2={layout.width} y2={i * 32} stroke="#666" strokeWidth={1} />
                ))}
              </g>
            )}
            
            {/* Zones */}
            {showZones && layout.zones.map(zone => (
              <g key={zone.id}>
                <rect
                  x={zone.bounds.x}
                  y={zone.bounds.y}
                  width={zone.bounds.width}
                  height={zone.bounds.height}
                  fill={getZoneColor(zone.type)}
                  fillOpacity={0.3}
                  stroke={getZoneColor(zone.type)}
                  strokeWidth={2}
                  strokeDasharray="8,4"
                />
                <text x={zone.bounds.x + 10} y={zone.bounds.y + 20} fill="#666" fontSize={14} fontWeight="bold">
                  {zone.name}
                </text>
              </g>
            ))}
            
            {/* Rooms */}
            {layout.rooms.map(room => (
              <g 
                key={room.id}
                onClick={(e) => handleElementClick(e, 'room', room.id)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={room.x}
                  y={room.y}
                  width={room.width}
                  height={room.height}
                  fill={getRoomColor(room.type)}
                  stroke={selectedElement?.id === room.id ? '#000' : getRoomStroke(room.type)}
                  strokeWidth={selectedElement?.id === room.id ? 4 : 3}
                  rx={4}
                />
                <text x={room.x + room.width / 2} y={room.y + 18} fill="#333" fontSize={12} fontWeight="bold" textAnchor="middle">
                  {room.name}
                </text>
              </g>
            ))}
            
            {/* Desks */}
            {layout.desks.map(desk => (
              <g
                key={desk.id}
                onClick={(e) => handleElementClick(e, 'desk', desk.id)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={desk.x}
                  y={desk.y}
                  width={desk.width || 80}
                  height={desk.height || 50}
                  fill={getDeskColor(desk.type)}
                  stroke={selectedElement?.id === desk.id ? '#000' : '#5d4037'}
                  strokeWidth={selectedElement?.id === desk.id ? 3 : 2}
                  rx={3}
                />
                <rect
                  x={(desk.x || 0) + 3}
                  y={(desk.y || 0) + 3}
                  width={(desk.width || 80) - 6}
                  height={(desk.height || 50) - 6}
                  fill="#d2b48c"
                  rx={2}
                />
                {/* Monitor */}
                <rect
                  x={(desk.x || 0) + (desk.width || 80) / 2 - 10}
                  y={(desk.y || 0) + 8}
                  width={20}
                  height={14}
                  fill="#333"
                  rx={2}
                />
                {/* Chair */}
                <circle
                  cx={(desk.x || 0) + (desk.width || 80) / 2}
                  cy={(desk.y || 0) + (desk.height || 50) + 12}
                  r={10}
                  fill="#2563eb"
                  stroke="#1e40af"
                  strokeWidth={2}
                />
                {/* Hot desk indicator */}
                {desk.type === 'hot' && (
                  <circle
                    cx={(desk.x || 0) + (desk.width || 80) - 8}
                    cy={(desk.y || 0) + 8}
                    r={6}
                    fill="#fbbf24"
                    stroke="#f59e0b"
                    strokeWidth={1}
                  />
                )}
              </g>
            ))}
            
            {/* Decorations */}
            {layout.decorations.map(deco => (
              <g
                key={deco.id}
                onClick={(e) => handleElementClick(e, 'decoration', deco.id)}
                style={{ cursor: 'pointer' }}
              >
                {deco.type === 'plant' && (
                  <>
                    <rect x={deco.x - 10} y={deco.y + 5} width={20} height={15} fill="#d2691e" rx={2} />
                    <circle cx={deco.x} cy={deco.y - 5} r={12} fill="#228b22" />
                    <circle cx={deco.x - 8} cy={deco.y} r={8} fill="#2d8f2d" />
                    <circle cx={deco.x + 8} cy={deco.y} r={8} fill="#2d8f2d" />
                  </>
                )}
                {deco.type === 'whiteboard' && (
                  <rect x={deco.x} y={deco.y} width={80} height={55} fill="#fff" stroke="#9e9e9e" strokeWidth={3} rx={2} />
                )}
                {deco.type === 'coffeeMachine' && (
                  <rect x={deco.x} y={deco.y} width={30} height={40} fill="#5d4037" rx={3} />
                )}
                {deco.type === 'couch' && (
                  <rect x={deco.x} y={deco.y} width={70} height={35} fill="#6b5b95" rx={6} />
                )}
                {deco.type === 'bookshelf' && (
                  <rect x={deco.x} y={deco.y} width={50} height={70} fill="#5d4037" rx={2} />
                )}
                {deco.type === 'lamp' && (
                  <>
                    <rect x={deco.x - 2} y={deco.y} width={4} height={25} fill="#666" />
                    <polygon points={`${deco.x - 12},${deco.y} ${deco.x + 12},${deco.y} ${deco.x},${deco.y - 20}`} fill="#ffd54f" />
                  </>
                )}
                {selectedElement?.id === deco.id && (
                  <circle cx={deco.x} cy={deco.y} r={20} fill="none" stroke="#000" strokeWidth={2} strokeDasharray="4,4" />
                )}
              </g>
            ))}
            
            {/* Spawn point */}
            <g>
              <circle cx={layout.spawnPoint.x} cy={layout.spawnPoint.y} r={15} fill="#4caf50" fillOpacity={0.3} stroke="#4caf50" strokeWidth={2} />
              <circle cx={layout.spawnPoint.x} cy={layout.spawnPoint.y} r={6} fill="#4caf50" />
            </g>
            
            {/* Border */}
            <rect x={0} y={0} width={layout.width} height={layout.height} fill="none" stroke="#4a5568" strokeWidth={16} />
          </svg>
        </div>
      </div>
      
      {/* Right Sidebar - Properties */}
      <div className="w-72 bg-white border-l">
        <Tabs defaultValue="palette" className="h-full flex flex-col">
          <TabsList className="m-2">
            <TabsTrigger value="palette">Palette</TabsTrigger>
            <TabsTrigger value="properties">Properties</TabsTrigger>
          </TabsList>
          
          <TabsContent value="palette" className="flex-1 m-0 p-2">
            <ScrollArea className="h-full">
              {activeTool === 'desk' && (
                <div className="space-y-2">
                  <Label>Desk Type</Label>
                  {DESK_PALETTE.map(desk => (
                    <div
                      key={desk.type}
                      className={`
                        p-3 border rounded-lg cursor-pointer transition-all
                        ${selectedDeskType === desk.type ? 'border-primary bg-primary/5' : 'hover:border-slate-300'}
                      `}
                      onClick={() => setSelectedDeskType(desk.type)}
                    >
                      <div className="flex items-center gap-2">
                        <desk.icon className="h-4 w-4" />
                        <span className="text-sm">{desk.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {activeTool === 'room' && (
                <div className="space-y-2">
                  <Label>Room Type</Label>
                  {ROOM_PALETTE.map(room => (
                    <div
                      key={room.type}
                      className={`
                        p-3 border rounded-lg cursor-pointer transition-all
                        ${selectedRoomType === room.type ? 'border-primary bg-primary/5' : 'hover:border-slate-300'}
                      `}
                      onClick={() => setSelectedRoomType(room.type)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{room.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {room.defaultSize.width}×{room.defaultSize.height}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {activeTool === 'decoration' && (
                <div className="space-y-2">
                  <Label>Decoration Type</Label>
                  {DECORATION_PALETTE.map(deco => (
                    <div
                      key={deco.type}
                      className={`
                        p-3 border rounded-lg cursor-pointer transition-all
                        ${selectedDecorationType === deco.type ? 'border-primary bg-primary/5' : 'hover:border-slate-300'}
                      `}
                      onClick={() => setSelectedDecorationType(deco.type)}
                    >
                      <div className="flex items-center gap-2">
                        <deco.icon className="h-4 w-4" />
                        <span className="text-sm">{deco.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {activeTool === 'select' && !selectedElement && (
                <div className="text-center text-muted-foreground py-8">
                  <MousePointer className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Click an element to select it</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="properties" className="flex-1 m-0 p-2">
            {selectedElement && selectedData ? (
              <div className="space-y-4">
                <div>
                  <Label>Type</Label>
                  <p className="text-sm capitalize">{selectedElement.type}</p>
                </div>
                
                <div>
                  <Label>ID</Label>
                  <p className="text-sm font-mono text-xs">{selectedElement.id}</p>
                </div>
                
                {selectedElement.type === 'desk' && (
                  <>
                    <div>
                      <Label>Desk Type</Label>
                      <p className="text-sm capitalize">{(selectedData as DeskData).type || 'standard'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>X</Label>
                        <p className="text-sm">{(selectedData as DeskData).x}</p>
                      </div>
                      <div>
                        <Label>Y</Label>
                        <p className="text-sm">{(selectedData as DeskData).y}</p>
                      </div>
                    </div>
                  </>
                )}
                
                {selectedElement.type === 'room' && (
                  <>
                    <div>
                      <Label>Name</Label>
                      <p className="text-sm">{(selectedData as RoomData).name}</p>
                    </div>
                    <div>
                      <Label>Room Type</Label>
                      <p className="text-sm capitalize">{(selectedData as RoomData).type}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Width</Label>
                        <p className="text-sm">{(selectedData as RoomData).width}</p>
                      </div>
                      <div>
                        <Label>Height</Label>
                        <p className="text-sm">{(selectedData as RoomData).height}</p>
                      </div>
                    </div>
                  </>
                )}
                
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => deleteElement(selectedElement.type, selectedElement.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select an element to view properties</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Helper functions
function getZoneColor(type: ZoneType): string {
  const colors: Record<ZoneType, string> = {
    work: '#4a90d9',
    meeting: '#2ecc71',
    break: '#e67e22',
    focus: '#9b59b6',
    social: '#f1c40f',
    creative: '#e74c3c',
    reception: '#1abc9c',
    executive: '#8e44ad',
  };
  return colors[type] || '#999999';
}

function getRoomColor(type: RoomType): string {
  const colors: Record<RoomType, string> = {
    meeting: '#c8e6c9',
    break: '#ffe0b2',
    phone: '#bbdefb',
    private: '#e1bee7',
    conference: '#c5cae9',
    huddle: '#f8bbd0',
  };
  return colors[type] || '#e0e0e0';
}

function getRoomStroke(type: RoomType): string {
  const colors: Record<RoomType, string> = {
    meeting: '#4caf50',
    break: '#ff9800',
    phone: '#2196f3',
    private: '#9c27b0',
    conference: '#3f51b5',
    huddle: '#e91e63',
  };
  return colors[type] || '#9e9e9e';
}

function getDeskColor(type?: DeskType): string {
  const colors: Record<DeskType, string> = {
    standard: '#8b4513',
    standing: '#5d4037',
    executive: '#3e2723',
    hot: '#f59e0b',
  };
  return colors[type || 'standard'] || '#8b4513';
}
