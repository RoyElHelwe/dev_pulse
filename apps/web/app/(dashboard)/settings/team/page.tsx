'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AppLayout } from '@/components/layout/app-layout';

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface Workspace {
  id: string;
  name: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function TeamSettingsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchWorkspaceAndInvitations();
  }, []);

  const fetchWorkspaceAndInvitations = async () => {
    try {
      // Get workspace status
      const statusRes = await fetch(`${API_BASE_URL}/workspaces/status`, {
        credentials: 'include',
      });
      const statusData = await statusRes.json();

      if (statusData.hasWorkspace && statusData.workspace) {
        setWorkspace(statusData.workspace);

        // Fetch invitations
        const invitesRes = await fetch(
          `${API_BASE_URL}/invitations/workspace/${statusData.workspace.id}`,
          { credentials: 'include' }
        );
        if (invitesRes.ok) {
          const invitesData = await invitesRes.json();
          setInvitations(invitesData);
        }
      }
    } catch (err) {
      console.error('Failed to fetch workspace data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setInviting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/invitations/${workspace?.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to send invitation');
      }

      setSuccess(`Invitation sent to ${email}`);
      setEmail('');
      setRole('MEMBER');
      fetchWorkspaceAndInvitations();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/invitations/${invitationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to cancel invitation');
      }

      fetchWorkspaceAndInvitations();
    } catch (err) {
      console.error('Failed to cancel invitation:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!workspace) {
    return (
      <AppLayout>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">No Workspace Found</h2>
          <p className="text-muted-foreground">
            You need to create a workspace first.
          </p>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Team Management</h1>

      {/* Invite Member Form */}
      <Card className="p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Invite Team Member</h2>
        <form onSubmit={handleInvite} className="space-y-4">
          <FormField label="Email Address" htmlFor="email" required>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              required
            />
          </FormField>

          <FormField label="Role" htmlFor="role">
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="MEMBER">Member</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
          </FormField>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}

          <Button type="submit" disabled={inviting} className="w-full">
            {inviting ? 'Sending...' : 'Send Invitation'}
          </Button>
        </form>
      </Card>

      {/* Pending Invitations */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Pending Invitations</h2>
        {invitations.length === 0 ? (
          <p className="text-gray-500">No pending invitations</p>
        ) : (
          <div className="space-y-3">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
              >
                <div>
                  <p className="font-medium">{invitation.email}</p>
                  <p className="text-sm text-gray-500">
                    Role: {invitation.role} • Expires:{' '}
                    {new Date(invitation.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCancelInvitation(invitation.id)}
                >
                  Cancel
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
      </div>
    </AppLayout>
  );
}
