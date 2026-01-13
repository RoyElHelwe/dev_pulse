'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from 'lucide-react';
import { CreateSprintDto } from '@/lib/types/task';

interface SprintCreateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (dto: CreateSprintDto) => Promise<void>;
}

export function SprintCreateForm({ open, onOpenChange, onSubmit }: SprintCreateFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateSprintDto>({
    name: '',
    goal: '',
    startDate: '',
    endDate: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
      onOpenChange(false);
      // Reset form
      setFormData({
        name: '',
        goal: '',
        startDate: '',
        endDate: '',
      });
    } catch (error) {
      console.error('Failed to create sprint:', error);
    } finally {
      setLoading(false);
    }
  };

  // Dispatch events to disable/enable keyboard
  React.useEffect(() => {
    if (open) {
      window.dispatchEvent(new CustomEvent('dialog-opened'));
    } else {
      window.dispatchEvent(new CustomEvent('dialog-closed'));
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Create New Sprint
          </DialogTitle>
          <DialogDescription>
            Set up a new sprint with goals and timeframe. Sprints help organize work into focused cycles.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Sprint Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Sprint Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Sprint 1: Authentication"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            {/* Sprint Goal */}
            <div className="space-y-2">
              <Label htmlFor="goal">Sprint Goal</Label>
              <Textarea
                id="goal"
                placeholder="What do you want to achieve in this sprint?"
                value={formData.goal || ''}
                onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                rows={3}
              />
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  min={formData.startDate}
                  required
                />
              </div>
            </div>

            {/* Duration Info */}
            {formData.startDate && formData.endDate && (
              <div className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <span className="font-medium">Duration:</span>{' '}
                {Math.ceil(
                  (new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) /
                    (1000 * 60 * 60 * 24)
                )}{' '}
                days
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Sprint'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
