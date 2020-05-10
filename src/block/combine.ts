import { print, toIndex } from '../data';
import { streamMap } from '../util';

import { cloneBlock, fromPairs, toPairs } from './util';
import set from './set';

const getIndexValue = (index, values, get) => {
  let countTrue = 0;
  let countFalse = 0;
  for (let i = 0; i < values.length; i++) {
    const result = get(values[i]);
    if (result.value) countTrue++;
    else countFalse++;
    if (countTrue === index) return result;
    if (countFalse > values.length - i) return null;
  }
};
const blockGet = (block, key, get) => {
  if (key.type === 'block') return block.func || { type: 'value', value: '' };
  const i = toIndex(key.value);
  if (i) {
    return (
      getIndexValue(i, block.indices, get) ||
      block.func || { type: 'value', value: '' }
    );
  }
  const k = print(key);
  const v = block.values[k] && block.values[k].value;
  return v || block.func || { type: 'value', value: '' };
};

const sortTypes = (v1, v2) => {
  if (v2.type === 'value') return [v1, v2];
  if (v1.type === 'value') return [v2, v1];
  if (v1.value.func) return [v1, v2];
  if (v2.value.func) return [v2, v1];
  return [null, null];
};

export const combineConfig = ([s1, s2]: any[], get) => {
  const [v1, v2] = [get(s1), get(s2)];
  if (v1.type === 'value' && v2.type === 'value') return ['nil'];
  const [big, small] = sortTypes(v1, v2);
  if (big === null && small === null) return ['nil'];
  const func = big.value.func;
  if (
    (small.type === 'block' && small.value.func) ||
    (!func && small.type === 'block') ||
    (func && func.isMap && small.type !== 'block')
  ) {
    return ['nil'];
  }
  if (func && func.isMap) return ['map', func, big, small, {}];
  return ['get', func, blockGet(big.value, small, get), small === v1 ? s1 : s2];
};

const runGet = (get, create, func, v, arg) => {
  if (func && (v === func || !get(v).value)) {
    return typeof func === 'function' ? func(create, arg)[0] : func;
  }
  return v;
};

const wrapStream = (create, x) =>
  x.type === 'stream' ? create(streamMap((get) => get(x))) : x;

export const combineRun = ([type, ...config]: any[], get, create) => {
  if (type === 'nil') return { type: 'value', value: '' };
  if (type === 'join') return config[0];
  if (type === 'get') {
    const [func, v, arg] = config;
    return wrapStream(create, runGet(get, create, func, v, arg));
  }
  const [func, big, small] = config;
  if (func.isPure) {
    return {
      type: 'block',
      value: fromPairs([
        ...toPairs(big.value),
        ...func(toPairs(small.value)).filter((d) => d.value.value),
      ]),
    };
  }
  const pairs = toPairs(small.value)
    .map(({ key, value }) => ({ key, value: get(value) }))
    .filter((d) => d.value.value);
  const base = cloneBlock(big.value);
  delete base.func;
  return pairs.reduce(
    (res, { key, value }) => {
      const map = func(key);
      const [newValue, newKey] = map(create, value);
      return create(
        streamMap((get) => {
          if (!get(newValue).value) return res;
          return set(false)([res, newValue, newKey], get);
        }),
      );
    },
    { type: 'block', value: base },
  );
};
