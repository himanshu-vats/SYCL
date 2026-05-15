const http = require('http');
const fs = require('fs');
const path = require('path');

// Load .env.local — handles quoted values and multiline FIREBASE_PRIVATE_KEY
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf8');
  // Match KEY="value" or KEY=value, value can span multiple lines if quoted
  const re = /^([A-Z_][A-Z0-9_]*)=("[\s\S]*?(?<!\\)"|[^\n]*)/gm;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const k = m[1];
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) {
      v = v.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
    process.env[k] = v;
  }
}

const PORT = 3001;

function parseBody(req) {
  return new Promise((resolve) => {
    const ct = req.headers['content-type'] || '';
    if (req.method === 'GET' || req.method === 'OPTIONS' || req.method === 'HEAD') {
      resolve(undefined); return;
    }
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      if (ct.includes('application/json') && raw) {
        try { resolve(JSON.parse(raw)); } catch { resolve({}); }
      } else {
        resolve(undefined);
      }
    });
    req.on('error', () => resolve(undefined));
  });
}

const server = http.createServer(async (req, rawRes) => {
  const [urlPath, queryString] = req.url.split('?');
  const apiPath = urlPath.replace(/^\/api\//, '').replace(/^\/api$/, 'leagues');
  // Parse query params onto req.query like Express does
  req.query = {};
  if (queryString) {
    queryString.split('&').forEach(p => {
      const [k, v] = p.split('=');
      if (k) req.query[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
  }
  // Parse JSON body onto req.body like Express does
  req.body = await parseBody(req);

  const handlerPath = path.join(__dirname, '../api', apiPath + '.js');

  // Express-compatible response wrapper
  const res = Object.assign(rawRes, {
    status(code) { rawRes.statusCode = code; return res; },
    json(data) {
      if (!rawRes.headersSent) {
        rawRes.setHeader('Content-Type', 'application/json');
        rawRes.setHeader('Access-Control-Allow-Origin', '*');
      }
      rawRes.end(JSON.stringify(data));
    },
    send(data) { rawRes.end(data); },
  });

  if (!fs.existsSync(handlerPath)) {
    res.status(404).json({ error: 'Not found: ' + apiPath });
    return;
  }

  try {
    delete require.cache[require.resolve(handlerPath)];
    const handler = require(handlerPath);
    await handler(req, res);
  } catch (e) {
    console.error('[dev-api]', e.message);
    if (!rawRes.headersSent) res.status(500).json({ error: e.message });
  }
});

server.listen(PORT, () => {
  console.log(`[dev-api] API server running at http://localhost:${PORT}`);
});
