import { describe, expect, it } from 'vitest';
import { bandAt, quoteFare } from './pricing';

const ALL = { bags: true, cover: true, water: true };
const NONE = { bags: false, cover: false, water: false };
const at = (dayOffset: number, h: number, m = 0) => dayOffset * 1440 + h * 60 + m;

describe('quoteFare (DESIGN §5.8)', () => {
  it('prices the scenario ride at $31.95 with all amenities', () => {
    const q = quoteFare(22.4, at(1, 1, 55), ALL);
    expect(q.band).toBe('late');
    expect(q.minutes).toBe(30);
    expect(q.metered).toBe(18.5);
    expect(q.banded).toBe(27.75);
    expect(q.total).toBe(31.95);
  });

  it('prices the scenario ride at $28.95 with no amenities', () => {
    expect(quoteFare(22.4, at(1, 1, 55), NONE).total).toBe(28.95);
  });

  it('uses the peak band before midnight', () => {
    expect(bandAt(at(0, 23, 30))).toBe('peak');
    expect(quoteFare(22.4, at(0, 23, 30), NONE).minutes).toBe(45);
  });

  it('uses the normal band mid-day', () => {
    expect(bandAt(at(0, 13, 0))).toBe('normal');
  });
});
