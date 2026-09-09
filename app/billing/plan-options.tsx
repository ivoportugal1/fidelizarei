"use client";

import type { BillingInterval } from "@/lib/billing";

export function PlanOptions({ selectedPlan, onSelect, compact = false }: {
  selectedPlan: BillingInterval;
  onSelect: (plan: BillingInterval) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "billing-plans compact" : "billing-plans"}>
      <button type="button" className={selectedPlan === "monthly" ? "billing-plan active" : "billing-plan"} onClick={() => onSelect("monthly")}>
        <span>Mensal</span>
        <b>R$ 60</b>
        <small>por mês, após 30 dias grátis</small>
      </button>
      <button type="button" className={selectedPlan === "yearly" ? "billing-plan annual active" : "billing-plan annual"} onClick={() => onSelect("yearly")}>
        <em>Desconto Fidelizarei</em>
        <span>Anual</span>
        <b>R$ 600</b>
        <small><strong>Equivale a R$ 60 × 10.</strong> Use 12 meses e pague só 10. Você economiza R$ 120 no ano.</small>
      </button>
    </div>
  );
}
