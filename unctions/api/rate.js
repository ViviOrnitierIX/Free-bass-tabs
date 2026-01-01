function getClientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "0.0.0.0"
  );
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const tab_id = String(body?.id || "").trim();
  const rating = Number(body?.rating);

  if (!tab_id) {
    return new Response(JSON.stringify({ ok: false, error: "Missing id" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return new Response(JSON.stringify({ ok: false, error: "Rating must be 1–5" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  // Privacy-friendly-ish: hash the IP before storing.
  // You can change SALT later; it just needs to stay consistent.
  const SALT = "freebasstabs-v1";
  const ip = getClientIp(request);
  const ip_hash = await sha256Hex(`${ip}|${SALT}`);

  // One rating per (tab_id, ip_hash). If they rate again, it updates.
  const sql = `
    INSERT INTO ratings (tab_id, rating, ip_hash, created_at)
    VALUES (?, ?, ?, unixepoch())
    ON CONFLICT(tab_id, ip_hash)
    DO UPDATE SET rating=excluded.rating, created_at=unixepoch()
  `;

  await env.DB.prepare(sql).bind(tab_id, rating, ip_hash).run();

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
