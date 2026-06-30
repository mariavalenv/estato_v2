// Local dev server — wraps the Vercel API routes so they work with Vite's proxy.
// Run alongside `vite` via `npm run dev`.
import { createServer } from 'node:http'
import { config } from 'dotenv'

config({ path: '.env' })

async function loadHandler(route) {
  const mod = await import(`./api/${route}.js?t=${Date.now()}`)
  return mod.default
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost`)
  const route = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '')

  let body = ''
  req.on('data', chunk => { body += chunk })
  await new Promise(r => req.on('end', r))

  const mockReq = {
    method: req.method,
    headers: req.headers,
    body: body ? JSON.parse(body) : {},
    query: Object.fromEntries(url.searchParams),
  }

  const mockRes = {
    _statusCode: 200,
    _headers: {},
    _headersSent: false,
    status(code) { this._statusCode = code; return this },
    setHeader(k, v) { this._headers[k] = v; return this },
    _ensureHeaders() {
      if (!this._headersSent) {
        res.writeHead(this._statusCode, this._headers)
        this._headersSent = true
      }
    },
    write(chunk) { this._ensureHeaders(); res.write(chunk) },
    end(data) { this._ensureHeaders(); res.end(data) },
    json(data) {
      if (!this._headersSent) {
        this._headers['Content-Type'] = 'application/json'
        res.writeHead(this._statusCode, this._headers)
        this._headersSent = true
      }
      res.end(JSON.stringify(data))
    },
  }

  try {
    const handler = await loadHandler(route)
    await handler(mockReq, mockRes)
  } catch (err) {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
    }
    res.end(JSON.stringify({ error: err.message }))
  }
})

server.listen(3001, () => console.log('API dev server → http://localhost:3001'))
