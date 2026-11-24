const assert = require('node:assert/strict');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;
const { Writable } = require('node:stream');
const React = require('react');
const Router = require('react-router-dom');
const { renderToPipeableStream } = require('react-dom/server');

// Execute the actual modules served by Vite. Adapt only browser mounting/HMR
// to a server render, keeping development import ordering and lazy loading.
const origin = process.argv[2] || 'http://localhost:5173';
async function startup(reproduceBadOrder = false) {
  let root, route = '/dashboard';
  const previewStorage = new Map();
  const context = vm.createContext({
    console, URL, URLSearchParams, Date, Intl, Map, Set, File, Blob,
    crypto, structuredClone, setTimeout, clearTimeout, TextEncoder, TextDecoder,
    document: { getElementById: () => ({}) }, window: {},
    sessionStorage: { getItem: key => previewStorage.get(key) ?? null, setItem: (key, value) => previewStorage.set(key, value), removeItem: key => previewStorage.delete(key), clear: () => previewStorage.clear() },
    $RefreshSig$: () => () => {}, $RefreshReg$: () => {},
  });
  const modules = new Map();
  function synthetic(key, exports) {
    if (modules.has(key)) return modules.get(key);
    const values = { ...exports, default: exports };
    const result = new vm.SyntheticModule(Object.keys(values), function () {
      for (const [name, value] of Object.entries(values)) this.setExport(name, value);
    }, { context, identifier: key });
    modules.set(key, result);
    return result;
  }
  async function load(specifier, parent = origin + '/') {
    const url = new URL(specifier, parent), path = url.pathname;
    if (path.endsWith('/react.js')) return synthetic('react', React);
    if (path.endsWith('/react_jsx-dev-runtime.js')) return synthetic('jsx-dev', require('react/jsx-dev-runtime'));
    if (path.endsWith('/react_jsx-runtime.js')) return synthetic('jsx', require('react/jsx-runtime'));
    if (path.endsWith('/react-dom_client.js')) return synthetic('react-dom-client', { createRoot: () => ({ render: element => { root = element; } }) });
    if (path.endsWith('/react-router-dom.js')) return synthetic('router', { ...Router, BrowserRouter: ({ children }) => React.createElement(Router.MemoryRouter, { initialEntries: [route] }, children) });
    if (path.endsWith('/lucide-react.js')) return synthetic('icons', require('lucide-react'));
    if (path === '/@vite/client') return synthetic('hmr', { createHotContext: () => undefined });
    if (path === '/@react-refresh' || path.endsWith('.css')) return synthetic(path, {});
    const key = url.href;
    if (modules.has(key)) return modules.get(key);
    // Cache before fetching, so circular imports share one module instance.
    const pending = (async () => {
      const response = await fetch(key);
      assert.equal(response.status, 200, `Vite module failed: ${key}`);
      let code = await response.text();
      if (reproduceBadOrder && path === '/src/main.tsx') {
        const declaration = code.match(/^const Compliance = lazy\(.*$/m)?.[0];
        assert(declaration, 'Expected the lazy compliance declaration');
        code = code.replace(declaration, '');
        const reactImport = code.search(/^import __vite__cjsImport\d+_react from /m);
        assert(reactImport >= 0, 'Expected the Vite React interop import');
        code = code.slice(0, reactImport) + declaration + '\n' + code.slice(reactImport);
      }
      return new vm.SourceTextModule(code, {
        context, identifier: key,
        initializeImportMeta: meta => { meta.url = key; },
        importModuleDynamically: async (child, referring) => {
          const module = await load(child, referring.identifier);
          if (module.status === 'unlinked') await module.link(link);
          if (module.status === 'linked') await module.evaluate();
          return module;
        },
      });
    })();
    modules.set(key, pending);
    return pending;
  }
  const link = (specifier, parent) => load(specifier, parent.identifier);
  const entry = await load('/src/main.tsx');
  await entry.link(link);
  await entry.evaluate();
  assert(root, 'Application did not reach createRoot.render');
  const sessionModule = await load('/src/auth/previewSession.ts');
  if (sessionModule.status === 'unlinked') await sessionModule.link(link);
  if (sessionModule.status === 'linked') await sessionModule.evaluate();
  async function render(path, acknowledged = true, role = 'hr') {
    previewStorage.clear();
    if (acknowledged) sessionModule.namespace.beginPreviewSession(role);
    route = path;
    return new Promise((resolve, reject) => {
      let html = '';
      const timeout = setTimeout(() => reject(new Error(`Render timed out: ${path}`)), 15000);
      const output = new Writable({ write(chunk, encoding, done) { html += chunk.toString(); done(); } });
      output.on('finish', () => { clearTimeout(timeout); resolve(html); });
      const stream = renderToPipeableStream(root, {
        onAllReady() { stream.pipe(output); },
        onError(error) { clearTimeout(timeout); reject(error); },
      });
    });
  }
  const gated = await render('/dashboard', false);
  assert(gated.includes('Welcome back.') && !gated.includes('class="shell"'), 'Workspace must remain hidden without acknowledged preview entry');
  process.stdout.write('PASS workspace stays hidden before acknowledgement\n');
  for (const [path, content] of [
    ['/login', 'Welcome back.'],
    ['/', 'Welcome back.'],
    ['/register', 'Clock in &amp; out'],
    ['/dashboard', 'People overview'],
    ['/organisation?tab=chart', 'HR builds the structure'],
    ['/organisation?tab=positions', 'Add position'],
    ['/employees?employee=employees-1&tab=Overview', 'Employment details'],
    ['/employees?employee=employees-1&tab=Contracts', 'Employee contracts'],
    ['/compliance?tab=Policies', 'Policies &amp; employee acknowledgement'],
    ['/self-service?employee=employees-1', 'Employee Dashboard'],
    ['/self-service?employee=employees-1&section=Policies', 'My policies'],
  ]) {
    const html = await render(path);
    assert(html.replace(/<!--[\s\S]*?-->/g, '').includes(content), `Missing page content: ${path}`);
    process.stdout.write(`PASS live development entry: ${path}\n`);
  }
  for (const [role,path,content] of [
    ['admin','/admin','System workspace'],['admin','/users','Users &amp; access'],['admin','/security','Security controls'],['admin','/payroll','outside your role'],['admin','/employees','outside your role'],
    ['manager','/team','My team'],['manager','/team/leave','Leave approvals'],['manager','/payroll','outside your role'],
    ['employee','/self-service?employee=employees-2','Employee Dashboard'],['employee','/employees','outside your role'],['employee','/organisation','Read only'],
    ['hr','/settings','HR settings'],['hr','/users','outside your role'],['hr','/audit','outside your role']
  ]) {const html=await render(path,true,role);assert(html.replace(/<!--[\s\S]*?-->/g,'').includes(content),`Role boundary failed: ${role} ${path}`);if(role==='employee'&&path.startsWith('/self-service'))assert(!html.includes('Preview as employee'),'Employee must not switch identity');process.stdout.write(`PASS role workspace: ${role} ${path}\n`);}

}
(async () => {
  await assert.rejects(startup(true), /Cannot access 'lazy' before initialization/);
  process.stdout.write('PASS regression: the previous import order reproduces the startup crash\n');
  await startup();
})().catch(error => { console.error(error); process.exitCode = 1; });
