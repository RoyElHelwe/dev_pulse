/** Unit tests for task business rules: issue prefixes, key formatting, deletion rights, and rank gaps. */
import { describe, expect, it } from 'vitest';
import { canDeleteTask, needsRebalance, RANK_GAP_MIN, taskKey, workspacePrefix } from './tasks.rules';

describe('workspacePrefix', () => {
  it('takes initials of multi-word names up to 4 characters', () => {
    expect(workspacePrefix('Acme Rocket Co')).toBe('ARC');
    expect(workspacePrefix('Dev Pulse')).toBe('DP');
    expect(workspacePrefix('Acme Rocket Company Global')).toBe('ARCG');
    expect(workspacePrefix('Acme Rocket Company Global Enterprise')).toBe('ARCG');
  });

  it('uses first 3 characters for single-word names', () => {
    expect(workspacePrefix('Zakaria')).toBe('ZAK');
    expect(workspacePrefix('Rocket')).toBe('ROC');
  });

  it('handles short words and falls back to WS', () => {
    expect(workspacePrefix('Go')).toBe('GO');
    expect(workspacePrefix('A')).toBe('WS');
    expect(workspacePrefix('')).toBe('WS');
    expect(workspacePrefix('   ')).toBe('WS');
    expect(workspacePrefix('---')).toBe('WS');
    expect(workspacePrefix('!@#$%^')).toBe('WS');
  });

  it('handles alphanumeric separators cleanly', () => {
    expect(workspacePrefix('Dev-Pulse')).toBe('DP');
    expect(workspacePrefix('Alpha_Beta_Gamma')).toBe('ABG');
  });
});

describe('taskKey', () => {
  it('combines prefix and task number', () => {
    expect(taskKey('DP', 1)).toBe('DP-1');
    expect(taskKey('ARC', 42)).toBe('ARC-42');
  });
});

describe('canDeleteTask', () => {
  it('allows OWNER and ADMIN regardless of reporter', () => {
    expect(canDeleteTask('OWNER', 'user-1', 'user-2')).toBe(true);
    expect(canDeleteTask('ADMIN', 'user-1', 'user-2')).toBe(true);
  });

  it('allows MEMBER if they are the reporter', () => {
    expect(canDeleteTask('MEMBER', 'user-1', 'user-1')).toBe(true);
  });

  it('rejects MEMBER if they are not the reporter', () => {
    expect(canDeleteTask('MEMBER', 'user-1', 'user-2')).toBe(false);
  });
});

describe('needsRebalance', () => {
  it('returns true when gap is smaller than RANK_GAP_MIN or identical', () => {
    expect(needsRebalance(1.0, 1.0)).toBe(true);
    expect(needsRebalance(1.0, 1.0 + RANK_GAP_MIN / 2)).toBe(true);
  });

  it('returns false when gap is larger than or equal to RANK_GAP_MIN', () => {
    expect(needsRebalance(1.0, 1.0 + RANK_GAP_MIN * 2)).toBe(false);
    expect(needsRebalance(1.0, 2.0)).toBe(false);
  });
});
