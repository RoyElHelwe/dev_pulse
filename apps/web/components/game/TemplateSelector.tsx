'use client';

/**
 * Template Selector Component
 * 
 * Displays available office templates with previews and filtering options.
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search, 
  Users, 
  LayoutGrid, 
  CheckCircle2,
  Building,
  Rocket,
  Palette,
  Globe,
  Building2,
  GitBranch
} from 'lucide-react';
import { OfficeTemplate, TemplateCategory } from '@/lib/game/generators/types';

interface TemplateSelectorProps {
  templates: OfficeTemplate[];
  selectedId: string | null;
  onSelect: (templateId: string) => void;
}

const categoryIcons: Record<TemplateCategory, React.ReactNode> = {
  startup: <Rocket className="h-4 w-4" />,
  corporate: <Building className="h-4 w-4" />,
  creative: <Palette className="h-4 w-4" />,
  'remote-hub': <Globe className="h-4 w-4" />,
  enterprise: <Building2 className="h-4 w-4" />,
  hybrid: <GitBranch className="h-4 w-4" />,
};

const categoryLabels: Record<TemplateCategory, string> = {
  startup: 'Startup',
  corporate: 'Corporate',
  creative: 'Creative',
  'remote-hub': 'Remote Hub',
  enterprise: 'Enterprise',
  hybrid: 'Hybrid',
};

const categoryColors: Record<TemplateCategory, string> = {
  startup: 'bg-blue-100 text-blue-700 border-blue-200',
  corporate: 'bg-slate-100 text-slate-700 border-slate-200',
  creative: 'bg-pink-100 text-pink-700 border-pink-200',
  'remote-hub': 'bg-green-100 text-green-700 border-green-200',
  enterprise: 'bg-purple-100 text-purple-700 border-purple-200',
  hybrid: 'bg-orange-100 text-orange-700 border-orange-200',
};

export function TemplateSelector({ 
  templates, 
  selectedId, 
  onSelect 
}: TemplateSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [teamSizeFilter, setTeamSizeFilter] = useState<string>('all');
  
  // Filter templates based on search and filters
  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          template.name.toLowerCase().includes(query) ||
          template.description.toLowerCase().includes(query) ||
          template.category.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      
      // Category filter
      if (categoryFilter !== 'all' && template.category !== categoryFilter) {
        return false;
      }
      
      // Team size filter
      if (teamSizeFilter !== 'all') {
        const size = parseInt(teamSizeFilter);
        if (size < template.minTeamSize || size > template.maxTeamSize) {
          return false;
        }
      }
      
      return true;
    });
  }, [templates, searchQuery, categoryFilter, teamSizeFilter]);
  
  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(templates.map(t => t.category));
    return Array.from(cats);
  }, [templates]);
  
  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>
                <div className="flex items-center gap-2">
                  {categoryIcons[cat]}
                  {categoryLabels[cat]}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={teamSizeFilter} onValueChange={setTeamSizeFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Team Size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Size</SelectItem>
            <SelectItem value="5">5 people</SelectItem>
            <SelectItem value="10">10 people</SelectItem>
            <SelectItem value="20">20 people</SelectItem>
            <SelectItem value="30">30 people</SelectItem>
            <SelectItem value="50">50 people</SelectItem>
            <SelectItem value="75">75 people</SelectItem>
            <SelectItem value="100">100 people</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredTemplates.length} of {templates.length} templates
      </div>
      
      {/* Template Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map(template => (
          <TemplateCard
            key={template.id}
            template={template}
            isSelected={selectedId === template.id}
            onSelect={() => onSelect(template.id)}
          />
        ))}
      </div>
      
      {/* No results */}
      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <LayoutGrid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No templates found</h3>
          <p className="text-muted-foreground">
            Try adjusting your filters or search query
          </p>
        </div>
      )}
    </div>
  );
}

interface TemplateCardProps {
  template: OfficeTemplate;
  isSelected: boolean;
  onSelect: () => void;
}

