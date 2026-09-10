"use client";

import { use, useEffect, useState } from "react";

type JoinInfo = {
  ok: boolean;
  organizationName?: string;
  programName?: string;
  alreadyJoined?: boolean;
  error?: string;
};

export default function JoinPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = use(params);
  const [info, setInfo] = useState<JoinInfo | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [isAppleDevice, setIsAppleDevice] = useState(false);

  useEffect(() => {
    fetch(`/api/join/${encodeURIComponent(programId)}`)
      .then((response) => response.json())
      .then(setInfo)
      .catch(() => setInfo({ ok: false }));
  }, [programId]);

  useEffect(() => {
    setIsAppleDevice(/iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

  async function submit() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/join/${encodeURIComponent(programId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, phone }),
    });
    const body = await response.json().catch(() => ({ ok: false }));
    setLoading(false);
    if (!response.ok || !body.ok) {
      setError(body.error === "invalid_name"
        ? "Informe nome e sobrenome."
        : body.error === "invalid_phone"
          ? "Informe um telefone válido."
          : body.error === "phone_already_registered"
            ? "Número já existente nesta loja. Tente outro."
            : "Não foi possível concluir o cadastro.");
      return;
    }
    setJoined(true);
  }

  async function addGoogleWallet() {
    if (isAppleDevice) {
      setWalletError("No iPhone, use Apple Wallet.");
      return;
    }
    setWalletLoading(true);
    setWalletError("");
    const response = await fetch("/api/wallet/google", { method: "POST" });
    const body = await response.json().catch(() => ({ ok: false }));
    setWalletLoading(false);
    if (!response.ok || !body.ok) {
      setWalletError("Não foi possível abrir o Google Wallet agora.");
      return;
    }
    window.location.href = body.url;
  }

  const organization = info?.organizationName || "Fidelizarei";
  const program = info?.programName || "Programa de fidelidade";
  const ready = joined || info?.alreadyJoined;

  return (
    <main className="redeem-page">
      <section className="redeem-card">
        <div className="redeem-brand"><span>{organization[0]}</span> {organization.toUpperCase()}</div>
        {!info && <><div className="redeem-illustration">⌛</div><p className="eyebrow">ADESÃO</p><h1>Carregando<br />programa.</h1></>}
        {info && !info.ok && <><div className="success-icon">!</div><p className="eyebrow">PROGRAMA INDISPONÍVEL</p><h1>Não encontramos<br />este programa.</h1></>}
        {info?.ok && !ready && <>
          <div className="redeem-illustration">♡</div>
          <p className="eyebrow">ENTRAR NO PROGRAMA</p>
          <h1>Cadastre-se em<br />{program}.</h1>
          <p className="redeem-text">Este QR é apenas para adesão. Ele não adiciona pontos.</p>
          <div className="redeem-form">
            <input placeholder="Nome" value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
            <input placeholder="Sobrenome" value={lastName} onChange={(event) => setLastName(event.target.value)} required />
            <input placeholder="WhatsApp com DDD" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" required />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="button button-coral redeem-button" disabled={loading} onClick={submit}>{loading ? "Cadastrando..." : "Entrar no programa"}</button>
        </>}
        {info?.ok && ready && <>
          <div className="success-icon">✓</div>
          <p className="eyebrow">{joined ? "CADASTRO CONCLUÍDO" : "VOCÊ JÁ PARTICIPA"}</p>
          <h1>Seu cartão está<br />pronto para a Wallet.</h1>
          <p className="redeem-text">Seu progresso começa em 0. Os pontos entram apenas pelos QR Codes de pontuação.</p>
          <div className="wallet-actions">{!isAppleDevice && <button className="button button-dark" disabled={walletLoading} onClick={addGoogleWallet}>{walletLoading ? "Abrindo..." : "Adicionar ao Google Wallet"}</button>}<a className="button button-light" href="/api/wallet/apple">Adicionar à Apple Wallet</a></div>
          {walletError && <p className="form-error">{walletError}</p>}
        </>}
      </section>
      <p className="redeem-footer">fidelizarei — adesão sem aplicativo</p>
    </main>
  );
}
