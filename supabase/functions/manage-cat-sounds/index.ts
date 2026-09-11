// ═══════════════════════════════════════════════
// NEKO DESK — 고양이 소리 관리 Edge Function (관리자 전용)
//
// 소리도 고양이 이미지처럼 서버에 두고 관리 화면에서 다룬다.
// 앱은 켤 때 목록을 받아 기기에 내려받아 둔다 — 앱을 새로 배포하지 않아도 바뀐다.
//
// 배포: supabase functions deploy manage-cat-sounds --no-verify-jwt
// ═══════════════════════════════════════════════
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "cat-sounds";
const ROLES = ["touch", "call1", "call2", "water", "fruit"] as const;
/** touch 만 여러 개. 나머지는 하나만 두므로 올리면 있던 것을 갈아 끼운다. */
const SINGLE = new Set(["call1", "call2", "water", "fruit"]);

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
    const { action, id, role, name, audioBase64, ids } = body;

    // 버킷은 처음 쓸 때 스스로 만든다 — 대시보드에서 손으로 만들 필요가 없도록
    const ensureBucket = async () => {
      const { data } = await supabase.storage.getBucket(BUCKET);
      if (data) return;
      await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024,   // 형식은 올리는 쪽에서 확장자로 거른다
      });
    };

    const uploadAudio = async (b64: string, tag: string): Promise<string | null> => {
      const m = b64.match(/^data:(audio\/[\w.+-]+);base64,(.+)$/);
      if (!m) return null;
      const mime = m[1];
      const ext = /mpeg|mp3/.test(mime) ? "mp3" : /mp4|m4a/.test(mime) ? "m4a" : /wav/.test(mime) ? "wav" : /ogg/.test(mime) ? "ogg" : "mp3";
      const bytes = Uint8Array.from(atob(m[2]), (ch) => ch.charCodeAt(0));
      const fileName = `snd_${Date.now()}_${tag}.${ext}`;
      await ensureBucket();
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(fileName, bytes, { contentType: mime });
      if (upErr) return null;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
      return data.publicUrl;
    };

    /** 공개 주소에서 버킷 안 경로만 뽑는다 (지울 때) */
    const pathOf = (url: string | null) => {
      if (!url) return null;
      const i = url.indexOf(`/${BUCKET}/`);
      return i < 0 ? null : url.slice(i + BUCKET.length + 2);
    };
    const removeFiles = async (urls: (string | null)[]) => {
      const paths = urls.map(pathOf).filter((p): p is string => !!p);
      if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    };

    if (action === "list") {
      const { data, error } = await supabase
        .from("cat_sounds")
        .select("id, role, ord, name, file_url, created_at")
        .order("role", { ascending: true })
        .order("ord", { ascending: true });
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, sounds: data ?? [] });
    }

    if (action === "add") {
      if (!ROLES.includes(role)) return json({ ok: false, error: "bad_role" }, 400);
      if (!audioBase64) return json({ ok: false, error: "missing_audio" }, 400);

      const file_url = await uploadAudio(audioBase64, role);
      if (!file_url) return json({ ok: false, error: "upload_failed" }, 500);

      // 하나만 두는 역할은 있던 것을 지우고 갈아 끼운다
      let ord = 0;
      if (SINGLE.has(role)) {
        const { data: olds } = await supabase.from("cat_sounds").select("id, file_url").eq("role", role);
        if (olds?.length) {
          await removeFiles(olds.map((o: { file_url: string }) => o.file_url));
          await supabase.from("cat_sounds").delete().eq("role", role);
        }
      } else {
        const { data: last } = await supabase
          .from("cat_sounds").select("ord").eq("role", role).order("ord", { ascending: false }).limit(1);
        ord = last?.length ? (last[0].ord ?? 0) + 1 : 0;
      }

      const { data, error } = await supabase
        .from("cat_sounds")
        .insert({ role, ord, name: name || null, file_url })
        .select()
        .single();
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, sound: data });
    }

    if (action === "rename") {
      if (!id) return json({ ok: false, error: "missing_id" }, 400);
      const { error } = await supabase.from("cat_sounds").update({ name: name || null }).eq("id", id);
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true });
    }

    // 쓰다듬기 소리 차례 — 관리 화면이 보낸 id 순서대로 ord 를 매긴다
    if (action === "reorder") {
      if (!Array.isArray(ids)) return json({ ok: false, error: "missing_ids" }, 400);
      for (let i = 0; i < ids.length; i++) {
        const { error } = await supabase.from("cat_sounds").update({ ord: i }).eq("id", ids[i]);
        if (error) return json({ ok: false, error: error.message }, 500);
      }
      return json({ ok: true });
    }

    if (action === "delete") {
      if (!id) return json({ ok: false, error: "missing_id" }, 400);
      const { data: row } = await supabase.from("cat_sounds").select("file_url").eq("id", id).maybeSingle();
      const { error } = await supabase.from("cat_sounds").delete().eq("id", id);
      if (error) return json({ ok: false, error: error.message }, 500);
      if (row) await removeFiles([row.file_url]);   // 줄을 지운 뒤에 파일을 — 반대로 하면 깨진 줄이 남는다
      return json({ ok: true });
    }

    return json({ ok: false, error: "unknown_action" }, 400);
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
