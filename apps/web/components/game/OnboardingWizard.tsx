'use client';

/**
 * Office Onboarding Wizard
 * 
 * Step-by-step wizard for setting up a workspace's virtual office.
 * Guides users through team info, style preferences, and layout generation.
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import {
  ChevronRight,
  ChevronLeft,
  Users,
  Building2,
  Check,
  Loader2,
  LayoutTemplate,
  Rocket,
  Palette,
  Globe,
  Building,
  GitBranch
} from 'lucide-react';

import { LayoutPreview } from './LayoutPreview';
import { OfficeLayoutData } from '@/lib/game/generators';
import { ALL_TEMPLATES, getRecommendedTemplate } from '@/lib/game/generators/templates';

interface OnboardingWizardProps {
  workspaceId: string;
  workspaceName: string;
  onComplete: (layout: OfficeLayoutData, teamInfo: { workspaceName: string; teamSize: number; departments: Array<{ name: string; size: number }> }) => void;
  onSkip?: () => void;
}

type Step = 'welcome' | 'team' | 'style' | 'template' | 'preview' | 'complete';

interface OnboardingState {
  workspaceName: string;
  teamSize: number;
  departments: Array<{ name: string; size: number }>;
  workCulture: 'startup' | 'corporate' | 'creative' | 'hybrid' | 'remote-first';
  collaborationLevel: 'high' | 'medium' | 'low';
  remotePercentage: number;
  selectedTemplateId: string | null;
  generatedLayout: OfficeLayoutData | null;
}

const STEPS: Step[] = ['welcome', 'team', 'style', 'template', 'preview', 'complete'];

const workCultureOptions = [
  { value: 'startup', label: 'Startup', icon: Rocket, description: 'Fast-paced & open', color: 'bg-blue-100 text-blue-700' },
  { value: 'corporate', label: 'Corporate', icon: Building, description: 'Structured & professional', color: 'bg-slate-100 text-slate-700' },
  { value: 'creative', label: 'Creative', icon: Palette, description: 'Inspiring & unique', color: 'bg-pink-100 text-pink-700' },
  { value: 'remote-first', label: 'Remote-First', icon: Globe, description: 'Flexible & distributed', color: 'bg-green-100 text-green-700' },
  { value: 'hybrid', label: 'Hybrid', icon: GitBranch, description: 'Best of both worlds', color: 'bg-orange-100 text-orange-700' },
];

export function OnboardingWizard({
  workspaceId,
  workspaceName,
  onComplete,
  onSkip,
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [isGenerating, setIsGenerating] = useState(false);
  const [state, setState] = useState<OnboardingState>({
    workspaceName: workspaceName || 'My Workspace',
    teamSize: 10,
    departments: [{ name: 'General', size: 10 }],
    workCulture: 'startup',
    collaborationLevel: 'medium',
    remotePercentage: 20,
    selectedTemplateId: null,
    generatedLayout: null,
  });
  
  const currentStepIndex = STEPS.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;
  
  const goToNextStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]);
    }
  }, [currentStepIndex]);
  
  const goToPrevStep = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex]);
    }
  }, [currentStepIndex]);
  
  const updateState = useCallback((updates: Partial<OnboardingState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);
  
  const generateLayout = useCallback(async () => {
    if (!state.selectedTemplateId) return;
    
    setIsGenerating(true);
    
    try {
      // Use selected template - transform to match expected format
      const template = ALL_TEMPLATES.find(t => t.id === state.selectedTemplateId);
      if (template) {
        const templateLayout = template.layout;
        const layout: OfficeLayoutData = {
          id: `layout-${Date.now()}`,
          name: `${workspaceName} Office`,
          templateId: template.id,
          generatedAt: new Date().toISOString(),
          // Extract width/height from dimensions object
          width: templateLayout.dimensions.width,
          height: templateLayout.dimensions.height,
          // Transform zones to match expected format
          zones: templateLayout.zones.map(z => ({
            id: z.id,
            name: z.name,
            type: z.type,
            bounds: z.bounds,
          })),
          // Transform desks to match expected format
          desks: templateLayout.desks.map(d => ({
            id: d.id,
            x: d.position.x,
            y: d.position.y,
            width: d.dimensions.width,
            height: d.dimensions.height,
            type: d.type,
            rotation: 0,
          })),
          // Transform rooms to match expected format
          rooms: templateLayout.rooms.map(r => ({
            id: r.id,
            name: r.name,
            type: r.type,
            x: r.bounds.x,
            y: r.bounds.y,
            width: r.bounds.width,
            height: r.bounds.height,
            capacity: r.capacity,
          })),
          // Transform decorations to match expected format
          decorations: templateLayout.decorations.map(d => ({
            id: d.id,
            type: d.type,
            x: d.position.x,
            y: d.position.y,
          })),
          // Include walls data for preview rendering
          walls: templateLayout.walls.map(w => ({
            id: w.id,
            start: w.start,
            end: w.end,
            thickness: w.thickness,
            hasDoor: w.hasDoor,
            doorPosition: w.doorPosition,
          })),
          // Transform spawnPoints array to single spawnPoint
          spawnPoint: templateLayout.spawnPoints[0] ? {
            x: templateLayout.spawnPoints[0].position.x,
            y: templateLayout.spawnPoints[0].position.y,
            direction: 'down',
          } : { x: templateLayout.dimensions.width / 2, y: templateLayout.dimensions.height / 2, direction: 'down' },
        };
        updateState({ generatedLayout: layout });
        goToNextStep();
      }
    } catch (error) {
      console.error('Layout generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [state.selectedTemplateId, workspaceName, updateState, goToNextStep]);
  
  const handleComplete = useCallback(() => {
    if (state.generatedLayout) {
      console.log('Completing onboarding with layout:', state.generatedLayout);
      onComplete(state.generatedLayout, {
        workspaceName: state.workspaceName,
        teamSize: state.teamSize,
        departments: state.departments,
      });
    } else {
      console.error('No layout generated');
    }
  }, [state.generatedLayout, state.workspaceName, state.teamSize, state.departments, onComplete]);
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8">
      <div className="container max-w-3xl mx-auto px-4">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Step {currentStepIndex + 1} of {STEPS.length}
            </span>
            {onSkip && currentStep !== 'complete' && (
              <Button variant="ghost" size="sm" onClick={onSkip}>
                Skip setup
              </Button>
            )}
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        
        {/* Step Content */}
        <Card className="shadow-lg">
          {/* Welcome Step */}
          {currentStep === 'welcome' && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10">
                  <Building2 className="h-10 w-10 text-primary" />
                </div>
                <CardTitle className="text-2xl">Welcome to Your Virtual Office!</CardTitle>
                <CardDescription className="text-base">
                  Let's create the perfect workspace for your team. 
                  This wizard will help you design an office that fits your needs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="workspace-name">Workspace Name</Label>
                  <Input
                    id="workspace-name"
                    placeholder="e.g., Acme Corp, My Startup, Team Phoenix"
                    value={state.workspaceName}
                    onChange={(e) => updateState({ workspaceName: e.target.value })}
                    className="text-lg"
                  />
                  <p className="text-xs text-muted-foreground">
                    This will be the name of your virtual office
                  </p>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-blue-50 text-center">
                    <Users className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                    <p className="text-sm font-medium">Team-Aware</p>
                    <p className="text-xs text-muted-foreground">Sized for your team</p>
                  </div>
                  <div className="p-4 rounded-lg bg-green-50 text-center">
                    <LayoutTemplate className="h-6 w-6 text-green-600 mx-auto mb-2" />
                    <p className="text-sm font-medium">Pro Templates</p>
                    <p className="text-xs text-muted-foreground">Ready to use layouts</p>
                  </div>
                  <div className="p-4 rounded-lg bg-purple-50 text-center">
                    <Building2 className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                    <p className="text-sm font-medium">Modern Offices</p>
                    <p className="text-xs text-muted-foreground">Multiple styles</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="justify-center">
                <Button size="lg" onClick={goToNextStep} disabled={!state.workspaceName.trim()}>
                  Get Started
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </CardFooter>
            </>
          )}
          
          {/* Team Step */}
          {currentStep === 'team' && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Tell us about your team
                </CardTitle>
                <CardDescription>
                  We'll use this to size your office appropriately
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label>How many people are on your team?</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      min={1}
                      max={100}
                      step={1}
                      value={[state.teamSize]}
                      onValueChange={(v) => updateState({ teamSize: v[0] })}
                      className="flex-1"
                    />
                    <Badge variant="outline" className="w-16 justify-center text-lg">
                      {state.teamSize}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This includes everyone who might use the virtual office
                  </p>
                </div>
                
                <div className="space-y-4">
                  <Label>What percentage work remotely?</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      min={0}
                      max={100}
                      step={5}
                      value={[state.remotePercentage]}
                      onValueChange={(v) => updateState({ remotePercentage: v[0] })}
                      className="flex-1"
                    />
                    <Badge variant="outline" className="w-16 justify-center">
                      {state.remotePercentage}%
                    </Badge>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="justify-between">
                <Button variant="outline" onClick={goToPrevStep}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={goToNextStep}>
                  Continue
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </CardFooter>
            </>
          )}
          
          {/* Style Step */}
          {currentStep === 'style' && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  What's your work culture like?
                </CardTitle>
                <CardDescription>
                  This helps us design the right kind of space
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {workCultureOptions.map((option) => {
                    const Icon = option.icon;
                    const isSelected = state.workCulture === option.value;
                    
                    return (
                      <div
                        key={option.value}
                        className={`
                          p-4 border-2 rounded-lg cursor-pointer transition-all
                          ${isSelected 
                            ? 'border-primary bg-primary/5' 
                            : 'border-transparent bg-slate-50 hover:border-slate-200'}
                        `}
                        onClick={() => updateState({ workCulture: option.value as OnboardingState['workCulture'] })}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${option.color}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{option.label}</p>
                            <p className="text-xs text-muted-foreground">{option.description}</p>
                          </div>
                          {isSelected && (
                            <Check className="h-5 w-5 text-primary ml-auto" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="space-y-4">
                  <Label>How much collaboration happens?</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['low', 'medium', 'high'] as const).map((level) => (
                      <div
                        key={level}
                        className={`
                          p-3 border-2 rounded-lg cursor-pointer text-center transition-all
                          ${state.collaborationLevel === level 
                            ? 'border-primary bg-primary/5' 
                            : 'border-transparent bg-slate-50 hover:border-slate-200'}
                        `}
                        onClick={() => updateState({ collaborationLevel: level })}
                      >
                        <p className="font-medium capitalize">{level}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="justify-between">
                <Button variant="outline" onClick={goToPrevStep}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={goToNextStep}>
                  Continue
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </CardFooter>
            </>
          )}
          
          {/* Template Selection Step */}
          {currentStep === 'template' && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutTemplate className="h-5 w-5" />
                  Choose Your Office Template
                </CardTitle>
                <CardDescription>
                  Select a professionally designed layout that fits your team
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
                  {ALL_TEMPLATES.map(template => {
                    const isSelected = state.selectedTemplateId === template.id;
                    const isRecommended = getRecommendedTemplate(state.teamSize)?.id === template.id;
                    
                    return (
                      <div
                        key={template.id}
                        className={`
                          p-4 border-2 rounded-lg cursor-pointer transition-all
                          ${isSelected 
                            ? 'border-primary bg-primary/5' 
                            : 'border-transparent bg-slate-50 hover:border-slate-200'}
                        `}
                        onClick={() => updateState({ selectedTemplateId: template.id })}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-medium text-sm">{template.name}</p>
                          {isRecommended && (
                            <Badge variant="secondary" className="text-xs">
                              Suggested
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {template.description}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {template.minTeamSize}-{template.maxTeamSize} people
                        </div>
                        {isSelected && (
                          <div className="mt-2 flex items-center text-primary text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            Selected
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
              <CardFooter className="justify-between">
                <Button variant="outline" onClick={goToPrevStep}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button 
                  onClick={generateLayout}
                  disabled={isGenerating || !state.selectedTemplateId}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      Generate Office
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </CardFooter>
            </>
          )}
          
          {/* Preview Step */}
          {currentStep === 'preview' && state.generatedLayout && (
            <>
              <CardHeader>
                <CardTitle>Your Office is Ready!</CardTitle>
                <CardDescription>
                  Here's a preview of your generated office layout
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LayoutPreview layout={state.generatedLayout} />
                
                {state.generatedLayout.metrics && (
                  <div className="grid grid-cols-4 gap-3 mt-4">
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <p className="text-2xl font-bold">{state.generatedLayout.metrics.totalDesks}</p>
                      <p className="text-xs text-muted-foreground">Desks</p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <p className="text-2xl font-bold">{state.generatedLayout.metrics.totalRooms}</p>
                      <p className="text-xs text-muted-foreground">Rooms</p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <p className="text-2xl font-bold">{state.generatedLayout.metrics.collaborationScore}%</p>
                      <p className="text-xs text-muted-foreground">Collaboration</p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <p className="text-2xl font-bold">{state.generatedLayout.metrics.privacyScore}%</p>
                      <p className="text-xs text-muted-foreground">Privacy</p>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="justify-between">
                <Button variant="outline" type="button" onClick={() => setCurrentStep('template')}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Change Template
                </Button>
                <Button type="button" onClick={() => setCurrentStep('complete')}>
                  Looks Good!
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </CardFooter>
            </>
          )}
          
          {/* Complete Step */}
          {currentStep === 'complete' && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 p-4 rounded-full bg-green-100">
                  <Check className="h-10 w-10 text-green-600" />
                </div>
                <CardTitle className="text-2xl">All Set!</CardTitle>
                <CardDescription className="text-base">
                  Your virtual office is ready. Your team can now explore the space,
                  claim desks, and start collaborating.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <div className="grid grid-cols-2 gap-4 my-6">
                  <div className="p-4 rounded-lg bg-slate-50">
                    <p className="text-2xl font-bold text-primary">
                      {state.generatedLayout?.metrics?.totalDesks || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Workstations</p>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-50">
                    <p className="text-2xl font-bold text-primary">
                      {state.generatedLayout?.metrics?.totalRooms || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Rooms</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="justify-center">
                <Button size="lg" type="button" onClick={handleComplete}>
                  Enter Your Office
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
