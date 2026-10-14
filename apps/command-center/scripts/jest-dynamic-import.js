/**
 * Tests only: turns `import('x')` into `Promise.resolve().then(() => require('x'))`. The app
 * loads some code on demand with import() (Metro splits it into its own file); Jest's
 * CommonJS runtime cannot run a native import() without experimental flags.
 */
module.exports = ({ types: t }) => ({
  name: 'jest-dynamic-import',
  visitor: {
    CallExpression(path) {
      if (path.node.callee.type !== 'Import') return;
      const resolved = t.callExpression(
        t.memberExpression(t.identifier('Promise'), t.identifier('resolve')),
        [],
      );
      const load = t.arrowFunctionExpression(
        [],
        t.callExpression(t.identifier('require'), path.node.arguments),
      );
      path.replaceWith(
        t.callExpression(t.memberExpression(resolved, t.identifier('then')), [load]),
      );
    },
  },
});
