const assert = require('node:assert/strict');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;
const { Writable } = require('node:stream');
const React = require('react');
const Router = require('react-router-dom');
const { renderToPipeableStream } = require('react-dom/server');

// Execute the actual modules served by Vite. Adapt only browser mounting/HMR
// to a server render, keeping development import ordering and lazy loading.
let origin;
async function startup() {
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
  async function render(path, acknowledged = true, role = 'hr') {
    previewStorage.clear();

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
  for (const path of ['/login','/dashboard','/employees','/organisation','/register','/leave','/payroll','/administration']) {
    const html=await render(path,false);
    assert(html.includes('Connecting to MataHR'), 'The live session must be checked before opening '+path);
    assert(!html.includes('class="shell"'), 'Private workspace rendered before a live session was verified');
    process.stdout.write('PASS live entry import graph and session gate: '+path+'\n');
  }
}
(async()=>{
 const {createServer}=await import('vite');
 const path=require('node:path');
 const server=await createServer({root:path.resolve(__dirname,'..'),configFile:path.resolve(__dirname,'../vite.config.ts'),server:{host:'127.0.0.1',port:0,strictPort:true,open:false},logLevel:'error'});
 try{await server.listen();origin='http://127.0.0.1:'+server.httpServer.address().port;await startup();}
 finally{await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
