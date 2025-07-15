// functions/api/proxy.js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'URL parameter is required' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  try {
    // Handle M3U8 playlists
    if (targetUrl.includes('.m3u8') || url.pathname.includes('/m3u8')) {
      return await handleM3U8(request, targetUrl, url.origin);
    }
    
    // Handle subtitle files
    if (targetUrl.match(/\.(vtt|srt|ass|ssa)$/i) || url.pathname.includes('/subtitle')) {
      return await handleSubtitle(request, targetUrl);
    }
    
    // Handle general proxy requests
    return await handleProxy(request, targetUrl);

  } catch (error) {
    console.error('Proxy Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Proxy request failed',
      details: error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

async function handleM3U8(request, targetUrl, workerOrigin) {
  const response = await fetch(targetUrl, {
    method: request.method,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': new URL(targetUrl).origin,
      'Accept': 'application/x-mpegURL, application/vnd.apple.mpegurl, application/vnd.apple.mpegurl.audio',
      ...getAuthHeaders(request)
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  let m3u8Content = await response.text();
  const baseUrl = new URL(targetUrl);
  
  // Replace relative URLs with proxied URLs
  m3u8Content = m3u8Content.replace(/^(?!#)(?!http)(.+)$/gm, (match) => {
    const trimmedMatch = match.trim();
    if (trimmedMatch && !trimmedMatch.startsWith('#')) {
      const segmentUrl = new URL(trimmedMatch, baseUrl.href).href;
      return `${workerOrigin}/api/proxy?url=${encodeURIComponent(segmentUrl)}`;
    }
    return match;
  });

  return new Response(m3u8Content, {
    headers: {
      'Content-Type': 'application/x-mpegURL',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges'
    }
  });
}

async function handleSubtitle(request, targetUrl) {
  const response = await fetch(targetUrl, {
    method: request.method,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': new URL(targetUrl).origin,
      ...getAuthHeaders(request)
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // Detect subtitle format from URL
  const url = new URL(targetUrl);
  const extension = url.pathname.split('.').pop().toLowerCase();
  
  let contentType = 'text/plain';
  if (extension === 'vtt') {
    contentType = 'text/vtt';
  } else if (extension === 'srt') {
    contentType = 'application/x-subrip';
  } else if (extension === 'ass' || extension === 'ssa') {
    contentType = 'text/x-ass';
  }

  const content = await response.text();
  
  return new Response(content, {
    headers: {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

async function handleProxy(request, targetUrl) {
  const response = await fetch(targetUrl, {
    method: request.method,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': new URL(targetUrl).origin,
      'Range': request.headers.get('Range'),
      ...getAuthHeaders(request)
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // Create new response with CORS headers
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...Object.fromEntries(response.headers),
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, Content-Type'
    }
  });

  return newResponse;
}

function getAuthHeaders(request) {
  const headers = {};
  const auth = request.headers.get('Authorization');
  if (auth) {
    headers['Authorization'] = auth;
  }
  return headers;
}
