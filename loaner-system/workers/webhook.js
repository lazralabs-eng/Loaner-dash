/**
 * Loaner Command Center – Cloudflare Worker
 * Handles Dealerware webhooks (Infleet / Defleet) and optionally OBD (Stage 2).
 * Route: POST /webhooks/dealerware
 */

const DEALERWARE_PATH = "/webhooks/dealerware";
const OBD_PATH = "/webhooks/obd";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    if (url.pathname === DEALERWARE_PATH) {
      return handleDealerware(request, env);
    }
    if (url.pathname === OBD_PATH) {
      return handleObd(request, env);
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
};
async function verifyDealerwareSignature(payload, secret) {
  if (!payload?.data || !payload?.signature || !secret) return false;
  const message = JSON.stringify(payload.data);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  const expectedHex = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expectedHex === payload.signature;
}

/**
 * POST /webhooks/dealerware – Infleet or Defleet
 */
async function handleDealerware(request, env) {
  const { DEALERWARE_SECRET, SUPABASE_URL, SUPABASE_KEY } = env;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_KEY");
    const missing = [].concat(
      !SUPABASE_URL ? "SUPABASE_URL" : [],
      !SUPABASE_KEY ? "SUPABASE_KEY" : []
    );
    return jsonResponse(
      {
        error: "Server configuration error",
        detail: `Missing: ${missing.join(", ")}. For production: run 'wrangler secret put SUPABASE_URL' (and SUPABASE_KEY, DEALERWARE_SECRET) from loaner-system/workers with --env production, then redeploy. For local: use .dev.vars in that directory.`,
      },
      500
    );
  }
  if (!DEALERWARE_SECRET) {
    return jsonResponse({ error: "Signature validation failed" }, 401);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  if (payload.resource !== "Vehicle") {
    return jsonResponse({ error: "Invalid resource" }, 400);
  }

  // const valid = await verifyDealerwareSignature(payload, DEALERWARE_SECRET);
  // if (!valid) {
  //   return jsonResponse({ error: "Signature validation failed" }, 401);
  // }

  const state = payload.state;
  const data = payload.data || {};
  const timestamp = payload.timestamp || new Date().toISOString();

  if (state === "Infleet") {
    return handleInfleet(env, data, timestamp);
  }
  if (state === "Defleet") {
    return handleDefleet(env, data, timestamp);
  }

  return jsonResponse({ error: "Unsupported state" }, 400);
}

/**
 * Infleet: create loaner_requests row (status = active), audit, return 201.
 */
async function handleInfleet(env, data, timestamp) {
  const vin = data.vin;
  if (!vin) {
    return jsonResponse({ error: "Missing vin in data" }, 400);
  }

  const row = {
    request_type: "infleet",
    status: "active",
    vin: vin,
    year: data.year ?? null,
    make: data.make ?? null,
    model: data.model ?? null,
    color: data.color ?? null,
    license_plate: data.licensePlate ?? null,
    mileage_at_infleet: data.mileage ?? null,
    customer_id: data.customerId ?? null,
    customer_name: data.customerName ?? null,
    infleet_approved_at: new Date().toISOString(),
    infleet_dealer_matched: true,
    date_infleet: data.dateInfleet ?? null,
  };

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/loaner_requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Apikey: env.SUPABASE_KEY,
      Authorization: `Bearer ${env.SUPABASE_KEY}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Supabase insert failed", res.status, text);
    // Surface Supabase message for debugging (e.g. RLS: use service_role key in SUPABASE_KEY)
    let detail = "Database error";
    try {
      const err = JSON.parse(text);
      if (err.message) detail = err.message;
    } catch {
      if (text) detail = text.slice(0, 200);
    }
    return jsonResponse({ error: "Database error", detail }, 500);
  }

  const inserted = await res.json();
  const id = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;
  if (id) {
    await insertAudit(env, {
      event: "infleet_matched",
      loaner_request_id: id,
      actor: "dealerware_webhook",
      metadata: { vin, timestamp },
    });
  }

  return jsonResponse({ success: true, event: "infleet", vin }, 201);
}

/**
 * Defleet: find active by VIN, update to return_requested, audit, return 200.
 */
async function handleDefleet(env, data, timestamp) {
  const vin = data.vin;
  if (!vin) {
    return jsonResponse({ error: "Missing vin in data" }, 400);
  }

  const listRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/loaner_requests?vin=eq.${encodeURIComponent(vin)}&status=eq.active&select=id`,
    {
      method: "GET",
      headers: {
        Apikey: env.SUPABASE_KEY,
        Authorization: `Bearer ${env.SUPABASE_KEY}`,
      },
    },
  );
  if (!listRes.ok) {
    console.error("Supabase select failed", listRes.status);
    return jsonResponse({ error: "Database error" }, 500);
  }

  const rows = await listRes.json();
  if (!rows || rows.length === 0) {
    console.warn("Defleet: no active loaner found for vin", vin);
    return jsonResponse(
      {
        success: true,
        event: "defleet",
        vin,
        warning: "No active loaner found for this VIN",
      },
      200,
    );
  }

  const id = rows[0].id;
  const updateRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/loaner_requests?id=eq.${id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Apikey: env.SUPABASE_KEY,
        Authorization: `Bearer ${env.SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        status: "return_requested",
        mileage_at_defleet: data.mileage ?? null,
        defleet_dealer_timestamp: timestamp,
        defleet_dealer_matched: true,
      }),
    },
  );

  if (!updateRes.ok) {
    const text = await updateRes.text();
    console.error("Supabase update failed", updateRes.status, text);
    return jsonResponse({ error: "Database error" }, 500);
  }

  await insertAudit(env, {
    event: "defleet_matched",
    loaner_request_id: id,
    actor: "dealerware_webhook",
    metadata: { vin, timestamp },
  });

  return jsonResponse({ success: true, event: "defleet", vin }, 200);
}

async function insertAudit(env, body) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/loaner_audit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Apikey: env.SUPABASE_KEY,
      Authorization: `Bearer ${env.SUPABASE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("Audit insert failed", await res.text());
  }
}

/**
 * POST /webhooks/obd – Stage 2: real-time mileage (stub returns 200).
 */
async function handleObd(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }
  const vin = payload?.vin;
  const mileage = payload?.mileage;
  if (!vin || mileage == null) {
    return jsonResponse({ error: "Missing vin or mileage" }, 400);
  }
  // TODO: find active loaner by VIN, update current_mileage and mileage_updated_at
  return jsonResponse({ success: true, vin, mileage }, 200);
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
