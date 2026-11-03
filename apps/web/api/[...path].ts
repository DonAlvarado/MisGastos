// Proxy HTTP en Vercel: el navegador habla con /api en SU MISMO dominio, y esta
// función reenvía la solicitud al API de Render. Así la cookie de sesión queda
// atada al dominio de Vercel y no hay cookies de terceros entre dominios.
//
// BACKEND_ORIGIN es una variable de SERVIDOR de Vercel. Nunca lleva prefijo
// VITE_, porque eso la enviaría al navegador y expondría la URL del API.
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const upstream = process.env.BACKEND_ORIGIN?.replace(/\/$/, '');
  if (!upstream || !/^https:\/\//.test(upstream)) {
    res.status(503).json({ error: 'BACKEND_ORIGIN no configurado (debe ser HTTPS)' });
    return;
  }

  // Solo se reenvía lo que cuelga de /api. Cualquier otra ruta la sirve React.
  const route = req.url ?? '';
  if (!route.startsWith('/api/')) { res.status(404).end(); return; }

  const destination = new URL(route, upstream);
  if (destination.origin !== upstream) { res.status(400).end(); return; }

  const headers = new Headers();
  const contentType = req.headers['content-type'];
  if (typeof contentType === 'string') headers.set('content-type', contentType);
  // La cookie de sesión viaja al API; sin esto no habría sesión.
  const cookie = req.headers.cookie;
  if (cookie) headers.set('cookie', cookie);
  // El Origin del navegador llega tal cual para que Express valide CLIENT_ORIGIN.
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
      // Render en plan gratuito duerme el servicio por inactividad y el primer
      // arranque es lento. Este margen debe quedar por debajo del maxDuration
      // declarado en vercel.json.
      signal: AbortSignal.timeout(25000),
    });

    res.status(response.status);
    const responseType = response.headers.get('content-type');
    if (responseType) res.setHeader('content-type', responseType);
    res.setHeader('cache-control', 'no-store');
    // getSetCookie conserva cada Set-Cookie por separado; un join los rompería.
    for (const c of response.headers.getSetCookie()) res.appendHeader('set-cookie', c);

    const bytes = Buffer.from(await response.arrayBuffer());
    res.end(bytes);
  } catch (err) {
    console.error('Proxy API no disponible', err instanceof Error ? err.message : 'error');
    res.status(502).json({ error: 'Servidor API temporalmente no disponible' });
  }
}
