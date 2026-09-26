import en from './locales/en.json';
import ar from './locales/ar.json';

const keys = (o: object, prefix = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

it('Arabic UI strings cover every English key', () => {
  expect(keys(ar).sort()).toEqual(keys(en).sort());
});
