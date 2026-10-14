import { RpcError } from '@/lib/data/rpc';
import { LOAD_MESSAGES, loadProblem } from '../loadError';

describe('loadProblem', () => {
  it('says offline when the browser knows it is offline', () => {
    expect(loadProblem(false, new RpcError(503))).toBe('offline');
    expect(LOAD_MESSAGES.offline).toMatch(/offline/);
  });

  it('blames the server for 5xx, timeouts and no answer while online', () => {
    expect(loadProblem(true, new RpcError(503))).toBe('server');
    expect(loadProblem(true, new RpcError(0, 'timeout'))).toBe('server');
    expect(loadProblem(true, new RpcError(0, 'network'))).toBe('server');
    expect(LOAD_MESSAGES.server).toBe("The server isn't responding. Try again in a minute.");
  });

  it('falls back to a plain message otherwise', () => {
    expect(loadProblem(true, new RpcError(401, 'no_session'))).toBe('other');
    expect(loadProblem(true, null)).toBe('other');
  });
});
