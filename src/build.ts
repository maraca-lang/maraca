import assign from './assign';
import combine from './combine';
import core, { streamMap } from './core';
import { toData } from './data';
import parse from './parse';
import { createIndexer } from './process';

const evalInContext = (library, code) =>
  new Function(...Object.keys(library), `return ${code}`)(
    ...Object.values(library),
  );

const build = (config, create, indexer, context, node) => {
  if (node.type === 'other') {
    const scope = context.scope[0];
    const keys = [node.key, node.value].map(
      n => n && build(config, create, indexer, context, n),
    );
    const otherMap = (list, key?) => (index, value) => {
      const values = [key, value];
      const subIndexer = createIndexer(index);
      const subContext = { scope: [scope], current: [list] };
      keys.forEach((key, i) => {
        if (key) {
          subContext.scope[0] = assign(
            create,
            subIndexer(),
            [subContext.scope[0], values[i], key],
            true,
            true,
          );
        }
      });
      const result = build(config, create, subIndexer, subContext, node.output);
      return [result, subContext.current[0]];
    };
    const other = otherMap([{ type: 'nil' }]);
    context.current[0] = streamMap(current => ({
      type: 'list',
      value: {
        ...(current.value || { indices: [], values: {} }),
        other: node.map ? otherMap : other,
        otherMap: node.map,
      },
    }))(create, indexer(), [context.current[0]]);
    return { type: 'nil' };
  }
  if (node.type === 'set') {
    if (
      !node.args[1] &&
      (node.args[0].type === 'set' || node.args[0].type === 'other')
    ) {
      return build(config, create, indexer, context, node.args[0]);
    }
    const args = node.args.map(n => build(config, create, indexer, context, n));
    context.scope[0] = assign(
      create,
      indexer(),
      [context.scope[0], ...args],
      node.unpack,
      true,
    );
    context.current[0] = assign(
      create,
      indexer(),
      [context.current[0], ...args],
      node.unpack,
      true,
    );
    return { type: 'nil' };
  }
  if (node.type === 'dynamic') {
    if (!config.dynamics[node.level - 1]) return { type: 'nil' };
    const arg = build(config, create, indexer, context, node.arg);
    return create(indexer(), config.dynamics[node.level - 1](arg));
  }
  if (node.type === 'core') {
    const args = node.args.map(n => build(config, create, indexer, context, n));
    return core[node.func](create, indexer(), args);
  }
  if (node.type === 'eval') {
    if (node.mode === '#') {
      return node.code.type === 'value'
        ? evalInContext(config.library, node.code.value)
        : { type: 'nil' };
    }
    const code = build(config, create, indexer, context, node.code);
    return streamMap(code => ({
      type: 'list',
      value: {
        indices: [],
        values: {},
        other: (index, value) => {
          const subIndexer = createIndexer(index);
          const subContext = { scope: [value], current: [{ type: 'nil' }] };
          let parsed = { type: 'nil' };
          try {
            parsed = parse(code.type === 'value' ? code.value : '');
          } catch (e) {
            console.log(e.message);
          }
          return [build(config, create, subIndexer, subContext, parsed)];
        },
      },
    }))(create, indexer(), [code]);
  }
  if (node.type === 'list') {
    if (node.bracket !== '[') {
      return build(config, create, indexer, context, {
        type: 'combine',
        args: [
          toData(
            node.bracket === '('
              ? node.values.filter(n => n.type !== 'other').length
              : 1,
          ),
          {
            type: 'list',
            bracket: '[',
            values: [
              { type: 'other', key: true, output: { type: 'nil' } },
              ...node.values,
            ],
          },
        ],
      });
    }
    context.scope.unshift(
      core.clearIndices(create, indexer(), [context.scope[0]]),
    );
    context.current.unshift(core.constant(create, indexer(), { type: 'nil' }));
    node.values.forEach(n =>
      build(config, create, indexer, context, { type: 'set', args: [n] }),
    );
    context.scope.shift();
    return context.current.shift();
  }
  if (node.type === 'combine') {
    const args = node.args.map(n => build(config, create, indexer, context, n));
    return args.reduce(
      (a1, a2) => combine(create, indexer(), [a1, a2], node.tight)[0],
    );
  }
  if (node.type === 'value') {
    return core.constant(create, indexer(), {
      type: 'value',
      value: node.value,
    });
  }
  if (node.type === 'nil') {
    return core.constant(create, indexer(), { type: 'nil' });
  }
  if (node.type === 'context') {
    return context.scope[0];
  }
};

export default build;
