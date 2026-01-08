'use client';

/**
 * AI Configuration Form
 * 
 * Form for configuring AI-assisted office layout generation.
 * Collects team info, work culture, and preferences.
 */

import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Trash2, 
  Users, 
  Building2, 
  Sparkles,
  Loader2 
} from 'lucide-react';

// Form validation schema
const departmentSchema = z.object({
  name: z.string().min(1, 'Department name is required'),
  size: z.number().min(1).max(50),
  needsPrivacy: z.boolean(),
});

const aiFormSchema = z.object({
  teamSize: z.number().min(1).max(200),
  departments: z.array(departmentSchema).min(1),
  workCulture: z.enum(['startup', 'corporate', 'creative', 'hybrid', 'remote-first']),
  collaborationLevel: z.enum(['high', 'medium', 'low']),
  remotePercentage: z.number().min(0).max(100),
  deskSharing: z.boolean(),
  flexibleSeating: z.boolean(),
  features: z.object({
    meetingRooms: z.number().min(0).max(10),
    phoneBooths: z.number().min(0).max(10),
    breakArea: z.boolean(),
    cafeteria: z.boolean(),
    reception: z.boolean(),
    hotDesks: z.boolean(),
  }),
  preferences: z.object({
    naturalLight: z.boolean(),
    openPlan: z.boolean(),
    quietZones: z.boolean(),
    collaborationSpaces: z.boolean(),
  }),
});

export type AIFormValues = z.infer<typeof aiFormSchema>;

interface AIConfigFormProps {
  initialTeamSize?: number;
  onSubmit: (values: AIFormValues) => void;
  isLoading?: boolean;
}

const workCultureOptions = [
  { value: 'startup', label: 'Startup', description: 'Fast-paced, open, collaborative' },
  { value: 'corporate', label: 'Corporate', description: 'Structured, professional, organized' },
  { value: 'creative', label: 'Creative Agency', description: 'Inspiring, flexible, unique' },
  { value: 'hybrid', label: 'Hybrid', description: 'Balanced mix of styles' },
  { value: 'remote-first', label: 'Remote-First', description: 'Flexible, hot-desk focused' },
];

const collaborationOptions = [
  { value: 'high', label: 'High', description: 'Lots of team interaction' },
  { value: 'medium', label: 'Medium', description: 'Balanced collaboration' },
  { value: 'low', label: 'Low', description: 'Individual focused work' },
];

export function AIConfigForm({ 
  initialTeamSize = 10, 
  onSubmit,
  isLoading = false 
}: AIConfigFormProps) {
  const form = useForm<AIFormValues>({
    resolver: zodResolver(aiFormSchema),
    defaultValues: {
      teamSize: initialTeamSize,
      departments: [
        { name: 'General', size: initialTeamSize, needsPrivacy: false },
      ],
      workCulture: 'startup',
      collaborationLevel: 'medium',
      remotePercentage: 20,
      deskSharing: false,
      flexibleSeating: false,
      features: {
        meetingRooms: 2,
        phoneBooths: 1,
        breakArea: true,
        cafeteria: false,
        reception: false,
        hotDesks: false,
      },
      preferences: {
        naturalLight: true,
        openPlan: true,
        quietZones: true,
        collaborationSpaces: true,
      },
    },
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'departments',
  });
  
  const watchTeamSize = form.watch('teamSize');
  const watchWorkCulture = form.watch('workCulture');
  
  // Auto-suggest features based on team size
  React.useEffect(() => {
    const size = watchTeamSize;
    form.setValue('features.meetingRooms', Math.max(1, Math.floor(size / 10)));
    form.setValue('features.phoneBooths', Math.max(0, Math.floor(size / 15)));
    form.setValue('features.cafeteria', size >= 30);
    form.setValue('features.reception', size >= 20);
  }, [watchTeamSize, form]);
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Team Size Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Team Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="teamSize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Team Size</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-4">
                      <Slider
                        min={1}
                        max={100}
                        step={1}
                        value={[field.value]}
                        onValueChange={(v) => field.onChange(v[0])}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        className="w-20"
                        value={field.value}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Number of people who will use the office
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Departments */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel>Departments</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ name: '', size: 5, needsPrivacy: false })}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Department
                </Button>
              </div>
              
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <FormField
                    control={form.control}
                    name={`departments.${index}.name`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input placeholder="Department name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name={`departments.${index}.size`}
                    render={({ field }) => (
                      <FormItem className="w-24">
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="Size"
                            value={field.value}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name={`departments.${index}.needsPrivacy`}
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="text-xs whitespace-nowrap">
                          Privacy
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Work Culture Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5" />
              Work Culture
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="workCulture"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Office Style</FormLabel>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {workCultureOptions.map((option) => (
                      <div
                        key={option.value}
                        className={`
                          p-4 border rounded-lg cursor-pointer transition-all
                          ${field.value === option.value 
                            ? 'border-primary bg-primary/5' 
                            : 'hover:border-primary/50'}
                        `}
                        onClick={() => field.onChange(option.value)}
                      >
                        <p className="font-medium">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="collaborationLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Collaboration Level</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select collaboration level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {collaborationOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div>
                            <span className="font-medium">{option.label}</span>
                            <span className="text-muted-foreground ml-2">
                              - {option.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="remotePercentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remote Work Percentage</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-4">
                      <Slider
                        min={0}
                        max={100}
                        step={5}
                        value={[field.value]}
                        onValueChange={(v) => field.onChange(v[0])}
                        className="flex-1"
                      />
                      <Badge variant="outline" className="w-16 justify-center">
                        {field.value}%
                      </Badge>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Percentage of team that works remotely on average
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="deskSharing"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Desk Sharing</FormLabel>
                      <FormDescription className="text-xs">
                        Multiple people share desks
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="flexibleSeating"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Flexible Seating</FormLabel>
                      <FormDescription className="text-xs">
                        No assigned desks
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Features Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Office Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="features.meetingRooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meeting Rooms</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        value={field.value}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="features.phoneBooths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Booths</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        value={field.value}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="features.breakArea"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 rounded-lg border p-3">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="text-sm">Break Area</FormLabel>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="features.cafeteria"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 rounded-lg border p-3">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="text-sm">Cafeteria</FormLabel>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="features.reception"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 rounded-lg border p-3">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="text-sm">Reception</FormLabel>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="features.hotDesks"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 rounded-lg border p-3">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="text-sm">Hot Desks</FormLabel>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Preferences Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Space Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="preferences.naturalLight"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Natural Light Priority</FormLabel>
                      <FormDescription className="text-xs">
                        Optimize desk placement for windows
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="preferences.openPlan"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Open Plan</FormLabel>
                      <FormDescription className="text-xs">
                        Fewer walls, more open space
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="preferences.quietZones"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Quiet Zones</FormLabel>
                      <FormDescription className="text-xs">
                        Dedicated focus areas
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="preferences.collaborationSpaces"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Collaboration Spaces</FormLabel>
                      <FormDescription className="text-xs">
                        Open areas for teamwork
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Submit Button */}
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Office Layout
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
