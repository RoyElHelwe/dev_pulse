'use client'

import { Card } from '@/components/ui/card'
import { ShieldIcon, UsersIcon, SettingsIcon } from '@/components/ui/icons'
import Link from 'next/link'

const settingsItems = [
  {
    title: 'Security',
    description: 'Two-factor authentication, sessions, and security settings',
    href: '/settings/security',
    icon: ShieldIcon,
  },
]

export default function SettingsPage() {
  return (
    <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground mb-8">
          Manage your account and workspace settings
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {settingsItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="p-6 hover:bg-accent/50 transition-colors cursor-pointer h-full">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
  )
}
