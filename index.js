const express = require("express");
const axios = require("axios");
const app = express();

app.use(express.json());

// ── Config ────────────────────────────────────────────────────────────────────
const CHARGEBEE_SITE = process.env.CHARGEBEE_SITE || "lathuworld25-test";
const CHARGEBEE_API_KEY = process.env.CHARGEBEE_API_KEY || "test_0Ql8TEzfR80vSpvobLuv0us87HsB61UF";
const PORT = process.env.PORT || 3000;

// ── Chargebee API helper ──────────────────────────────────────────────────────
async function chargebeeRequest(path, method = "GET", body = null) {
  const url = `https://${CHARGEBEE_SITE}.chargebee.com/api/v2${path}`;

  const res = await axios({
    method,
    url,
    auth: { username: CHARGEBEE_API_KEY, password: "" },
    data: body ? new URLSearchParams(body).toString() : undefined,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  return res.data;
}

// ── Assign Primary payment role ───────────────────────────────────────────────
async function assignPrimaryRole(customerId, paymentSourceId) {
  console.log(
    `  → Assigning PRIMARY role to source ${paymentSourceId} for customer ${customerId}`
  );

  await chargebeeRequest(
    `/customers/${customerId}/assign_payment_role`,
    "POST",
    {
      payment_source_id: paymentSourceId,
      role: "primary",
    }
  );

  console.log(`  ✓ Done — ${paymentSourceId} is now Primary.`);
}

// ── Webhook endpoint ──────────────────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  const event = req.body;
  const eventType = event?.event_type;

  console.log(`\n[${new Date().toISOString()}] Event received: ${eventType}`);

  if (eventType !== "payment_source_added") {
    return res.status(200).json({ status: "ignored", eventType });
  }

  try {
    const paymentSource = event?.content?.payment_source;
    const customerId = paymentSource?.customer_id;
    const sourceId = paymentSource?.id;

    if (!customerId || !sourceId) {
      console.error("  ✗ Missing customer_id or payment source id in payload");
      return res.status(400).json({ error: "Invalid payload" });
    }

    console.log(`  Customer : ${customerId}`);
    console.log(`  Source   : ${sourceId} (${paymentSource?.type || "unknown type"})`);

    await assignPrimaryRole(customerId, sourceId);

    return res.status(200).json({ status: "ok", promoted: sourceId });
  } catch (err) {
    console.error("  ✗ Error:", err.message);
    return res.status(200).json({ status: "error", message: err.message });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) =>
  res.json({ status: "running", site: CHARGEBEE_SITE })
);

app.listen(PORT, () =>
  console.log(`Chargebee webhook listener running on port ${PORT}`)
);