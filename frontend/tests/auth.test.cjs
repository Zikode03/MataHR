const { compile } = require('./register-typescript.cjs');
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  Module = require('node:module');

test('password reset renders a form only for complete links without printing the token', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { MemoryRouter } = require('react-router-dom');
  const { PasswordResetPage } = require('../src/features/auth/PasswordResetPage.tsx');
  const render = (entry) =>
    renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: [entry] },
        React.createElement(PasswordResetPage),
      ),
    );
  assert.match(render('/reset-password'), /reset link is incomplete/);
  const complete = render(
    '/reset-password?tenantId=00000000-0000-0000-0000-000000000001&email=user%40example.invalid&token=example-reset-secret',
  );
  assert.match(complete, /Confirm new password/);
  assert.doesNotMatch(complete, /example-reset-secret/);
});
function host(authenticate) {
  const filename = path.resolve(__dirname, '../src/features/auth/LoginPage.tsx'),
    mod = new Module(filename, module),
    base = Module.createRequire(filename),
    slots = [];
  let index = 0,
    tree;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = (name) =>
    name === 'react'
      ? {
          ...require('react'),
          useState(initial) {
            const i = index++;
            if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
            return [
              slots[i],
              (value) => {
                slots[i] = typeof value === 'function' ? value(slots[i]) : value;
              },
            ];
          },
        }
      : base(name);
  mod._compile(compile(fs.readFileSync(filename, 'utf8'), filename), filename);
  function render() {
    index = 0;
    tree = mod.exports.LoginPage({ onAuthenticate: authenticate });
  }
  function nodes(value, all = []) {
    if (Array.isArray(value)) value.forEach((child) => nodes(child, all));
    else if (value?.props) {
      all.push(value);
      nodes(value.props.children, all);
    }
    return all;
  }
  function find(predicate) {
    const result = nodes(tree).find(predicate);
    assert(result);
    return result;
  }
  render();
  return { render, find, nodes: () => nodes(tree) };
}
test('login sends credentials to the authentication API callback and clears the password on success', async () => {
  const calls = [],
    h = host(async (...args) => calls.push(args));
  h.find((n) => n.props.id === 'login-email').props.onChange({
    target: { value: 'real@example.invalid' },
  });
  h.find((n) => n.props.id === 'login-password').props.onChange({
    target: { value: 'Fictional-Test-Password42!' },
  });
  h.render();
  await h.find((n) => n.type === 'form').props.onSubmit({ preventDefault() {} });
  h.render();
  assert.deepEqual(calls, [['real@example.invalid', 'Fictional-Test-Password42!']]);
  assert.equal(h.find((n) => n.props.id === 'login-password').props.value, '');
});
test('failed authentication remains on the form and displays the server error', async () => {
  const h = host(async () => {
    throw Error('Account is not authorised.');
  });
  await h.find((n) => n.type === 'form').props.onSubmit({ preventDefault() {} });
  h.render();
  assert(
    h
      .nodes()
      .some((n) => n.props.role === 'status' && n.props.children === 'Account is not authorised.'),
  );
});
test('login contains no demo workspace, account selection or client-side acknowledgement bypass', () => {
  const React = require('react'),
    { renderToStaticMarkup } = require('react-dom/server'),
    { MemoryRouter } = require('react-router-dom'),
    { LoginPage } = require('../src/features/auth/LoginPage.tsx');
  const html = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(LoginPage, { onAuthenticate: async () => {} }),
    ),
  );
  assert(/autocomplete="username"/i.test(html));
  assert(/autocomplete="current-password"/i.test(html));
  assert(
    !/Explore a workspace|demo account|sample password|HR workspace|Employee workspace/.test(html),
  );
});
