// QA-27 Phase 1: web dùng cookie HttpOnly cho refresh token; mobile giữ luồng cũ.
// Chạy: node src/tests/fe_auth_cookie.test.mjs  (tự chạy lại chính nó ở chế độ mobile trong tiến trình con)
import assert from 'node:assert';
import { register } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MODE = process.env.RN_PLATFORM || 'web';
globalThis.__RN_PLATFORM__ = MODE;
register('./stubs/rn_web_loader.mjs', import.meta.url);

const store = new Map();
// Giống localStorage của trình duyệt: Object.keys() liệt kê các khóa đã lưu (code xóa dữ liệu lâm sàng dựa vào đó)
const lsApi = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.localStorage = new Proxy(lsApi, {
  get: (t, p) => (p in t ? t[p] : store.get(p)),
  ownKeys: () => [...store.keys()],
  getOwnPropertyDescriptor: (t, p) => (store.has(p) ? { enumerable: true, configurable: true, value: store.get(p) } : undefined),
});
globalThis.window = { location: { port: '8081', hostname: 'localhost', origin: 'http://localhost:8081' } };

const calls = [];
let nextResponses = [];
globalThis.fetch = async (url, opts = {}) => {
  calls.push({ url, opts });
  const r = nextResponses.shift() || { status: 200, body: { ok: true } };
  return { status: r.status, ok: r.status >= 200 && r.status < 300, text: async () => JSON.stringify(r.body), json: async () => r.body };
};

const client = await import('../api/client.js');
let passed = 0;
let failed = 0;
const test = async (name, fn) => {
  calls.length = 0; nextResponses = []; store.clear();
  try { await fn(); passed += 1; console.log(`  ✔ [${MODE}] ${name}`); } catch (e) { failed += 1; console.log(`  ✖ [${MODE}] ${name}\n    ${e.message}`); }
};
const header = (c, k) => c.opts.headers?.[k];

