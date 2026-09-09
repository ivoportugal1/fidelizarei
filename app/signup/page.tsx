"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { PlanOptions } from "@/app/billing/plan-options";

export default function SignupPage() {
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessName, ownerName, email, password, billingInterval }),
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok || !body.ok) {
      setError(body.error === "email_already_exists" ? "Esse email já tem uma conta." : "Preencha os dados corretamente. A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <main className="login-page">
      <form className="login-card signup-card" onSubmit={submit}>
        <a className="brand" href="/">fideliza<span>.</span></a>
        <p className="eyebrow">COMECE EM 30 DIAS GRÁTIS</p>
        <h1>Criar conta</h1>
        <p className="muted">Escolha o plano agora. Você só começa a pagar depois dos 30 dias grátis.</p>
        <PlanOptions selectedPlan={billingInterval} onSelect={setBillingInterval} compact />
        <label>Nome da empresa<input value={businessName} onChange={(event) => setBusinessName(event.target.value)} autoComplete="organization" /></label>
        <label>Seu nome<input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} autoComplete="name" /></label>
        <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" /></label>
        <label>Senha<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="button button-dark" disabled={loading}>{loading ? "Criando..." : "Criar conta grátis"}</button>
        <p className="auth-switch">Já tem conta? <Link href="/login">Entrar</Link></p>
      </form>
    </main>
  );
}
