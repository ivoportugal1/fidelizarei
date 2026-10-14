"use client";

import { useState } from "react";
import "./beefood.css";

type Initial = {
  enabled: boolean;
  clientId: string;
  hasSecret: boolean;
  minAmount: number;
  webhookUrl: string;
  webhookSecret: string;
  counterUrl: string;
};

type Notice = { kind: "ok" | "error"; text: string } | null;

const ERRORS: Record<string, string> = {
  credentials_missing: "Salve o Client ID e o Client secret antes de testar.",
  connection_failed: "Não foi possível conectar. Confira o Client ID e o Client secret.",
  encryption_not_configured: "A chave de criptografia do servidor não está configurada.",
  invalid_min_amount: "Informe um valor mínimo válido.",
};

export default function BeefoodSettings({ initial }: { initial: Initial }) {
  const [clientId, setClientId] = useState(initial.clientId);
  const [clientSecret, setClientSecret] = useState("");
  const [hasSecret, setHasSecret] = useState(initial.hasSecret);
  const [minAmount, setMinAmount] = useState(String(initial.minAmount).replace(".", ","));
  const [enabled, setEnabled] = useState(initial.enabled);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [connected, setConnected] = useState(false);

  async function save(payload: Record<string, unknown>) {
    const response = await fetch("/api/integrations/beefood/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({ ok: false }));
    if (!response.ok || !body.ok) throw new Error(ERRORS[body.error] || "Não foi possível salvar agora.");
  }

  async function saveKeys() {
    setBusy("keys");
    setNotice(null);
    try {
      await save({ clientId, ...(clientSecret ? { clientSecret } : {}) });
      if (clientSecret) setHasSecret(true);
      setClientSecret("");
      setConnected(false);
      setNotice({ kind: "ok", text: "Chaves salvas." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Erro ao salvar." });
    }
    setBusy("");
  }

  async function testConnection() {
    setBusy("test");
    setNotice(null);
    const response = await fetch("/api/integrations/beefood/test", { method: "POST" });
    const body = await response.json().catch(() => ({ ok: false }));
    setBusy("");
    if (response.ok && body.ok) {
      setConnected(true);
      setNotice({ kind: "ok", text: "Conexão com o BeeFood funcionando." });
    } else {
      setConnected(false);
      setNotice({ kind: "error", text: ERRORS[body.error] || ERRORS.connection_failed });
    }
  }

  async function simulateSale() {
    setBusy("sim");
    setNotice(null);
    const response = await fetch("/api/integrations/beefood/simulate", { method: "POST" });
    const body = await response.json().catch(() => ({ ok: false }));
    setBusy("");
    if (response.ok && body.ok) {
      setNotice({ kind: "ok", text: "Venda de teste criada. O QR já está na tela do balcão e vale por 3 minutos." });
    } else {
      setNotice({ kind: "error", text: body.error === "integration_disabled" ? "Ligue a integração para simular uma venda." : "Não foi possível simular agora." });
    }
  }

  async function saveMin() {
    setBusy("min");
    setNotice(null);
    try {
      await save({ minAmount: Number(minAmount.replace(",", ".")) });
      setNotice({ kind: "ok", text: "Valor mínimo salvo." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Erro ao salvar." });
    }
    setBusy("");
  }

  async function toggle() {
    const next = !enabled;
    setBusy("toggle");
    setNotice(null);
    try {
      await save({ enabled: next });
      setEnabled(next);
      setNotice({ kind: "ok", text: next ? "Integração ligada." : "Integração desligada." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Erro ao salvar." });
    }
    setBusy("");
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice({ kind: "ok", text: `${label} copiado.` });
    } catch {
      setNotice({ kind: "error", text: "Não foi possível copiar. Selecione e copie manualmente." });
    }
  }

  return (
    <main className="bf-page">
      <header className="bf-top">
        <a className="bf-back" href="/dashboard">&larr; Voltar ao painel</a>
        <div className="bf-head">
          <div>
            <p className="bf-eyebrow">Integrações</p>
            <h1>BeeFood</h1>
            <p className="bf-lead">Quando uma venda presencial for paga no BeeFood, o QR de pontuação aparece sozinho no tablet do balcão.</p>
          </div>
          <span className={enabled ? "bf-pill on" : "bf-pill"}>{enabled ? "Ativa" : "Desligada"}</span>
        </div>
      </header>

      {notice && <p className={notice.kind === "ok" ? "bf-notice ok" : "bf-notice error"} role="status">{notice.text}</p>}

      <section className="bf-grid">
        <article className="bf-card">
          <h2><span>1</span>Chaves do BeeFood</h2>
          <label>Client ID
            <input value={clientId} onChange={(event) => setClientId(event.target.value)} autoComplete="off" />
          </label>
          <label>Client secret
            <input type="password" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} autoComplete="new-password" placeholder={hasSecret ? "Salvo e criptografado" : "Cole o secret do BeeFood"} />
          </label>
          <p className="bf-hint">O secret é guardado criptografado e nunca é mostrado de novo.</p>
          <div className="bf-actions">
            <button className="bf-btn dark" disabled={busy !== ""} onClick={saveKeys}>{busy === "keys" ? "Salvando..." : "Salvar chaves"}</button>
            <button className="bf-btn light" disabled={busy !== "" || !hasSecret} onClick={testConnection}>{busy === "test" ? "Testando..." : connected ? "Conexão ok" : "Testar conexão"}</button>
          </div>
        </article>

        <article className="bf-card">
          <h2><span>2</span>Cadastre no painel do BeeFood</h2>
          <label>Endereço do webhook
            <div className="bf-copy"><input readOnly value={initial.webhookUrl} /><button className="bf-btn light" onClick={() => copy(initial.webhookUrl, "Endereço")}>Copiar</button></div>
          </label>
          <label>Segredo do webhook
            <div className="bf-copy"><input readOnly value={initial.webhookSecret} /><button className="bf-btn light" onClick={() => copy(initial.webhookSecret, "Segredo")}>Copiar</button></div>
          </label>
          <p className="bf-hint">No BeeFood, escolha os eventos <code>payment_created</code> e <code>payment_updated</code>.</p>
        </article>

        <article className="bf-card">
          <h2><span>3</span>Tela do balcão</h2>
          <label>Endereço da tela do tablet
            <div className="bf-copy"><input readOnly value={initial.counterUrl} /><button className="bf-btn light" onClick={() => copy(initial.counterUrl, "Endereço")}>Copiar</button></div>
          </label>
          <p className="bf-hint">Abra este endereço no navegador do tablet e deixe em tela cheia.</p>
          <div className="bf-actions"><a className="bf-btn gold" href={initial.counterUrl} target="_blank" rel="noreferrer">Abrir tela do balcão</a></div>
        </article>

        <article className="bf-card">
          <h2><span>4</span>Regras</h2>
          <label>Valor mínimo da compra para ganhar ponto (R$)
            <div className="bf-copy"><input inputMode="decimal" value={minAmount} onChange={(event) => setMinAmount(event.target.value)} /><button className="bf-btn light" disabled={busy !== ""} onClick={saveMin}>{busy === "min" ? "Salvando..." : "Salvar"}</button></div>
          </label>
          <div className="bf-toggle">
            <div><strong>Integração ativa</strong><p className="bf-hint">Desligue para parar de gerar QR codes.</p></div>
            <button className={enabled ? "bf-switch on" : "bf-switch"} role="switch" aria-checked={enabled} aria-label="Integração ativa" disabled={busy !== ""} onClick={toggle}><i /></button>
          </div>
        </article>
      </section>

      <section className="bf-grid">
        <article className="bf-card bf-test">
          <h2><span>&#9733;</span>Testar sem o BeeFood</h2>
          <p className="bf-hint">Simula uma venda presencial paga. O QR aparece na tela do balcão exatamente como numa venda real, e o ponto vai para a sua Wallet quando você escaneia.</p>
          <div className="bf-actions">
            <button className="bf-btn gold" disabled={busy !== ""} onClick={simulateSale}>{busy === "sim" ? "Gerando..." : "Simular venda"}</button>
            <a className="bf-btn light" href={initial.counterUrl} target="_blank" rel="noreferrer">Abrir tela do balcão</a>
          </div>
        </article>
      </section>
    </main>
  );
}
