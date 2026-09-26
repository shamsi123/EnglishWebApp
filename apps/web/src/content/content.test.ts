import { arabicCourse, arabicItems, journeyNodes } from './course';
import { itemsFileSchema, courseSchema } from './schema';
import courseJson from '@content/arabic/level-1/course.json';
import itemsJson from '@content/arabic/level-1/items.json';

describe('Arabic Level 1 content', () => {
  it('validates against the schemas', () => {
    expect(() => itemsFileSchema.parse(itemsJson)).not.toThrow();
    expect(() => courseSchema.parse(courseJson)).not.toThrow();
  });

  it('teaches all 28 letters exactly once', () => {
    const taught = arabicCourse.levels.flatMap((l) => l.units.flatMap((u) => u.lessons.flatMap((x) => x.newItems)));
    expect(taught).toHaveLength(28);
    expect(new Set(taught).size).toBe(28);
  });

  it('references only known items and every item has audio', () => {
    const ids = new Set(arabicItems.map((i) => i.id));
    for (const level of arabicCourse.levels)
      for (const unit of level.units)
        for (const lesson of unit.lessons) [...lesson.newItems, ...lesson.reviewItems].forEach((id) => expect(ids).toContain(id));
    arabicItems.forEach((i) => expect(i.audio).toMatch(/^ar\/letters\/.+\.mp3$/));
  });

  it('uses the <lang>-l<level>-u<unit>-l<lesson> id pattern and 8 units', () => {
    expect(arabicCourse.levels[0]!.units).toHaveLength(8);
    journeyNodes('ar')
      .filter((n) => n.kind === 'lesson')
      .forEach((n) => expect(n.id).toMatch(/^ar-l1-u\d-l\d$/));
  });

  it('every example word contains its letter', () => {
    for (const item of arabicItems) {
      const plain = item.example.plain.replace(/[أإآ]/g, 'ا');
      expect(plain).toContain(item.glyph);
    }
  });
});
