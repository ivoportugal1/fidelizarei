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
        <b>R$ 79,90</b>
        <small>cobrança mensal recorrente</small>
      </button>
      <button type="button" className={selectedPlan === "yearly" ? "billing-plan annual active" : "billing-plan annual"} onClick={() => onSelect("yearly")}>
        <em>Desconto Fidelizarei</em>
        <span>Anual</span>
        <b>R$ 640</b>
        <small><strong>Equivale a R$ 53,33 por mês.</strong> Pague R$ 640 por 12 meses.</small>
      </button>
    </div>
  );
}
