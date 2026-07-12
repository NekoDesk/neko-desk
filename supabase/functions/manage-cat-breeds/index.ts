// ═══════════════════════════════════════════════
// NEKO DESK — 고양이 종류 관리 Edge Function (관리자 전용)
//
// 배포: supabase functions deploy manage-cat-breeds --no-verify-jwt
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
    const adminKey = req.headers.get("x-admin-key");
    if (!adminKey || adminKey !== Deno.env.get("ADMIN_API_SECRET")) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action, name, desc: description, imgBase64Front, imgBase64Side, id } = body;

    const uploadImage = async (b64: string, suffix: string): Promise<string | null> => {
      const m = b64.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!m) return null;
      const ext = m[1].split("/")[1] === "png" ? "png" : "jpg";
      const bytes = Uint8Array.from(atob(m[2]), (ch) => ch.charCodeAt(0));
      const fileName = `cat_${Date.now()}_${suffix}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("cat-images")
        .upload(fileName, bytes, { contentType: m[1] });
      if (upErr) return null;
      const { data } = supabase.storage.from("cat-images").getPublicUrl(fileName);
      return data.publicUrl;
    };

    if (action === "add") {
      if (!name) return json({ ok: false, error: "missing_name" }, 400);

      const image_url = imgBase64Front ? await uploadImage(imgBase64Front, "F") : null;
      const image_url_side = imgBase64Side ? await uploadImage(imgBase64Side, "S") : null;

      const { data, error } = await supabase
        .from("cat_breeds")
        .insert({ name, description: description ?? null, image_url, image_url_side })
        .select()
        .single();
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, breed: data });
    }

    if (action === "delete") {
      if (!id) return json({ ok: false, error: "missing_id" }, 400);
      const { error } = await supabase.from("cat_breeds").delete().eq("id", id);
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "delete-all") {
      // Delete all storage files in cat-images bucket
      const { data: files } = await supabase.storage.from("cat-images").list("", { limit: 1000 });
      if (files && files.length > 0) {
        const paths = files.map((f: { name: string }) => f.name);
        await supabase.storage.from("cat-images").remove(paths);
      }
      // Delete all rows in cat_breeds
      const { error } = await supabase.from("cat_breeds").delete().neq("id", 0);
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, deleted: files?.length ?? 0 });
    }

    return json({ ok: false, error: "unknown_action" }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
