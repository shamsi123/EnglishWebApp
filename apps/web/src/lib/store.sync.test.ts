import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  apiEnabled: true,
  register: vi.fn(),
  login: vi.fn(),
  createChild: vi.fn(),
  deleteChild: vi.fn(),
  submitQuiz: vi.fn(),
  submitAttemptsBatch: vi.fn(),
  setTokens: vi.fn(),
  setOnRefresh: vi.fn(),
}));
vi.mock('./api', () => apiMocks);

// Imported after the mock so the store binds to the mocked module.
const { useStore } = await import('./store');

const reset = () => {
  useStore.setState({ parent: null, parentSignedIn: false, backendAuth: null, children: [], activeChildId: null, data: {}, settings: {} });
  Object.values(apiMocks).forEach((fn) => typeof fn === 'function' && 'mockReset' in fn && fn.mockReset());
  apiMocks.createChild.mockResolvedValue({});
  apiMocks.deleteChild.mockResolvedValue(undefined);
};

describe('store <-> backend sync (mocked api module)', () => {
  beforeEach(reset);
  afterEach(() => vi.clearAllMocks());

  it('stores backend tokens after a successful register, but signs in locally either way', async () => {
    apiMocks.register.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', parentId: 'p1' });
    await useStore.getState().registerParent('Parent@Example.com', 'secret123');
    expect(useStore.getState().parentSignedIn).toBe(true);
    expect(useStore.getState().backendAuth).toEqual({ access: 'a', refresh: 'r' });
    expect(apiMocks.register).toHaveBeenCalledWith('parent@example.com', 'secret123', true);
  });

  it('still signs in locally when the backend is unreachable', async () => {
    apiMocks.register.mockRejectedValue(new Error('offline'));
    await useStore.getState().registerParent('a@b.com', 'secret123');
    expect(useStore.getState().parentSignedIn).toBe(true);
    expect(useStore.getState().backendAuth).toBeNull();
  });

  it('mirrors a new child to the backend once signed in there', async () => {
    apiMocks.register.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', parentId: 'p1' });
    await useStore.getState().registerParent('a@b.com', 'secret123');
    apiMocks.createChild.mockResolvedValue({});
    const id = useStore.getState().addChild({ nickname: 'Sara', ageBand: '4-6', avatar: { animal: '🦊', color: '#fff', item: 'none' }, pinHash: null, courses: ['ar'] });
    await Promise.resolve(); // let the fire-and-forget call settle
    expect(apiMocks.createChild).toHaveBeenCalledWith(expect.objectContaining({ id, nickname: 'Sara' }));
  });

  it('does not call the backend to create a child when signed in locally only', () => {
    useStore.getState().addChild({ nickname: 'Sara', ageBand: '4-6', avatar: { animal: '🦊', color: '#fff', item: 'none' }, pinHash: null, courses: ['ar'] });
    expect(apiMocks.createChild).not.toHaveBeenCalled();
  });

  it('upgrades a locally-missed mastery when the server confirms it, without touching the returned result', async () => {
    apiMocks.register.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', parentId: 'p1' });
    await useStore.getState().registerParent('a@b.com', 'secret123');
    const childId = useStore.getState().addChild({ nickname: 'Sara', ageBand: '4-6', avatar: { animal: '🦊', color: '#fff', item: 'none' }, pinHash: null, courses: ['ar'] });
    useStore.getState().selectChild(childId);

    apiMocks.submitQuiz.mockResolvedValue({ mastered: true, score: 1, stars: 3, missedItems: [], nextNodeId: null, newRewards: [] });
    const result = useStore.getState().completeCheck('ar-l1-u1-l1', [{ itemId: 'ar-letter-alif', correct: false }], null);
    expect(result.mastered).toBe(false); // the synchronous return is the client's own evaluation, unaffected

    await vi.waitFor(() => expect(useStore.getState().data[childId]!.lessons['ar-l1-u1-l1']!.status).toBe('mastered'));
    expect(useStore.getState().data[childId]!.lessons['ar-l1-u1-l1']!.stars).toBe(3);
  });

  it('never downgrades a lesson the client already mastered, even if the server disagrees', async () => {
    apiMocks.register.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', parentId: 'p1' });
    await useStore.getState().registerParent('a@b.com', 'secret123');
    const childId = useStore.getState().addChild({ nickname: 'Sara', ageBand: '4-6', avatar: { animal: '🦊', color: '#fff', item: 'none' }, pinHash: null, courses: ['ar'] });
    useStore.getState().selectChild(childId);

    apiMocks.submitQuiz.mockResolvedValue({ mastered: false, score: 0.4, stars: 0, missedItems: ['ar-letter-alif'], nextNodeId: null, newRewards: [] });
    const perfect = Array.from({ length: 5 }, () => ({ itemId: 'ar-letter-alif', correct: true }));
    useStore.getState().completeCheck('ar-l1-u1-l1', perfect, 0.9);
    await apiMocks.submitQuiz.mock.results[0]!.value.catch(() => {});
    await new Promise((r) => setTimeout(r, 0));
    expect(useStore.getState().data[childId]!.lessons['ar-l1-u1-l1']!.status).toBe('mastered');
  });

  it('flushQueue sends queued attempts and clears the accepted ones', async () => {
    apiMocks.register.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', parentId: 'p1' });
    await useStore.getState().registerParent('a@b.com', 'secret123');
    const childId = useStore.getState().addChild({ nickname: 'Sara', ageBand: '4-6', avatar: { animal: '🦊', color: '#fff', item: 'none' }, pinHash: null, courses: ['ar'] });
    useStore.getState().selectChild(childId);
    useStore.getState().recordAnswer('act-1', 'ar-letter-alif', true);
    expect(useStore.getState().data[childId]!.queue).toHaveLength(1);

    apiMocks.submitAttemptsBatch.mockImplementation(async (batch: { id: string }[]) => ({ acceptedIds: batch.map((a) => a.id) }));
    await useStore.getState().flushQueue();
    expect(useStore.getState().data[childId]!.queue).toHaveLength(0);
    expect(apiMocks.submitAttemptsBatch).toHaveBeenCalledTimes(1);
  });

  it('flushQueue is a no-op without a backend session', async () => {
    const childId = useStore.getState().addChild({ nickname: 'Sara', ageBand: '4-6', avatar: { animal: '🦊', color: '#fff', item: 'none' }, pinHash: null, courses: ['ar'] });
    useStore.getState().selectChild(childId);
    useStore.getState().recordAnswer('act-1', 'ar-letter-alif', true);
    await useStore.getState().flushQueue();
    expect(apiMocks.submitAttemptsBatch).not.toHaveBeenCalled();
    expect(useStore.getState().data[childId]!.queue).toHaveLength(1);
  });
});
