'use client';

/**
 * Office Generator Component
 * 
 * Main component for generating and configuring dynamic office layouts.
 * Supports AI-assisted generation, templates, and manual editing.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  LayoutTemplate, 
  Pencil, 
  ChevronRight,
  Building,
  Users,
  Zap
} from 'lucide-react';

import { AIConfigForm, AIFormValues } from './AIConfigForm';
import { TemplateSelector } from './TemplateSelector';
import { LayoutPreview } from './LayoutPreview';
import { OfficeLayoutGenerator, GenerationParams, OfficeLayoutData } from '@/lib/game/generators';
import { ALL_TEMPLATES, getRecommendedTemplate } from '@/lib/game/generators/templates';

export interface OfficeGeneratorProps {
  workspaceId: string;
  initialTeamSize?: number;
  onLayoutGenerated: (layout: OfficeLayoutData) => void;
  onCancel?: () => void;
}

type GenerationMode = 'ai' | 'template' | 'manual';

export function OfficeGenerator({
  workspaceId,
  initialTeamSize = 10,
  onLayoutGenerated,
  onCancel,
}: OfficeGeneratorProps) {
  const [mode, setMode] = useState<GenerationMode>('ai');
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewLayout, setPreviewLayout] = useState<OfficeLayoutData | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  
  const generator = useMemo(() => new OfficeLayoutGenerator(), []);
  
  /**
   * Generate layout using AI parameters
   */
  const handleAIGenerate = useCallback(async (values: AIFormValues) => {
    setIsGenerating(true);
    
    try {
      const params: GenerationParams = {
        teamSize: values.teamSize,
        departments: values.departments.map(d => ({
          name: d.name,
          size: d.size,
          needsPrivacy: d.needsPrivacy,
        })),
        workCulture: values.workCulture,
        collaborationLevel: values.collaborationLevel,
        features: {
          meetingRooms: values.features.meetingRooms,
          phoneBooths: values.features.phoneBooths,
          breakArea: values.features.breakArea,
          cafeteria: values.features.cafeteria,
          reception: values.features.reception,
          hotDesks: values.features.hotDesks,
        },
        workStyle: {
          remotePercentage: values.remotePercentage,
          deskSharing: values.deskSharing,
          flexibleSeating: values.flexibleSeating,
        },
        preferences: {
          naturalLight: values.preferences.naturalLight,
          openPlan: values.preferences.openPlan,
          quietZones: values.preferences.quietZones,
          collaborationSpaces: values.preferences.collaborationSpaces,
        },
      };
      
      const layout = generator.generate(params);
      setPreviewLayout(layout);
    } catch (error) {
      console.error('Layout generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [generator]);
  
  /**
   * Select a template
   */
  const handleTemplateSelect = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
    
    const template = ALL_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      // Clone the template layout with a new ID
      const layout: OfficeLayoutData = {
        ...template.layout,
        id: `layout-${Date.now()}`,
        name: `${template.name} Office`,
        templateId: template.id,
        generatedAt: new Date().toISOString(),
      };
      setPreviewLayout(layout);
    }
  }, []);
  
  /**
   * Start with blank canvas for manual editing
   */
  const handleManualStart = useCallback(() => {
    const blankLayout: OfficeLayoutData = {
      id: `layout-${Date.now()}`,
      name: 'Custom Office',
      width: 1600,
      height: 1200,
      zones: [
        {
          id: 'main-zone',
          name: 'Main Area',
          type: 'work',
          bounds: { x: 50, y: 50, width: 1500, height: 1100 },
        },
      ],
      desks: [],
      rooms: [],
      decorations: [],
      spawnPoint: { x: 800, y: 600, direction: 'down' },
      metrics: {
        totalDesks: 0,
        totalRooms: 0,
        totalArea: 1600 * 1200,
        densityScore: 0,
        collaborationScore: 50,
        privacyScore: 50,
        flexibilityScore: 50,
      },
      generatedAt: new Date().toISOString(),
    };
    
    setPreviewLayout(blankLayout);
  }, []);
  
  /**
   * Confirm and save the layout
   */
  const handleConfirm = useCallback(() => {
    if (previewLayout) {
      onLayoutGenerated(previewLayout);
    }
  }, [previewLayout, onLayoutGenerated]);
  
  /**
   * Reset to initial state
   */
  const handleReset = useCallback(() => {
    setPreviewLayout(null);
    setSelectedTemplateId(null);
  }, []);
  
  // Get recommended template based on initial team size
  const recommendedTemplate = useMemo(() => {
    return getRecommendedTemplate(initialTeamSize);
  }, [initialTeamSize]);
  
  return (
    <div className="container max-w-6xl mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Office Generator</h1>
        <p className="text-muted-foreground">
          Create the perfect virtual office for your team. Choose AI-assisted generation,
          select from professional templates, or design from scratch.
        </p>
      </div>
      
      {/* Mode Selection */}
      {!previewLayout && (
        <Tabs value={mode} onValueChange={(v) => setMode(v as GenerationMode)} className="mb-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Generation
            </TabsTrigger>
            <TabsTrigger value="template" className="flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Manual
            </TabsTrigger>
          </TabsList>
          
          {/* AI Generation Tab */}
          <TabsContent value="ai" className="mt-6">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-blue-100">
                      <Building className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Smart Layout</p>
                      <p className="text-sm text-muted-foreground">AI-optimized zones</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-green-100">
                      <Users className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Team-Aware</p>
                      <p className="text-sm text-muted-foreground">Based on your needs</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-purple-100">
                      <Zap className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium">Instant</p>
                      <p className="text-sm text-muted-foreground">Generate in seconds</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <AIConfigForm 
              initialTeamSize={initialTeamSize}
              onSubmit={handleAIGenerate}
              isLoading={isGenerating}
            />
          </TabsContent>
          
          {/* Templates Tab */}
          <TabsContent value="template" className="mt-6">
            {recommendedTemplate && (
              <Card className="mb-6 border-blue-200 bg-blue-50/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-600">Recommended</Badge>
                    <CardTitle className="text-lg">{recommendedTemplate.name}</CardTitle>
                  </div>
                  <CardDescription>{recommendedTemplate.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => handleTemplateSelect(recommendedTemplate.id)}>
                    Use This Template
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            )}
            
            <TemplateSelector 
              templates={ALL_TEMPLATES}
              selectedId={selectedTemplateId}
              onSelect={handleTemplateSelect}
            />
          </TabsContent>
          
          {/* Manual Tab */}
          <TabsContent value="manual" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Start from Scratch</CardTitle>
                <CardDescription>
                  Begin with a blank canvas and build your office layout manually using the editor.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Best for: Custom layouts, unique requirements, or complete creative control.
                    </p>
                  </div>
                  <Button onClick={handleManualStart}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Start Designing
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
      
      {/* Layout Preview */}
      {previewLayout && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">{previewLayout.name}</h2>
              <p className="text-sm text-muted-foreground">
                {previewLayout.metrics?.totalDesks || 0} desks • 
                {previewLayout.metrics?.totalRooms || 0} rooms • 
                {previewLayout.width}x{previewLayout.height} pixels
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset}>
                Start Over
              </Button>
              <Button onClick={handleConfirm}>
                Use This Layout
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
          
          <LayoutPreview layout={previewLayout} />
          
          {/* Layout Metrics */}
          {previewLayout.metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Collaboration</p>
                  <p className="text-2xl font-bold">
                    {previewLayout.metrics.collaborationScore}%
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Privacy</p>
                  <p className="text-2xl font-bold">
                    {previewLayout.metrics.privacyScore}%
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Flexibility</p>
                  <p className="text-2xl font-bold">
                    {previewLayout.metrics.flexibilityScore}%
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Density</p>
                  <p className="text-2xl font-bold">
                    {previewLayout.metrics.densityScore}%
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* AI Reasoning */}
          {previewLayout.reasoning && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI Design Decisions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {previewLayout.reasoning.map((reason, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-blue-500 mt-1">•</span>
                      {reason}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      
      {/* Cancel Button */}
      {onCancel && (
        <div className="mt-6 pt-6 border-t">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
