// Shared goal tracker API for Vercel (Node.js serverless function).
// Storage: Upstash Redis over its REST API (add it from the Vercel Marketplace).
// Env vars (either naming works):
//   KV_REST_API_URL / KV_REST_API_TOKEN
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
// Optional:
//   EDIT_PIN        if set, changes require this PIN (viewing stays open)
//   TRACKER_PREFIX  key prefix, default "rohan" (use a new one per student)

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const EDIT_PIN = process.env.EDIT_PIN || "";
const PREFIX = (process.env.TRACKER_PREFIX || "rohan").replace(/[^a-z0-9-]/gi, "");

const STATUSES = ["todo", "doing", "done"];
const ID_RE = /^[a-z0-9-]{1,40}$/i;

const KEY_STATUS = `${PREFIX}:status`;
const KEY_GOALS = `${PREFIX}:goals`;
const KEY_UPDATED = `${PREFIX}:updated`;

async function redis(command) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const data = await r.json();
  if (!r.ok || data.error) throw new Error(data.error || `Redis HTTP ${r.status}`);
  return data.result;
}

function pairsToObject(arr) {
  const out = {};
  for (let i = 0; arr && i < arr.length; i += 2) out[arr[i]] = arr[i + 1];
  return out;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(503).json({ error: "storage_not_configured" });
  }

  try {
    if (req.method === "GET") {
      const [status, goals, updatedAt] = await Promise.all([
        redis(["HGETALL", KEY_STATUS]),
        redis(["HGETALL", KEY_GOALS]),
        redis(["GET", KEY_UPDATED]),
      ]);
      const goalList = Object.values(pairsToObject(goals))
        .map((v) => { try { return JSON.parse(v); } catch { return null; } })
        .filter(Boolean);
      return res.status(200).json({
        status: pairsToObject(status),
        goals: goalList,
        updatedAt: updatedAt || null,
        pinRequired: Boolean(EDIT_PIN),
      });
    }

    if (req.method === "POST") {
      if (EDIT_PIN && req.headers["x-edit-pin"] !== EDIT_PIN) {
        return res.status(401).json({ error: "bad_pin" });
      }

      let body;
      try { body = await readBody(req); } catch { return res.status(400).json({ error: "bad_json" }); }
      const { action } = body;

      if (action === "setStatus") {
        const { id, status } = body;
        if (!ID_RE.test(id || "") || !STATUSES.includes(status)) return res.status(400).json({ error: "bad_input" });
        await redis(["HSET", KEY_STATUS, id, status]);
      } else if (action === "addGoal") {
        const text = String(body.text || "").trim().slice(0, 200);
        const week = Number(body.week);
        if (!text || !Number.isInteger(week) || week < 1 || week > 12) return res.status(400).json({ error: "bad_input" });
        const id = `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        const goal = { id, text, week, status: "todo", createdAt: new Date().toISOString() };
        await redis(["HSET", KEY_GOALS, id, JSON.stringify(goal)]);
      } else if (action === "setGoalStatus") {
        const { id, status } = body;
        if (!ID_RE.test(id || "") || !STATUSES.includes(status)) return res.status(400).json({ error: "bad_input" });
        const raw = await redis(["HGET", KEY_GOALS, id]);
        if (!raw) return res.status(404).json({ error: "not_found" });
        const goal = JSON.parse(raw);
        goal.status = status;
        await redis(["HSET", KEY_GOALS, id, JSON.stringify(goal)]);
      } else if (action === "deleteGoal") {
        const { id } = body;
        if (!ID_RE.test(id || "")) return res.status(400).json({ error: "bad_input" });
        await redis(["HDEL", KEY_GOALS, id]);
      } else {
        return res.status(400).json({ error: "unknown_action" });
      }

      const updatedAt = new Date().toISOString();
      await redis(["SET", KEY_UPDATED, updatedAt]);
      return res.status(200).json({ ok: true, updatedAt });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method_not_allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
}
