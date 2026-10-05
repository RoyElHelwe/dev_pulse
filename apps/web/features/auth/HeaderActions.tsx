'use client';

import Link from 'next/link';
import { buttonStyles } from '@/components/ui/Button';
import { useAuth } from './AuthProvider';
import { UserMenu } from './UserMenu';

/** Right side of the home page header: sign-in buttons, or the user menu. */
export function HeaderActions() {
  const { status } = useAuth();
  if (status === 'loading') return <div className="h-8" />;
  if (status === 'signed-in') {
    return (
      <div className="flex items-center gap-2">
        <Link href="/office" className={buttonStyles('secondary', 'sm')}>
          Open the office
        </Link>
        <UserMenu />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Link href="/login" className={buttonStyles('ghost', 'sm')}>
        Sign in
      </Link>
      <Link href="/register" className={buttonStyles('primary', 'sm')}>
        Get started
      </Link>
    </div>
  );
}
