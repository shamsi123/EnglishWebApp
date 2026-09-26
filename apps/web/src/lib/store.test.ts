import { useStore } from './store';

describe('store: quiz completion', () => {
  beforeEach(() => {
    useStore.setState({ children: [], data: {}, settings: {}, activeChildId: null });
    const id = useStore.getState().addChild({ nickname: 'T', ageBand: '4-6', avatar: { animal: '🦊', color: '#fff', item: 'none' }, pinHash: null, courses: ['ar'] });
    useStore.getState().selectChild(id);
  });

  const child = () => useStore.getState().data[useStore.getState().activeChildId!]!;

  it('masters the lesson, awards stars and moves each item one Leitner box', () => {
    const ok = { itemId: 'ar-letter-alif', correct: true };
    const result = useStore.getState().completeCheck('ar-l1-u1-l1', [ok, ok, ok, ok, ok], 0.9);
    expect(result.mastered).toBe(true);
    expect(child().lessons['ar-l1-u1-l1']).toMatchObject({ status: 'mastered', stars: 3 });
    expect(child().items['ar-letter-alif']!.box).toBe(2);
  });

  it('keeps the lesson open and resets missed items to box 1 when the check is not passed', () => {
    const result = useStore.getState().completeCheck(
      'ar-l1-u1-l1',
      [{ itemId: 'ar-letter-alif', correct: false }, { itemId: 'ar-letter-alif', correct: true }],
      0.9,
    );
    expect(result.mastered).toBe(false);
    expect(child().lessons['ar-l1-u1-l1']!.status).toBe('in_progress');
    expect(child().items['ar-letter-alif']!.box).toBe(1);
  });

  it('awards the unit sticker when the checkpoint is passed', () => {
    const ids = ['ar-letter-alif', 'ar-letter-ba', 'ar-letter-ta', 'ar-letter-tha'];
    useStore.getState().completeCheck('ar-l1-u1-cp', ids.map((itemId) => ({ itemId, correct: true })), null);
    expect(child().stickers).toContain('ar-l1-u1');
  });

  it('deleting a child removes all of its data', () => {
    const id = useStore.getState().activeChildId!;
    useStore.getState().recordAnswer('a', 'ar-letter-alif', true);
    useStore.getState().deleteChild(id);
    const s = useStore.getState();
    expect(s.data[id]).toBeUndefined();
    expect(s.settings[id]).toBeUndefined();
    expect(s.children).toHaveLength(0);
  });
});
