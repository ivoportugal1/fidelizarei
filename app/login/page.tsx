"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("admin@fidelizarei.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!response.ok) {
      setError("Email ou senha inválidos.");
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <a className="brand" href="/">fideliza<span>.</span></a>
        <p className="eyebrow">ACESSO DA EMPRESA</p>
        <h1>Entrar no painel</h1>
        <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" /></label>
        <label>Senha<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="button button-dark" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
      </form>
    </main>
  );
}