if (MODE === 'web') {
  await test('gọi /auth/* gửi kèm cookie (credentials: include) và header X-Client-Platform: web', async () => {
    await client.post('/auth/login', { email: 'a@b.vn', password: 'x' });
    assert.strictEqual(calls[0].opts.credentials, 'include');
    assert.strictEqual(header(calls[0], 'X-Client-Platform'), 'web');
  });

  await test('API nghiệp vụ không gửi cookie phiên (chỉ /auth mới cần)', async () => {
    await client.get('/api/v1/visits');
    assert.strictEqual(calls[0].opts.credentials, undefined);
    assert.strictEqual(header(calls[0], 'X-Client-Platform'), 'web');
  });

  await test('làm mới phiên khi storage không có refresh token: vẫn gọi /auth/refresh bằng cookie', async () => {
    nextResponses = [{ status: 200, body: { accessToken: 'AT_MOI' } }];
    const token = await client.refreshAccessToken();
    assert.strictEqual(token, 'AT_MOI');
    assert.ok(calls[0].url.endsWith('/auth/refresh'));
    assert.strictEqual(calls[0].opts.credentials, 'include');
    assert.strictEqual(calls[0].opts.body, '{}');
    assert.strictEqual(await client.getToken(), 'AT_MOI');
  });

  await test('giai đoạn chuyển tiếp: refresh token cũ trong localStorage vẫn được gửi kèm làm dự phòng', async () => {
    store.set('refreshToken', 'RT_CU');
    nextResponses = [{ status: 200, body: { accessToken: 'AT2' } }];
    await client.refreshAccessToken();
    assert.deepStrictEqual(JSON.parse(calls[0].opts.body), { refreshToken: 'RT_CU' });
  });

  await test('đăng nhập web không nhận refresh token trong body → không ghi gì vào localStorage, xoá bản cũ', async () => {
    store.set('refreshToken', 'RT_CU');
    await client.setAuthToken('AT', undefined);
    assert.strictEqual(store.get('token'), 'AT');
    assert.strictEqual(store.has('refreshToken'), false);
  });

  await test('nhiều request cùng gặp 401 chỉ làm mới phiên một lần', async () => {
    nextResponses = [
      { status: 401, body: {} }, { status: 401, body: {} },
      { status: 200, body: { accessToken: 'AT3' } },
      { status: 200, body: { a: 1 } }, { status: 200, body: { b: 2 } },
    ];
    const [r1, r2] = await Promise.all([client.get('/api/v1/a'), client.get('/api/v1/b')]);
    assert.strictEqual(calls.filter((c) => c.url.endsWith('/auth/refresh')).length, 1);
    assert.ok(r1 && r2);
  });

  await test('làm mới phiên thất bại: mọi request đang chờ bị từ chối (không treo) và dữ liệu bệnh nhân trên máy bị xóa', async () => {
    store.set('token', 'AT_CU');
    store.set('user', '{"role":"nurse"}');
    store.set('emr_detail_visit_1', '{"examPulse":"80"}');
    store.set('@neuroscan_medical_record_form_x', '{}');
    nextResponses = [{ status: 401, body: {} }, { status: 401, body: {} }, { status: 401, body: { message: 'hết hạn' } }];
    const settle = (p) => p.then(() => 'ok', () => 'rejected');
    const timeout = new Promise((resolve) => setTimeout(() => resolve('TREO'), 2000));
    const results = await Promise.race([Promise.all([settle(client.get('/api/v1/a')), settle(client.get('/api/v1/b'))]), timeout]);
    assert.deepStrictEqual(results, ['rejected', 'rejected']);
    assert.strictEqual(store.has('token'), false);
    assert.strictEqual(store.has('user'), false);
    assert.strictEqual(store.has('emr_detail_visit_1'), false);
    assert.strictEqual(store.has('@neuroscan_medical_record_form_x'), false);
    // cờ làm mới đã được trả: lần 401 sau vẫn gọi /auth/refresh được
    calls.length = 0;
    nextResponses = [{ status: 401, body: {} }, { status: 200, body: { accessToken: 'AT_SAU' } }, { status: 200, body: { c: 3 } }];
    await client.get('/api/v1/c');
    assert.strictEqual(calls.filter((c) => c.url.endsWith('/auth/refresh')).length, 1);
  });
} else {
  await test('mobile: không có refresh token đã lưu thì không gọi /auth/refresh', async () => {
    const token = await client.refreshAccessToken();
    assert.strictEqual(token, null);
    assert.strictEqual(calls.length, 0);
  });

  await test('mobile: gọi /auth/* không ép credentials, header X-Client-Platform theo nền tảng', async () => {
    await client.post('/auth/login', { email: 'a@b.vn', password: 'x' });
    assert.strictEqual(calls[0].opts.credentials, undefined);
    assert.strictEqual(header(calls[0], 'X-Client-Platform'), MODE);
  });

  await test('mobile: refresh token lưu trong AsyncStorage vẫn được gửi trong body như cũ', async () => {
    await client.setRefreshToken('RT_MOBILE');
    nextResponses = [{ status: 200, body: { accessToken: 'AT_M' } }];
    assert.strictEqual(await client.refreshAccessToken(), 'AT_M');
    assert.deepStrictEqual(JSON.parse(calls[0].opts.body), { refreshToken: 'RT_MOBILE' });
  });
}

if (MODE === 'web') {
  const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, RN_PLATFORM: 'ios' }, encoding: 'utf8' });
  process.stdout.write(child.stdout || '');
  process.stderr.write(child.stderr || '');
  const m = /SUMMARY_MOBILE (\d+) (\d+)/.exec(child.stdout || '');
  if (!m) { failed += 1; console.log('  ✖ không chạy được phần mobile'); } else { passed += Number(m[1]); failed += Number(m[2]); }
  console.log(`\nSUMMARY: ${passed}/${passed + failed} AUTH COOKIE TESTS PASSED${failed ? ` (${failed} failed)` : ' (100%)'}`);
  process.exit(failed ? 1 : 0);
} else {
  console.log(`SUMMARY_MOBILE ${passed} ${failed}`);
  process.exit(0);
}
