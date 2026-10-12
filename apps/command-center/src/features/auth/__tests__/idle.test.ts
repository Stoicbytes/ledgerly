import { IDLE_TIMEOUT_MS, IDLE_WARNING_MS, idlePhase, idleTimeoutMs } from '../idle';

describe('idlePhase', () => {
  const start = 1_000_000;
  it('is active until the warning window', () => {
    expect(idlePhase(start, start)).toBe('active');
    expect(idlePhase(start + IDLE_TIMEOUT_MS - IDLE_WARNING_MS - 1, start)).toBe('active');
  });
  it('warns in the last two minutes', () => {
    expect(idlePhase(start + IDLE_TIMEOUT_MS - IDLE_WARNING_MS, start)).toBe('warning');
    expect(idlePhase(start + IDLE_TIMEOUT_MS - 1, start)).toBe('warning');
  });
  it('expires at the limit, including time spent in the background', () => {
    expect(idlePhase(start + IDLE_TIMEOUT_MS, start)).toBe('expired');
    expect(idlePhase(start + 5 * IDLE_TIMEOUT_MS, start)).toBe('expired');
  });
});

describe('idleTimeoutMs', () => {
  it('never signs out on a kept device on Auto, 30 minutes otherwise', () => {
    expect(idleTimeoutMs('auto', true)).toBeNull();
    expect(idleTimeoutMs('auto', false)).toBe(IDLE_TIMEOUT_MS);
  });
  it('follows an explicit choice on any device', () => {
    expect(idleTimeoutMs('15', true)).toBe(15 * 60_000);
    expect(idleTimeoutMs('480', false)).toBe(480 * 60_000);
    expect(idleTimeoutMs('never', false)).toBeNull();
  });
  it('warns two minutes before even a short limit', () => {
    const limit = 15 * 60_000;
    expect(idlePhase(13 * 60_000 - 1, 0, limit)).toBe('active');
    expect(idlePhase(13 * 60_000, 0, limit)).toBe('warning');
  });
});
