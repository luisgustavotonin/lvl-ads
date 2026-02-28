import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return Response.json({ error: 'URL required' }, { status: 400 });
    }

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; UnifiedAds/1.0)' }
    });

    if (!response.ok) {
      return Response.json({ error: `Fetch failed: ${response.status}` }, { status: 400 });
    }

    const buffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    return Response.json({ dataUrl: `data:${contentType};base64,${base64}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});