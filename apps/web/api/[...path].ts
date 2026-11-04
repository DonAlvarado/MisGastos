
import type { IncomingMessage, ServerResponse } from 'node:http';

type ProxyRequest = IncomingMessage & {
  body?: unknown;
};

function sendJson(
  res: ServerResponse,
  status: number,
  data: object
) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(data));
}

export default async function handler(
  req: ProxyRequest,
  res: ServerResponse
) {
  const upstream = process.env.BACKEND_ORIGIN?.replace(/\/$/, '');

  if (!upstream || !/^https:\/\//.test(upstream)) {
    sendJson(res, 503, {
      error: 'BACKEND_ORIGIN no configurado (debe ser HTTPS)'
    });
    return;
  }

  const route = req.url ?? '';

  if (!route.startsWith('/api/')) {
    res.statusCode = 404;
    res.end();
    return;
  }

  const destination = new URL(route, upstream);

  if (destination.origin !== upstream) {
    res.statusCode = 400;
    res.end();
    return;
  }

  const headers = new Headers();

  const contentType = req.headers['content-type'];
  if (typeof contentType === 'string') {
    headers.set('content-type', contentType);
  }

  const cookie = req.headers.cookie;
  if (cookie) headers.set('cookie', cookie);

  const origin = req.headers.origin;
  if (origin) headers.set('origin', origin);

  headers.set('accept', 'application/json');

  const method = req.method ?? 'GET';

  const body = ['GET', 'HEAD'].includes(method)
    ? undefined
    : typeof req.body === 'string'
      ? req.body
      : req.body === undefined
        ? undefined
        : JSON.stringify(req.body);

  try {
    const response = await fetch(destination, {
      method,
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(25000),
    });

    res.statusCode = response.status;

    const responseType = response.headers.get('content-type');
    if (responseType) {
      res.setHeader('content-type', responseType);
    }

    res.setHeader('cache-control', 'no-store');

    for (const cookie of response.headers.getSetCookie()) {
      res.appendHeader('set-cookie', cookie);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    res.end(bytes);

  } catch (err) {
    console.error(
      'Proxy API no disponible',
      err instanceof Error ? err.message : 'error'
    );

    sendJson(res, 502, {
      error: 'Servidor API temporalmente no disponible'
    });
  }
}
