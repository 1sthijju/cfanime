export default {
  async fetch(request) {
    const url = new URL(request.url)
    const target = url.searchParams.get('url')

    if (!target) {
      return new Response(JSON.stringify({ error: 'Missing ?url= param' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const proxyRes = await fetch(target, {
        method: request.method,
        headers: request.headers
      })

      const newHeaders = new Headers(proxyRes.headers)
      newHeaders.set('Access-Control-Allow-Origin', '*')
      newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      newHeaders.set('Access-Control-Allow-Headers', '*')

      return new Response(proxyRes.body, {
        status: proxyRes.status,
        headers: newHeaders
      })
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
}
