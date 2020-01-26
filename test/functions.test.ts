import maraca from '../src/index';
import List from '../src/list';

test('basic', () => {
  expect(maraca('z.[x: a, y: b, => c]')).toEqual({ type: 'value', value: 'c' });
  expect(maraca('10.[v=> v? + 5]')).toEqual({ type: 'value', value: '15' });
  expect(maraca('[1, 2].[[x, y]=> x? + y?]')).toEqual({
    type: 'value',
    value: '3',
  });
});

test('maps', () => {
  expect(maraca('[5, 10].[v=> k=> [v?, k?]]')).toEqual({
    type: 'list',
    value: List.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: {
          type: 'list',
          value: List.fromPairs([
            {
              key: { type: 'value', value: '1' },
              value: { type: 'value', value: '5' },
            },
            {
              key: { type: 'value', value: '2' },
              value: { type: 'value', value: '1' },
            },
          ] as any),
        },
      },
      {
        key: { type: 'value', value: '2' },
        value: {
          type: 'list',
          value: List.fromPairs([
            {
              key: { type: 'value', value: '1' },
              value: { type: 'value', value: '10' },
            },
            {
              key: { type: 'value', value: '2' },
              value: { type: 'value', value: '2' },
            },
          ] as any),
        },
      },
    ] as any),
  });
  expect(maraca('[5, 10].[v=>> v? + 5]')).toEqual({
    type: 'list',
    value: List.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: '10' },
      },
      {
        key: { type: 'value', value: '2' },
        value: { type: 'value', value: '15' },
      },
    ] as any),
  });
  expect(maraca('[a, b].[v=>> Item {v?}: v?]')).toEqual({
    type: 'list',
    value: List.fromPairs([
      {
        key: { type: 'value', value: 'Item a' },
        value: { type: 'value', value: 'a' },
      },
      {
        key: { type: 'value', value: 'Item b' },
        value: { type: 'value', value: 'b' },
      },
    ] as any),
  });
  expect(maraca('[1, 2, 3].[sum: 0, v=>> sum: sum? + v?]')).toEqual({
    type: 'list',
    value: List.fromPairs([
      {
        key: { type: 'value', value: 'sum' },
        value: { type: 'value', value: '6', set: expect.any(Function) },
      },
    ] as any),
  });
  expect(maraca('1.[v=>> v? + 1]')).toEqual({ type: 'value', value: '' });
});
