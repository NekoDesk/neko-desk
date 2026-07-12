// ═══════════════════════════════════════════════
// NEKO DESK — 토스페이먼츠 결제 승인 Edge Function
//
// 배포 방법 (Supabase CLI 설치 후):
//   supabase functions deploy confirm-payment
//   supabase secrets set TOSS_SECRET_KEY=test_sk_여기에_시크릿키
//
// 역할:
//   1. 앱에서 결제 완료 → paymentKey/orderId/amount 전달받음
//   2. 토스 승인 API를 시크릿 키로 호출 (최종 승인)
//   3. 성공 시 orders 테이블에 주문 + 배송지 저장
// ═══════════════════════════════════════════════
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { paymentKey, orderId, amount, product, shipping, buyerEmail } = await req.json();

    if (!paymentKey || !orderId || !amount || !shipping?.name || !shipping?.addr1) {
      return new Response(JSON.stringify({ ok: false, error: "missing_fields" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 1) 토스 결제 승인 (시크릿 키는 서버에만 존재)
    const secret = Deno.env.get("TOSS_SECRET_KEY")!;
    const confirmRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(secret + ":"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    const confirm = await confirmRes.json();
    if (!confirmRes.ok) {
      return new Response(JSON.stringify({ ok: false, error: confirm.message || "confirm_failed" }),
        { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 2) 주문 저장 (service role → RLS 우회)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { error } = await supabase.from("orders").insert({
      order_id: orderId,
      payment_key: paymentKey,
      product_id: product?.id ?? null,
      product_name: product?.name ?? "상품",
      amount,
      buyer_email: buyerEmail ?? null,
      ship_name: shipping.name,
      ship_phone: shipping.phone,
      ship_postal: shipping.postal ?? null,
      ship_addr1: shipping.addr1,
      ship_addr2: shipping.addr2 ?? null,
    });
    if (error) {
      // 결제는 승인됐는데 저장 실패 → 토스 콘솔에서 주문 확인 가능하니 로그만
      console.error("order insert failed:", error);
    }

    return new Response(JSON.stringify({ ok: true, receipt: confirm.receipt?.url ?? null }),
      { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
