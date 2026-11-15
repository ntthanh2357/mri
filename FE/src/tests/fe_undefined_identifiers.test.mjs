// Chặn lỗi kiểu "handleBackNavigation is not defined" (màn sập lúc chạy, build vẫn qua): mọi định danh và
// JSX component dùng trong src/ phải được khai báo hoặc import. Chạy: node src/tests/fe_undefined_identifiers.test.mjs
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const GLOBALS = new Set(('window document console fetch setTimeout clearTimeout setInterval clearInterval Promise JSON Math Date Number String Object Array '
  + 'Boolean Error TypeError RangeError SyntaxError ReferenceError URIError EvalError AggregateError URL URLSearchParams process require module exports alert confirm prompt '
  + 'localStorage sessionStorage navigator FormData Blob File FileReader Intl Set Map WeakMap WeakSet Symbol RegExp isNaN isFinite parseInt parseFloat '
  + 'encodeURIComponent decodeURIComponent encodeURI decodeURI globalThis AbortController AbortSignal atob btoa crypto performance requestAnimationFrame '
  + 'cancelAnimationFrame Image Event CustomEvent HTMLElement HTMLCanvasElement __DEV__ global structuredClone queueMicrotask Headers Response Request TextEncoder '
  + 'TextDecoder NaN Infinity undefined arguments Reflect Proxy BigInt ArrayBuffer Uint8Array Uint8ClampedArray Uint16Array Int16Array Float32Array Float64Array '
  + 'Int32Array Uint32Array DataView WebSocket location history getComputedStyle matchMedia ResizeObserver IntersectionObserver MutationObserver screen open print '
  + 'MessageChannel Worker Notification caches indexedDB self top parent XMLHttpRequest Audio MediaRecorder speechSynthesis SpeechSynthesisUtterance DOMParser CSS '
  + 'Element Node Range Selection KeyboardEvent MouseEvent TouchEvent PointerEvent __dirname __filename Buffer escape unescape EventSource OffscreenCanvas '
  + 'createImageBitmap ImageData Path2D DOMMatrix SharedArrayBuffer Atomics WebAssembly FinalizationRegistry WeakRef Function eval').split(/\s+/));

const files = [];
(function walk(d) {
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    if (fs.statSync(p).isDirectory()) { if (n !== 'tests') walk(p); } else if (/\.(js|jsx|mjs)$/.test(n)) files.push(p);
  }
})(SRC);

const problems = [];
const tdz = [];
const rel = (f) => path.relative(SRC, f).replace(/\\/g, '/');
for (const f of files) {
  const ast = parser.parse(fs.readFileSync(f, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
  traverse(ast, {
    ReferencedIdentifier(p) {
      const name = p.node.name;
      if (p.isJSXIdentifier()) {
        if (!/^[A-Z]/.test(name)) return;
        if (p.parentPath.isJSXMemberExpression() && p.parent.property === p.node) return;
      }
      if (GLOBALS.has(name) || p.scope.hasBinding(name, true)) return;
      if (p.parentPath.isMemberExpression({ property: p.node, computed: false })) return;
      if (p.parentPath.isObjectProperty({ key: p.node }) && !p.parent.computed && !p.parent.shorthand) return;
      if (p.parentPath.isUnaryExpression({ operator: 'typeof' })) return;
      problems.push(`${path.relative(SRC, f).replace(/\\/g, '/')}:${p.node.loc.start.line} ${name}`);
    },
  });
  // TDZ: dùng biến const/let TRƯỚC dòng khai báo trong cùng thân hàm (không phải trong closure chạy sau) → sập lúc render
  traverse(ast, {
    Scope(sp) {
      for (const b of Object.values(sp.scope.bindings)) {
        if (!['const', 'let'].includes(b.kind)) continue;
        const declFn = b.scope.getFunctionParent() || b.scope.getProgramParent();
        for (const r of b.referencePaths) {
          const refFn = r.scope.getFunctionParent() || r.scope.getProgramParent();
          if (r.node === b.identifier || !r.isIdentifier() && !r.isJSXIdentifier()) continue; // export const X: Babel tính cả nút export là tham chiếu
          if (refFn === declFn && r.node.start < b.identifier.start) tdz.push(`${rel(f)}:${r.node.loc.start.line} ${b.identifier.name}`);
        }
      }
    },
  });
}

let failed = 0;
try {
  assert.deepStrictEqual(problems, []);
  console.log(`  ✔ ${files.length} tệp, không có định danh chưa khai báo`);
} catch {
  failed += 1;
  console.log(`  ✖ định danh chưa khai báo (màn sẽ sập lúc chạy):\n    ${problems.join('\n    ')}`);
}
try {
  assert.deepStrictEqual([...new Set(tdz)], []);
  console.log('  ✔ không dùng biến const/let trước khi khai báo (TDZ)');
} catch {
  failed += 1;
  console.log(`  ✖ dùng biến trước khi khai báo (ReferenceError lúc render):\n    ${[...new Set(tdz)].join('\n    ')}`);
}
console.log(`\nSUMMARY: ${2 - failed}/2 UNDEFINED IDENTIFIER TESTS PASSED${failed ? ` (${failed} failed)` : ' (100%)'}`);
process.exit(failed);
