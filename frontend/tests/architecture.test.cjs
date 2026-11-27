const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  ts = require('typescript');
const root = path.resolve(__dirname, '../src');
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
    );
}
test('every production source file is reachable from the single application entry', () => {
  const all = files(root),
    known = new Set(all),
    seen = new Set();
  function resolve(from, spec) {
    const base = path.resolve(path.dirname(from), spec);
    return [
      base,
      ...['.ts', '.tsx', '.css'].map((ext) => base + ext),
      path.join(base, 'index.ts'),
    ].find((candidate) => known.has(candidate));
  }
  function visit(file) {
    if (seen.has(file)) return;
    seen.add(file);
    if (file.endsWith('.css')) {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(/@import\s+['"]([^'"]+)['"]/g)) {
        const target = resolve(file, match[1]);
        assert(target, `Unresolved CSS import ${match[1]}`);
        visit(target);
      }
      return;
    }
    if (!/\.tsx?$/.test(file)) return;
    const ast = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    function walk(node) {
      const spec =
        ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) ||
        (ts.isCallExpression(node) &&
          node.expression.kind === ts.SyntaxKind.ImportKeyword &&
          node.arguments[0]);
      if (spec && ts.isStringLiteral(spec) && spec.text.startsWith('.')) {
        const target = resolve(file, spec.text);
        assert(target, `Unresolved import ${path.relative(root, file)} -> ${spec.text}`);
        visit(target);
      }
      ts.forEachChild(node, walk);
    }
    walk(ast);
  }
  visit(path.join(root, 'main.tsx'));
  assert.deepEqual(
    all.filter((file) => !seen.has(file)).map((file) => path.relative(root, file)),
    [],
  );
});
test('production source has no demo stores, prototype entry or authentication fallback', () => {
  for (const file of files(root).filter((file) => /\.tsx?$/.test(file))) {
    const source = fs.readFileSync(file, 'utf8');
    assert(
      !/initialAccounts|previewSession|demoEmployees|initialWorkspace|LiveApp/.test(source),
      path.relative(root, file),
    );
  }
  assert(!fs.existsSync(path.join(root, 'live')));
  assert(fs.existsSync(path.join(root, 'app/App.tsx')));
});
