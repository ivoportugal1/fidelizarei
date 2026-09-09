"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { PlanOptions } from "@/app/billing/plan-options";

export default function SignupPage() {
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [couponCode, setCouponCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessName, ownerName, taxId, email, password, billingInterval, couponCode }),
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok || !body.ok) {
      setError(body.error === "email_already_exists" ? "Esse email já tem uma conta." : body.error === "invalid_coupon" ? "Cupom inválido ou expirado." : "Preencha todos os campos. CPF/CNPJ precisa ser válido e a senha deve ter pelo menos 8 caracteres.");
      return;
    }
    window.location.href = body.nextUrl || "/billing";
  }

  return (
    <main className="login-page">
      <form className="login-card signup-card" onSubmit={submit}>
        <a className="brand" href="/">fideliza<span>.</span></a>
        <p className="eyebrow">ESCOLHA SEU PLANO</p>
        <h1>Criar conta</h1>
        <p className="muted">Escolha mensal ou anual. Se recebeu um cupom da Fidelizarei, aplique antes de criar a conta.</p>
        <PlanOptions selectedPlan={billingInterval} onSelect={setBillingInterval} compact />
        <label>Cupom de desconto <input value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="Digite seu cupom, se tiver" autoComplete="off" /></label>
        <label>Nome da empresa<input value={businessName} onChange={(event) => setBusinessName(event.target.value)} autoComplete="organization" /></label>
        <label>CPF ou CNPJ<input value={taxId} onChange={(event) => setTaxId(event.target.value)} inputMode="numeric" placeholder="Somente números" autoComplete="off" required /></label>
        <label>Seu nome<input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} autoComplete="name" /></label>
        <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" /></label>
        <label>Senha<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="button button-dark" disabled={loading}>{loading ? "Criando..." : couponCode.trim() ? "Criar conta com cupom" : "Criar conta e escolher pagamento"}</button>
        <p className="auth-switch">Já tem conta? <Link href="/login">Entrar</Link></p>
      </form>
    </main>
  );
}
