"use client";

import { useState } from "react";
import type { BillingInterval, BillingState } from "@/lib/billing";
import { PlanOptions } from "./plan-options";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(value));
}

export default function BillingPageClient({ billing }: { billing: BillingState }) {
  const [loading, setLoading] = useState(false);
  const [couponLoading, setCouponLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<BillingInterval>(billing.billingInterval || "monthly");
  const [couponCode, setCouponCode] = useState("");
  const [error, setError] = useState("");

  async function subscribe() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interval: selectedPlan }),
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok || !body.ok) {
      setError("Não consegui abrir o checkout Asaas. Confira as variáveis de ambiente.");
      return;
    }
    window.location.href = body.checkoutUrl;
  }

  async function applyCoupon() {
    setCouponLoading(true);
    setError("");
    const response = await fetch("/api/billing/coupon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ couponCode, interval: selectedPlan }),
    });
    const body = await response.json();
    setCouponLoading(false);
    if (!response.ok || !body.ok) {
      setError("Cupom inválido ou expirado.");
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <main className="billing-page">
      <section className="billing-card">
        <a className="brand" href="/">Fidelizarei</a>
        <p className="eyebrow">ASSINATURA</p>
        <h1>Planos Fidelizarei</h1>
        <p className="muted">{billing.message}</p>
        <PlanOptions selectedPlan={selectedPlan} onSelect={setSelectedPlan} />
        {!billing.accessAllowed && (
          <div className="coupon-box">
            <label>Cupom de desconto<input value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="Digite seu cupom, se tiver" autoComplete="off" /></label>
            <button className="button button-light" disabled={couponLoading || !couponCode.trim()} onClick={applyCoupon}>{couponLoading ? "Aplicando..." : "Aplicar cupom"}</button>
          </div>
        )}
        <div className="billing-status">
          <div><span>Status</span><b>{billing.status}</b></div>
          <div><span>Teste grátis até</span><b>{formatDate(billing.trialEndsAt)}</b></div>
          <div><span>Próxima validade</span><b>{formatDate(billing.currentPeriodEnd)}</b></div>
        </div>
        {billing.accessAllowed ? (
          <a className="button button-dark" href="/dashboard">Ir para o painel</a>
        ) : (
          <button className="button button-dark" onClick={subscribe} disabled={loading}>{loading ? "Abrindo..." : "Assinar com Asaas"}</button>
        )}
        {billing.accessAllowed && <button className="button button-light" onClick={subscribe} disabled={loading}>{loading ? "Abrindo..." : "Gerenciar/ativar assinatura"}</button>}
        <p className="billing-note">O acesso é liberado automaticamente quando o Asaas confirmar o pagamento. Cupom válido libera o período promocional direto pelo Fidelizarei.</p>
        {error && <p className="form-error">{error}</p>}
      </section>
    </main>
  );
}
