import { describe, expect, it } from 'vitest';
// @ts-expect-error: backend ESM
import { dedupeSnapshotsByInnNorm } from '../../../server/rpnRegistrySnapshot.js';

describe('dedupeSnapshotsByInnNorm', () => {
  it('оставляет одну строку на inn_norm, побеждает последняя', () => {
    const rows = [
      { innNorm: '7707083893', licenseNumber: 'FIRST' },
      { innNorm: '500100732259', licenseNumber: 'X' },
      { innNorm: '7707083893', licenseNumber: 'LAST' },
    ];
    const out = dedupeSnapshotsByInnNorm(rows);
    expect(out).toHaveLength(2);
    expect(out.find((r: { innNorm: string }) => r.innNorm === '7707083893')?.licenseNumber).toBe(
      'LAST',
    );
  });

  it('пропускает элементы без innNorm', () => {
    expect(dedupeSnapshotsByInnNorm([{}, { innNorm: '7707083893', x: 1 }])).toHaveLength(1);
  });
});
