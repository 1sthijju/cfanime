//install wrangle and init a project to initialize the worker

// Media streaming CORS proxy with M3U8 and subtitle support
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors({
  origin: '*', // Change to your domain in production
  credentials: true,
}));

// Add comprehensive CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range');
  res.header('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Specialized M3U8 proxy endpoint
app.get('/m3u8', async (req, res) => {
  const targetUrl = req.query.url;
  
  if (!targetUrl) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': new URL(targetUrl).origin,
        ...req.headers.authorization && { 'Authorization': req.headers.authorization }
      },
      responseType: 'text'
    });

    // Set appropriate headers for M3U8
    res.set({
      'Content-Type': 'application/x-mpegURL',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });

    // Modify M3U8 content to proxy segment URLs
    let m3u8Content = response.data;
    const baseUrl = new URL(targetUrl);
    
    // Replace relative URLs with proxied URLs
    m3u8Content = m3u8Content.replace(/^(?!#)(?!http)(.+)$/gm, (match) => {
      const segmentUrl = new URL(match.trim(), baseUrl.href).href;
      return `http://localhost:${PORT}/segment?url=${encodeURIComponent(segmentUrl)}`;
    });

    res.send(m3u8Content);
  } catch (error) {
    console.error('M3U8 Proxy Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch M3U8 playlist' });
  }
});

// Video segment proxy
app.get('/segment', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  router: (req) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return null;
    
    try {
      const url = new URL(targetUrl);
      return `${url.protocol}//${url.host}`;
    } catch (error) {
      return null;
    }
  },
  pathRewrite: (path, req) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return path;
    
    try {
      const url = new URL(targetUrl);
      return url.pathname + url.search;
    } catch (error) {
      return path;
    }
  },
  onProxyReq: (proxyReq, req, res) => {
    // Add headers for video segments
    proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    proxyReq.setHeader('Referer', new URL(req.query.url).origin);
  },
  onProxyRes: (proxyRes, req, res) => {
    // Ensure CORS headers on video segments
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    proxyRes.headers['Access-Control-Expose-Headers'] = 'Content-Range, Accept-Ranges, Content-Length';
  }
}));

// Subtitle proxy endpoint
app.get('/subtitle', async (req, res) => {
  const targetUrl = req.query.url;
  
  if (!targetUrl) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': new URL(targetUrl).origin,
        ...req.headers.authorization && { 'Authorization': req.headers.authorization }
      },
      responseType: 'text'
    });

    // Detect subtitle format and set appropriate content type
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

    res.set({
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });

    res.send(response.data);
  } catch (error) {
    console.error('Subtitle Proxy Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch subtitle file' });
  }
});

// General proxy endpoint for other requests
app.use('/proxy', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  pathRewrite: {
    '^/proxy': '',
  },
  router: (req) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return null;
    
    try {
      const url = new URL(targetUrl);
      return `${url.protocol}//${url.host}`;
    } catch (error) {
      return null;
    }
  },
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  },
  onProxyRes: (proxyRes, req, res) => {
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
  }
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    endpoints: {
      m3u8: '/m3u8?url=TARGET_URL',
      subtitle: '/subtitle?url=TARGET_URL',
      general: '/proxy?url=TARGET_URL'
    }
  });
});

app.listen(PORT, () => {
  console.log(`Media Streaming CORS Proxy running on port ${PORT}`);
  console.log(`M3U8 Proxy: http://localhost:${PORT}/m3u8?url=TARGET_URL`);
  console.log(`Subtitle Proxy: http://localhost:${PORT}/subtitle?url=TARGET_URL`);
  console.log(`General Proxy: http://localhost:${PORT}/proxy?url=TARGET_URL`);
});

/*
Package.json dependencies:
{
  "name": "media-cors-proxy",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "http-proxy-middleware": "^2.0.6",
    "axios": "^1.6.0"
  },
  "scripts": {
    "start": "node server.js"
  }
}
*/
