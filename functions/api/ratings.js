export async function onRequestGet({ env }) {
  // Returns: { "<tab_id>": { avg: 4.6, count: 12 }, ... }

  const sql = `
    SELECT tab_id,
           ROUND(AVG(rating), 2) AS avg,
           COUNT(*) AS count
    FROM ratings
    GROUP BY tab_id
  `;

  const { results } = await env.DB.prepare(sql).all();

  const out = {};
  for (const row of results) {
    out[row.tab_id] = {
      avg: Number(row.avg),
      count: Number(row.count),
    };
  }

  return new Response(JSON.stringify(out), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
