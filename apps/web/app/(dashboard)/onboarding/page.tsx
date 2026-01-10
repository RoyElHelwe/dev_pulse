'use client'

import { OnboardingWizard } from '@/components/game/OnboardingWizard'
import { useRouter } from 'next/navigation'
import { OfficeLayoutData } from '@/lib/game/generators'
import { useCallback } from 'react'

export default function OnboardingPage() {
  const router = useRouter()

  const handleComplete = useCallback(async (layout: OfficeLayoutData, teamInfo: { workspaceName: string; teamSize: number; departments: Array<{ name: string; size: number }> }) => {
    console.log('Office layout generated:', layout)
    console.log('Team info:', teamInfo)
    
    try {
      // Create workspace via API with unique slug
      const timestamp = Date.now();
      
      console.log('Creating workspace...')
      const workspaceRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: `${teamInfo.workspaceName} (${timestamp})`,
          teamSize: teamInfo.teamSize,
          roles: teamInfo.departments.map(dept => ({
            role: dept.name.toLowerCase(),
            count: dept.size,
          })),
        }),
      })

      console.log('Workspace response status:', workspaceRes.status)
      
      if (!workspaceRes.ok) {
        const errorText = await workspaceRes.text()
        console.error('Failed to create workspace:', errorText)
        throw new Error('Failed to create workspace')
      }

      const workspaceData = await workspaceRes.json()
      console.log('Workspace data:', workspaceData)
      const workspaceId = workspaceData.workspace?.id || workspaceData.id

      console.log('Workspace created with ID:', workspaceId)

      // Save office layout to the workspace via API
      console.log('Saving office layout...')
      console.log('Layout to save:', layout)
      
      // Determine generation mode based on whether a template was used
      const generationMode = layout.templateId ? 'TEMPLATE' : 'AI_AUTO';
      
      const layoutRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/workspaces/${workspaceId}/office/layout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: `${teamInfo.workspaceName} Office`,
            generationMode,
            templateId: layout.templateId,
            layoutData: {
              // Support both old and new layout formats
              metadata: layout.metadata || {
                version: '1.0.0',
                generatedAt: new Date().toISOString(),
                mode: generationMode,
                teamSize: teamInfo.teamSize,
                templateId: layout.templateId,
              },
              dimensions: layout.dimensions || { 
                width: layout.width || 1600, 
                height: layout.height || 900 
              },
              zones: layout.zones || [],
              desks: layout.desks || [],
              rooms: layout.rooms || [],
              decorations: layout.decorations || [],
              walls: layout.walls || [],
              spawnPoints: layout.spawnPoints || (layout.spawnPoint ? [{
                id: 'spawn-default',
                position: { x: layout.spawnPoint.x, y: layout.spawnPoint.y },
                type: 'default',
              }] : [{ id: 'spawn-default', position: { x: 400, y: 300 }, type: 'default' }]),
              pathways: layout.pathways || [],
            },
          }),
        }
      )

      console.log('Layout response status:', layoutRes.status)

      if (layoutRes.ok) {
        console.log('Office layout saved successfully')
      } else {
        const errorText = await layoutRes.text()
        console.warn('Failed to save office layout:', errorText)
      }

      // Navigate to office
      // console.log('Navigating to office...')
      // window.location.href = '/office'
    } catch (error) {
      console.error('Error during onboarding completion:', error)
      alert('Failed to create workspace. Please try again.')
    }
  }, [])

  const handleSkip = useCallback(() => {
    try {
      window.location.href = '/dashboard'
    } catch (error) {
      console.error('Navigation error:', error)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <OnboardingWizard 
        workspaceId="temp-workspace-id"
        workspaceName="My Workspace"
        onComplete={handleComplete}
        onSkip={handleSkip}
      />
    </div>
  )
}
