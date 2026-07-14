// ═══════════════════════════════════════════════
// NEKO DESK — Claim Welcome Bonus Edge Function
//
// 배포:
//   supabase functions deploy claim-welcome-bonus
//
// 역할: 구글 로그인 최초 1회, 계정(이메일)당 200pt 환영 보너스 지급 여부 확인 + 기록.
//       welcome_claims 테이블은 RLS ON + 정책 없음 → 클라이언트 직접 접근 불가.
//       service_role 로 우회해서 확인/삽입.
// ═══════════════════════════════════════════════

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: '서버 설정 오류' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }

  let email: string;
  try {
    const body = await req.json();
    email = (body.email || '').trim().toLowerCase();
  } catch {
    return new Response(JSON.stringify({ error: '잘못된 요청' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }

  if (!email || email === 'guest') {
    return new Response(JSON.stringify({ ok: false, reason: 'no_email' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }

  const sbHeaders = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  // 이미 지급된 계정인지 확인
  const checkRes = await fetch(
    `${supabaseUrl}/rest/v1/welcome_claims?email=eq.${encodeURIComponent(email)}&select=email&limit=1`,
    { headers: sbHeaders }
  );
  if (!checkRes.ok) {
    const errBody = await checkRes.text().catch(() => '(읽기 실패)');
    return new Response(JSON.stringify({ error: `조회 실패 [${checkRes.status}]: ${errBody}` }), {
      status: 502, headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
  const rows = await checkRes.json();
  if (Array.isArray(rows) && rows.length > 0) {
    return new Response(JSON.stringify({ ok: false, reason: 'already' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }

  // 미지급 → 기록 삽입
  const insertRes = await fetch(
    `${supabaseUrl}/rest/v1/welcome_claims`,
    {
      method: 'POST',
      headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ email }),
    }
  );
  if (!insertRes.ok) {
    const errBody = await insertRes.text().catch(() => '(읽기 실패)');
    return new Response(JSON.stringify({ error: `기록 실패 [${insertRes.status}]: ${errBody}` }), {
      status: 502, headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ ok: true, pts: 200 }), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }
  });
});
