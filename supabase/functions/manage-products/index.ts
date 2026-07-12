// ═══════════════════════════════════════════════
// NEKO DESK — 상품 관리 Edge Function (관리자 전용)
//
// 배포:
//   supabase functions deploy manage-products --no-verify-jwt
//   supabase secrets set ADMIN_API_SECRET=config.js와_같은_비밀키
//
// 역할: 앱의 관리자 폼에서 상품 추가/삭제 + 이미지 Storage 업로드
// 보안: x-admin-key 헤더가 ADMIN_API_SECRET과 일치할 때만 동작
// ═══════════════════════════════════════════════
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, x-admin-key",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    // 관리자 키 검증
    const adminKey = req.headers.get("x-admin-key");
    if (!adminKey || adminKey !== Deno.env.get("ADMIN_API_SECRET")) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action, name, price, link, cat, imgBase64, id, key, value } = body;

    if (action === "add") {
      if (!name || !price) return json({ ok: false, error: "missing_fields" }, 400);

      // 이미지 업로드 (base64 → Storage)
      let img_url: string | null = null;
      if (imgBase64) {
        const m = imgBase64.match(/^data:(image\/\w+);base64,(.+)$/);
        if (m) {
          const ext = m[1].split("/")[1] === "png" ? "png" : "jpg";
          const bytes = Uint8Array.from(atob(m[2]), (ch) => ch.charCodeAt(0));
          const fileName = `p_${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("product-images")
            .upload(fileName, bytes, { contentType: m[1] });
          if (!upErr) {
            const { data } = supabase.storage.from("product-images").getPublicUrl(fileName);
            img_url = data.publicUrl;
          }
        }
      }

      const { data, error } = await supabase
        .from("products")
        .insert({ name, price, link: link ?? null, cat: cat ?? "office", img_url })
        .select()
        .single();
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, product: data });
    }

    if (action === "delete") {
      if (!id) return json({ ok: false, error: "missing_id" }, 400);
      const { error } = await supabase.from("products").update({ active: false }).eq("id", id);
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "set-setting") {
      if (!key) return json({ ok: false, error: "missing_key" }, 400);
      const { error } = await supabase.from("app_settings").upsert({ key, value });
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ ok: false, error: "unknown_action" }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
