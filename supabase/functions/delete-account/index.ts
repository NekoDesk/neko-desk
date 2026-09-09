// ═══════════════════════════════════════════════
// NEKO DESK — 계정 삭제 (본인만)
//
// 애플·구글 모두 "계정을 만들 수 있는 앱은 앱 안에서 계정을 지울 수 있어야 한다"고
// 요구한다 (App Store 5.1.1(v)). 로그아웃이나 데이터 초기화로는 모자라고,
// 로그인 계정 자체가 사라져야 한다.
//
// 계정 삭제는 서비스 역할 열쇠가 있어야 해서 앱에서 직접 못 한다. 그래서 여기서
// 사용자가 보낸 토큰으로 본인임을 확인한 뒤, 그 사람 자신의 계정만 지운다.
//
// 배포: supabase functions deploy delete-account
// ═══════════════════════════════════════════════
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    // 누구인지는 토큰으로만 정한다. 몸통으로 받은 id 를 믿으면 남의 계정을 지울 수 있다.
    const auth = req.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return json({ ok: false, error: "no_token" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: got, error: whoErr } = await admin.auth.getUser(token);
    const user = got?.user;
    if (whoErr || !user) return json({ ok: false, error: "bad_token" }, 401);

    // 동기화해 둔 기록을 먼저 지운다. 계정이 사라지면 손댈 길이 없어진다.
    await admin.from("nekodesk_sync").delete().eq("user_id", user.id);

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) return json({ ok: false, error: delErr.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
