'use client';

/**
 * Scrollable listbox container rendering selectable options for the people picker.
 * Used inside PeoplePicker to manage virtualization, empty state, and item options.
 */

import { PeoplePickerOption, type PickerItem } from './PeoplePickerOption';

/** Filter items, keyboard focus state, DOM refs, and selection callbacks for the people listbox container. */
export interface PeoplePickerListProps {
  items: PickerItem[];
  filterAssignees: string[];
  activeIndex: number;
  baseId: string;
  listRef: React.RefObject<HTMLDivElement | null>;
  itemRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
  isLazy: boolean;
  onToggleAssignee(id: string): void;
  onSetActiveIndex(index: number): void;
}

/** Renders the listbox container displaying member options or an empty state message. */
export function PeoplePickerList({
  items,
  filterAssignees,
  activeIndex,
  baseId,
  listRef,
  itemRefs,
  isLazy,
  onToggleAssignee,
  onSetActiveIndex,
}: PeoplePickerListProps) {
  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="People"
      className="max-h-80 overflow-y-auto divide-y divide-zinc-50 py-1"
    >
      {items.length === 0 ? (
        <div className="py-8 text-center text-xs text-zinc-500">
          No people match
        </div>
      ) : (
        items.map((item, index) => (
          <PeoplePickerOption
            key={item.id}
            id={`${baseId}-item-${item.id}`}
            item={item}
            isSelected={filterAssignees.includes(item.id)}
            isActive={index === activeIndex}
            lazy={isLazy}
            containerRef={listRef}
            buttonRef={(el) => {
              itemRefs.current[index] = el;
            }}
            onSelect={() => onToggleAssignee(item.id)}
            onHover={() => onSetActiveIndex(index)}
          />
        ))
      )}
    </div>
  );
}
