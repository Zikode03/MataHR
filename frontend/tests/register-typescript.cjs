const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
function compile(source, filename) {
  return ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
}
for (const extension of ['.ts', '.tsx']) {
  Module._extensions[extension] = (module, filename) =>
    module._compile(compile(fs.readFileSync(filename, 'utf8'), filename), filename);
}
module.exports = { compile };
