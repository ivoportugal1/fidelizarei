// Fake BeeFood: serves /v1/oauth/token and /v1/orders/:id, then sends webhooks to Fidelizarei.
// Run the app with BEEFOOD_API_BASE_URL=http://localhost:4010, then:
//   WEBHOOK_URL=<url from beefood-seed> WEBHOOK_SECRET=<secret> node scripts/beefood-simulate.mjs [scenario|all]
import { createServer } from "node:http";

const webhookUrl = process.env.WEBHOOK_URL;
const secret = process.env.WEBHOOK_SECRET;
const port = Number(process.env.FAKE_BEEFOOD_PORT || 4010);
if (!webhookUrl || !secret) {
  console.error("WEBHOOK_URL and WEBHOOK_SECRET are required.");
  process.exit(1);
}

const run = Date.now();
const orders = {};
function order(id, orderType, amount, pending) {
  orders[id] = { orderType, total: { orderAmount: amount }, payments: { pending }, merchant: { storeId: "sandbox-store" } };
  return id;
}

const scenarios = {
  paid_above_minimum: () => [{ event: "payment_created", orderId: order(`${run}-1`, "PDV", 50, 0) }],
  below_minimum: () => [{ event: "payment_created", orderId: order(`${run}-2`, "PDV", 1, 0) }],
  delivery: () => [{ event: "payment_created", orderId: order(`${run}-3`, "DELIVERY", 50, 0) }],
  payment_pending: () => [{ event: "payment_created", orderId: order(`${run}-4`, "PDV", 50, 50) }],
  duplicate_event: () => {
    const id = order(`${run}-5`, "PDV", 50, 0);
    return [{ event: "payment_created", orderId: id }, { event: "payment_created", orderId: id }];
  },
  pending_then_paid: () => {
    const id = order(`${run}-6`, "PDV", 50, 50);
    return [{ event: "payment_created", orderId: id }, { event: "payment_updated", orderId: id, before() { orders[id].payments.pending = 0; } }];
  },
  wrong_secret: () => [{ event: "payment_created", orderId: order(`${run}-7`, "PDV", 50, 0), secret: "wrong" }],
};

const fake = createServer((request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method === "POST" && request.url === "/v1/oauth/token") {
    response.end(JSON.stringify({ accessToken: "fake-token", refreshToken: "fake-refresh", expiresIn: 300 }));
    return;
  }
  const match = request.url?.match(/^\/v1\/orders\/([^/?]+)/);
  if (match && orders[decodeURIComponent(match[1])]) {
    response.end(JSON.stringify(orders[decodeURIComponent(match[1])]));
    return;
  }
  response.statusCode = 404;
  response.end("{}");
});
await new Promise((resolve) => fake.listen(port, resolve));
console.log(`Fake BeeFood listening on :${port}`);

const wanted = process.argv[2] && process.argv[2] !== "all" ? [process.argv[2]] : Object.keys(scenarios);
for (const name of wanted) {
  if (!scenarios[name]) { console.error(`Unknown scenario ${name}. Options: ${Object.keys(scenarios).join(", ")}`); continue; }
  console.log(`\n# ${name}`);
  for (const step of scenarios[name]()) {
    step.before?.();
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Webhook-Secret": step.secret ?? secret },
      body: JSON.stringify({ eventType: step.event, orderId: step.orderId, orderType: orders[step.orderId].orderType, salesChannel: "POS" }),
    });
    console.log(`  ${step.event} ${step.orderId} -> ${response.status} ${await response.text()}`);
  }
}
fake.close();
