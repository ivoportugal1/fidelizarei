"use client";

import { use, useEffect, useState } from "react";

type CodeInfo = {
  ok: boolean;
  status?: string;
  programName?: string;
  organizationName?: string;
  joinUrl?: string;
};

export default function RedeemPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [info, setInfo] = useState<CodeInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [result, setResult] = useState<{ points: number; rewards_available: number; points_to_reward: number } | null>(null);
  const [error, setError] = useState("");
  const [walletError, setWalletError] = useState("");
  const [isAppleDevice, setIsAppleDevice] = useState(false);

  useEffect(() => {
    fetch(`/api/redeem/${encodeURIComponent(code)}`)
      .then((response) => response.json())
      .then(setInfo)
      .catch(() => setInfo({ ok: false }));
  }, [code]);

  useEffect(() => {
    setIsAppleDevice(/iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

  async function redeem() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/redeem/${encodeURIComponent(code)}`, {
      method: "POST",
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok || !body.ok) {
      setError(body.error === "identity_required" || body.error === "customer_not_enrolled" || body.error === "join_required" ? "Você ainda não participa deste programa. Cadastre-se pelo QR de adesão antes de pontuar." : "Este QR Code não está disponível ou já foi usado.");
      return;
    }
    setResult(body);
  }

  async function addGoogleWallet() {
    if (isAppleDevice) {
      setWalletError("Google Wallet não adiciona esse cartão no iPhone. No iPhone, o caminho correto é Apple Wallet.");
      return;
    }
    setWalletLoading(true);
    setWalletError("");
    const response = await fetch("/api/wallet/google", { method: "POST" });
    const body = await response.json();
    setWalletLoading(false);
    if (!response.ok || !body.ok) {
      const messages: Record<string, string> = {
        google_wallet_requires_android: "Google Wallet não adiciona esse cartão no iPhone. Use Android ou Apple Wallet.",
        google_wallet_not_configured: "Google Wallet ainda não está configurado para este projeto.",
        identity_required: "Sessão do cliente não encontrada. Resgate um QR Code novo antes de adicionar à Wallet.",
      };
      setWalletError(messages[body.error] || "Não foi possível gerar o cartão agora. Tente com um QR novo ou me avise para verificar os logs.");
      return;
    }
    window.location.href = body.url;
  }

  const organization = info?.organizationName || "Fidelizarei";
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
          <p className="eyebrow">QR DE PONTUAÇÃO</p>
          <h1>Registrar ponto<br />em {program}.</h1>
          <p className="redeem-text">Este QR é apenas para clientes já cadastrados. Ele não faz adesão automática.</p>
          {error && <p className="form-error">{error}</p>}
          <button className="button button-coral redeem-button" disabled={loading} onClick={redeem}>{loading ? "Registrando..." : "Adicionar ponto"}</button>
          {info.joinUrl && <a className="button button-light redeem-button" href={info.joinUrl}>Fazer adesão primeiro</a>}
          <small>Código: {code}</small>
        </>}
        {result && <><div className="success-icon">✓</div><p className="eyebrow">PONTO ADICIONADO</p><h1>Boa. Seu saldo agora<br />é {result.points} de {result.points_to_reward}.</h1><p className="redeem-text">{result.rewards_available > 0 ? `Você tem ${result.rewards_available} recompensa disponível.` : "Adicione o cartão para acompanhar seus pontos na Wallet."}</p><div className="progress"><span style={{ width: `${Math.min(100, (result.points / result.points_to_reward) * 100)}%` }}></span></div><div className="wallet-actions">{!isAppleDevice && <button className="button button-dark" disabled={walletLoading} onClick={addGoogleWallet}>{walletLoading ? "Abrindo..." : "Adicionar ao Google Wallet"}</button>}<a className="button button-light" href="/api/wallet/apple">Adicionar à Apple Wallet</a></div>{isAppleDevice && <p className="redeem-text">Você está no iPhone. Google Wallet é para Android; no iPhone precisa Apple Wallet.</p>}{walletError && <p className="form-error">{walletError}</p>}</>}
      </section>
      <p className="redeem-footer">Fidelizarei — fidelidade sem aplicativo</p>
    </main>
  );
}
