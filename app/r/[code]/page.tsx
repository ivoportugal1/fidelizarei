"use client";

import { use, useEffect, useState } from "react";

type CodeInfo = {
  ok: boolean;
  status?: string;
  programName?: string;
  organizationName?: string;
};

export default function RedeemPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [info, setInfo] = useState<CodeInfo | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ points: number; rewards_available: number; points_to_reward: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/redeem/${encodeURIComponent(code)}`)
      .then((response) => response.json())
      .then(setInfo)
      .catch(() => setInfo({ ok: false }));
  }, [code]);

  async function redeem() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/redeem/${encodeURIComponent(code)}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone }),
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok || !body.ok) {
      setError(body.error === "invalid_phone" ? "Informe um telefone válido." : "Este QR Code não está disponível ou já foi usado.");
      return;
    }
    setResult(body);
  }

  const organization = info?.organizationName || "Fideliza";
  const program = info?.programName || "Programa de fidelidade";
  const isUnavailable = info && (!info.ok || info.status !== "active");

  return (
    <main className="redeem-page">
      <section className="redeem-card">
        <div className="redeem-brand"><span>{organization[0]}</span> {organization.toUpperCase()}</div>
        {!info && <><div className="redeem-illustration">⌛</div><p className="eyebrow">VALIDANDO QR CODE</p><h1>Carregando<br />seu resgate.</h1></>}
        {isUnavailable && <><div className="success-icon">!</div><p className="eyebrow">QR CODE INDISPONÍVEL</p><h1>Este código já foi usado<br />ou não existe.</h1><p className="redeem-text">Cada QR Code é único e registra ponto uma única vez.</p><small>Código: {code}</small></>}
        {info?.ok && info.status === "active" && !result && <>
          <div className="redeem-illustration">✓</div>
          <p className="eyebrow">SEU PEDIDO VALE 1 PONTO</p>
          <h1>Registrar ponto<br />em {program}.</h1>
          <p className="redeem-text">Informe seus dados para vincular este QR Code ao seu cartão Fideliza.</p>
          <div className="redeem-form">
            <input placeholder="Seu nome" value={name} onChange={(event) => setName(event.target.value)} />
            <input placeholder="WhatsApp com DDD" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="button button-coral redeem-button" disabled={loading} onClick={redeem}>{loading ? "Registrando..." : "Adicionar ponto"}</button>
          <small>Código: {code}</small>
        </>}
        {result && <><div className="success-icon">✓</div><p className="eyebrow">PONTO ADICIONADO</p><h1>Boa. Seu saldo agora<br />é {result.points} de {result.points_to_reward}.</h1><p className="redeem-text">{result.rewards_available > 0 ? `Você tem ${result.rewards_available} recompensa disponível.` : "Seu cartão será atualizado quando a Wallet estiver conectada."}</p><div className="progress"><span style={{ width: `${Math.min(100, (result.points / result.points_to_reward) * 100)}%` }}></span></div></>}
      </section>
      <p className="redeem-footer">fideliza<span>.</span> — fidelidade sem aplicativo</p>
    </main>
  );
}
