// ═══════════════════════════════════════════════
// NEKO DESK — Instagram Feed Edge Function
//
// 배포:
//   supabase secrets set IG_PAGE_TOKEN="..." IG_USER_ID="17841479049408423"
//   supabase functions deploy instagram-feed
//
// 역할: Instagram Graph API를 서버에서 호출하고 피드 JSON을 반환.
//       토큰은 절대 클라이언트에 노출되지 않음.
// ═══════════════════════════════════════════════

const GRAPH_API = 'https://graph.facebook.com/v25.0';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15분

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

// 인메모리 캐시 (함수 인스턴스가 살아 있는 동안 유효)
let _cache: { data: unknown; ts: number } | null = null;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const PAGE_TOKEN = Deno.env.get('IG_PAGE_TOKEN');
  const IG_USER_ID = Deno.env.get('IG_USER_ID');

  if (!PAGE_TOKEN || !IG_USER_ID) {
    console.error('[instagram-feed] IG_PAGE_TOKEN 또는 IG_USER_ID 환경변수 미설정');
    return json({ error: 'server_misconfigured' }, 500);
  }

  // 캐시 히트
  if (_cache && Date.now() - _cache.ts < CACHE_TTL_MS) {
    return json({ data: _cache.data, cached: true });
  }

  const url =
    `${GRAPH_API}/${IG_USER_ID}/media` +
    `?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp` +
    `&limit=24` +
    `&access_token=${PAGE_TOKEN}`;

  let igRes: Response;
  try {
    igRes = await fetch(url);
  } catch (e) {
    console.error('[instagram-feed] fetch 실패:', e);
    return json({ error: 'fetch_failed' }, 502);
  }

  const igData = await igRes.json();

  // Graph API 에러 처리
  if (igData.error) {
    const { code, message, type } = igData.error;
    console.error(`[instagram-feed] Graph API 오류 code=${code} type=${type}: ${message}`);
    // code 190: 토큰 만료/무효 — 운영자가 Page 토큰을 갱신해야 함
    const status = code === 190 ? 401 : 502;
    return json({ error: { code, message, type } }, status);
  }

  if (!igData.data || !Array.isArray(igData.data)) {
    console.error('[instagram-feed] 예상치 못한 응답:', JSON.stringify(igData).slice(0, 200));
    return json({ error: 'unexpected_response' }, 502);
  }

  // 필요한 필드만 추려서 반환
  const posts = igData.data.map((p: Record<string, string>) => ({
    id: p.id,
    media_type: p.media_type,
    media_url: p.media_type === 'VIDEO' ? (p.thumbnail_url ?? '') : (p.media_url ?? ''),
    permalink: p.permalink ?? '',
    caption: p.caption ?? '',
    timestamp: p.timestamp ?? '',
  }));

  _cache = { data: posts, ts: Date.now() };

  return json({ data: posts, cached: false });
});
