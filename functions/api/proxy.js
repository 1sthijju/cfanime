//install wrangle and init a project to initialize the worker

//add the code given below in index.js

import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use(
	'*',
	cors({
		origin: '*',
		allowHeaders: '*',
		allowMethods: ['GET', 'OPTIONS'],
		maxAge: 600,
	})
);

app.all('*', async (c) => {
	const targetUrl = c.req.query('url');
	if (!targetUrl) {
		return c.text('Missing target URL', 400);
	}

	const url = new URL(targetUrl);
	const targetRequest = new Request(url, {
		method: c.req.method,
		headers: c.req.headers,
		body: ['GET', 'HEAD'].includes(c.req.method) ? null : c.req.body,
	});

	const response = await fetch(targetRequest);

	const newHeaders = new Headers(response.headers);
	newHeaders.set('Access-Control-Allow-Origin', '*');
	newHeaders.set('Access-Control-Allow-Methods', '*');
	newHeaders.set('Access-Control-Allow-Headers', 'Content-Type');

	return new Response(response.body, {
		status: response.status,
		headers: newHeaders,
	});
});

export default app;

// add name of your project (can be any) in wrangler.toml file

//run npx wrangler publish 
// your reversed proxy server is now hosted
// to use the proxy make request like this structure given below
//https://workername.workers.dev/?url=https://<website_name>
