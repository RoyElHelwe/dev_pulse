import { describe, expect, it } from 'vitest';
import { canDeleteTask, needsRebalance, RANK_GAP_MIN, rankBetween, taskKey, workspacePrefix } from './rules';

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

describe('rankBetween', () => {
  it('calculates midpoint between before and after', () => {
    expect(rankBetween(1, 2)).toBe(1.5);
    expect(rankBetween(1.2, 1.4)).toBeCloseTo(1.3);
  });

  it('handles null before (top of list)', () => {
    expect(rankBetween(null, 5)).toBe(4);
    expect(rankBetween(null, 1)).toBe(0);
  });

  it('handles null after (bottom of list)', () => {
    expect(rankBetween(5, null)).toBe(6);
    expect(rankBetween(1, null)).toBe(2);
  });

  it('returns 1 when both before and after are null', () => {
    expect(rankBetween(null, null)).toBe(1);
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
