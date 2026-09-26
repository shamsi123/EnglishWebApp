import { enqueue, flush, type ActivityAttempt } from './syncQueue';

const attempt = (id: string): ActivityAttempt => ({
  id, childId: 'c', activityId: 'a', lessonId: 'l', itemId: 'i', isCorrect: true, createdAtUtc: '2026-09-26T10:00:00Z',
});

describe('sync queue', () => {
  it('ignores duplicate attempt ids', () => {
    const q = enqueue(enqueue([], attempt('1')), attempt('1'));
    expect(q).toHaveLength(1);
  });

  it('removes accepted attempts after a flush', async () => {
    const q = [attempt('1'), attempt('2'), attempt('3')];
    const left = await flush(q, async (batch) => ({ acceptedIds: batch.map((a) => a.id) }), 2);
    expect(left).toEqual([]);
  });

  it('keeps attempts when the network fails', async () => {
    const q = [attempt('1'), attempt('2'), attempt('3')];
    let calls = 0;
    const left = await flush(q, async (batch) => {
      calls++;
      if (calls > 1) throw new Error('offline');
      return { acceptedIds: batch.map((a) => a.id) };
    }, 2);
    expect(left.map((a) => a.id)).toEqual(['3']);
  });

  it('keeps attempts the server did not accept', async () => {
    const left = await flush([attempt('1'), attempt('2')], async () => ({ acceptedIds: ['2'] }));
    expect(left.map((a) => a.id)).toEqual(['1']);
  });
});