function TemplateCard({ template, isSelected, onSelect }: TemplateCardProps) {
  const { layout } = template;
  
  return (
    <Card 
      className={`
        cursor-pointer transition-all hover:shadow-md
        ${isSelected ? 'ring-2 ring-primary shadow-md' : ''}
      `}
      onClick={onSelect}
    >
      {/* Mini Preview */}
      <div className="relative h-36 bg-slate-100 rounded-t-lg overflow-hidden">
        <MiniLayoutPreview layout={layout} />
        
        {isSelected && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-primary">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Selected
            </Badge>
          </div>
        )}
        
        <div className="absolute bottom-2 left-2">
          <Badge 
            variant="outline" 
            className={categoryColors[template.category]}
          >
            {categoryIcons[template.category]}
            <span className="ml-1">{categoryLabels[template.category]}</span>
          </Badge>
        </div>
      </div>
      
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{template.name}</CardTitle>
        <CardDescription className="text-xs line-clamp-2">
          {template.description}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{template.minTeamSize}-{template.maxTeamSize} people</span>
          </div>
          
          <div className="flex items-center gap-1 text-muted-foreground">
            <LayoutGrid className="h-4 w-4" />
            <span>{layout.desks.length} desks</span>
          </div>
        </div>
        
        {/* Features badges */}
        <div className="flex flex-wrap gap-1 mt-3">
          {layout.rooms.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {layout.rooms.length} rooms
            </Badge>
          )}
          {layout.zones.length > 1 && (
            <Badge variant="secondary" className="text-xs">
              {layout.zones.length} zones
            </Badge>
          )}
          {layout.desks.some(d => d.type === 'hot') && (
            <Badge variant="secondary" className="text-xs">
              Hot desks
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Mini layout preview for template cards
 */
function MiniLayoutPreview({ layout }: { layout: any }) {
  const scale = 0.08; // Scale down for mini preview
  const width = layout.width * scale;
  const height = layout.height * scale;
  
  return (
    <svg 
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Background */}
      <rect 
        x={0} 
        y={0} 
        width={layout.width} 
        height={layout.height} 
        fill="#f5f5dc" 
      />
      
      {/* Zones */}
      {layout.zones.map((zone: any, i: number) => (
        <rect
          key={`zone-${i}`}
          x={zone.bounds.x}
          y={zone.bounds.y}
          width={zone.bounds.width}
          height={zone.bounds.height}
          fill={getZoneColor(zone.type)}
          fillOpacity={0.3}
          stroke={getZoneColor(zone.type)}
          strokeWidth={4}
          strokeOpacity={0.5}
        />
      ))}
      
      {/* Rooms */}
      {layout.rooms.map((room: any, i: number) => (
        <rect
          key={`room-${i}`}
          x={room.x}
          y={room.y}
          width={room.width}
          height={room.height}
          fill={getRoomColor(room.type)}
          stroke={getRoomColor(room.type)}
          strokeWidth={4}
        />
      ))}
      
      {/* Desks */}
      {layout.desks.map((desk: any, i: number) => (
        <rect
          key={`desk-${i}`}
          x={desk.x}
          y={desk.y}
          width={desk.width || 60}
          height={desk.height || 40}
          fill={desk.type === 'hot' ? '#f59e0b' : '#8b4513'}
          rx={4}
        />
      ))}
      
      {/* Decorations as circles */}
      {layout.decorations.map((deco: any, i: number) => (
        <circle
          key={`deco-${i}`}
          cx={deco.x}
          cy={deco.y}
          r={15}
          fill={deco.type === 'plant' ? '#228b22' : '#9e9e9e'}
          fillOpacity={0.7}
        />
      ))}
    </svg>
  );
}

function getZoneColor(type: string): string {
  const colors: Record<string, string> = {
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

function getRoomColor(type: string): string {
  const colors: Record<string, string> = {
    meeting: '#c8e6c9',
    break: '#ffe0b2',
    phone: '#bbdefb',
    private: '#e1bee7',
    conference: '#c5cae9',
    huddle: '#f8bbd9',
  };
  return colors[type] || '#e0e0e0';
}
