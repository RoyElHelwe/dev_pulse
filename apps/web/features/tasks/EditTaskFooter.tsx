'use client';

/**
 * Footer controls for the task editing dialog, including deletion, saving, and audit metadata.
 * Rendered at the bottom of EditTaskDialog.
 */

import { Button } from '@/components/ui/Button';

export interface EditTaskFooterProps {
  canDelete: boolean;
  confirmDelete: boolean;
  onConfirmDeleteChange(confirm: boolean): void;
  onDelete(): void;
  canSave: boolean;
  saving: boolean;
  onClose(): void;
  reporterName: string;
  createdDate: string;
  updatedDate: string;
}

/** Renders the dialog footer with delete confirmation, action buttons, and author metadata. */
export function EditTaskFooter({
  canDelete,
  confirmDelete,
  onConfirmDeleteChange,
  onDelete,
  canSave,
  saving,
  onClose,
  reporterName,
  createdDate,
  updatedDate,
}: EditTaskFooterProps) {
  return (
    <div className="mt-6 border-t border-zinc-100 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {canDelete &&
            (confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600">Delete this issue?</span>
                <Button
                  type="button"
                  size="sm"
                  className="bg-red-600 text-white shadow-xs hover:bg-red-700 focus-visible:outline-red-600"
                  onClick={onDelete}
                  disabled={saving}
                  loading={saving}
                >
                  Yes, delete
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onConfirmDeleteChange(false)}
                  disabled={saving}
                >
                  Keep
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => onConfirmDeleteChange(true)}
                disabled={saving}
              >
                Delete
              </Button>
            ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!canSave}
            loading={saving}
          >
            Save
          </Button>
        </div>
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        Reported by {reporterName} - Created {createdDate} - Updated {updatedDate}
      </p>
    </div>
  );
}
