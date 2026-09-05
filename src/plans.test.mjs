import test from "node:test";
import assert from "node:assert/strict";
import { PLAN_COMPARISON, PRO_PRICING, PRO_VALUE_CARDS } from "./plans.mjs";

test("Pro pricing preserves the approved monthly and annual offers", () => {
  assert.equal(PRO_PRICING.monthly, 5.99);
  assert.equal(PRO_PRICING.annual, 39);
  assert.equal(PRO_PRICING.foundingAnnual, 29);
  assert.ok(PRO_PRICING.annual < PRO_PRICING.monthly * 12);
});

test("the public comparison keeps schedule generation free and management in Pro", () => {
  const generation = PLAN_COMPARISON.find((item) => item.feature.startsWith("Generate"));
  const publishing = PLAN_COMPARISON.find((item) => item.feature.startsWith("Publish"));

  assert.deepEqual(generation, { feature: "Generate singles, doubles, and mixed schedules", free: true, pro: true });
  assert.deepEqual(publishing, { feature: "Publish a live results link", free: false, pro: true });
  assert.equal(PRO_VALUE_CARDS.length, 3);
});
