"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import QRCode from "qrcode";
import type { DashboardData } from "@/lib/admin-data";

type GeneratedCode = {
  id: string;
  code: string;
  url: string;
  status: "active" | "redeemed" | "voided" | "expired";
  createdAt: string;
  redeemedAt: string | null;
};
type QrBatch = DashboardData["qrBatches"][number];
type WalletSettings = DashboardData["walletSettings"];
type PointTheme = WalletSettings["pointTheme"];
const MIN_POINT_QR_BATCH = 1;
const MAX_POINT_QR_BATCH = 500;

function normalizeAssetUrl(value: string | null) {
  if (!value) return null;
  if (value.startsWith("http") || value.startsWith("/api/")) return value;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return `/api/wallet/assets/${value}`;
  }
  return value;
}

const formatNumber = (value: number) => value.toLocaleString("pt-BR");
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Sem atividade";
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "CL";
const planLabel = (interval: "monthly" | "yearly") => interval === "yearly" ? "Anual" : "Mensal";
type AppleLogoShape = "circle" | "rounded" | "pill";

function daysLeft(value: string | null) {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

const pointThemes: Array<{ value: PointTheme; label: string }> = [
  { value: "cafeteria", label: "Cafeteria" },
  { value: "acaiteria", label: "Açaíteria" },
  { value: "sorveteria", label: "Sorveteria" },
  { value: "pizzaria", label: "Pizzaria" },
  { value: "hamburgueria", label: "Hamburgueria" },
  { value: "padaria", label: "Padaria" },
  { value: "barbearia", label: "Barbearia" },
  { value: "petshop", label: "Pet shop" },
  { value: "universal", label: "Universal" },
];

const previewCustomer = {
  name: "João Silva",
  memberSince: "Set 2026",
};

const progressEmoji: Record<PointTheme, string> = {
  cafeteria: "☕",
  acaiteria: "🥣",
  sorveteria: "🍦",
  pizzaria: "🍕",
  hamburgueria: "🍔",
  padaria: "🥐",
  barbearia: "✂️",
  petshop: "🐾",
  universal: "●",
};

function QrPreview({ value }: { value: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) QRCode.toCanvas(ref.current, value, { width: 176, margin: 1, color: { dark: "#17211f", light: "#ffffff" } });
  }, [value]);
  return <canvas ref={ref} aria-label="QR Code de resgate" />;
}

async function downloadQr(value: string, filename: string) {
  const dataUrl = await QRCode.toDataURL(value, { width: 720, margin: 2, color: { dark: "#17211f", light: "#ffffff" } });
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

async function printQr(value: string, title: string) {
  const dataUrl = await QRCode.toDataURL(value, { width: 720, margin: 2, color: { dark: "#17211f", light: "#ffffff" } });
  const printWindow = window.open("", "_blank", "width=560,height=720");
  if (!printWindow) return;
  printWindow.document.write(`<html><head><title>${title}</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:32px;color:#17211f}img{width:360px;height:360px}p{word-break:break-all;color:#66716d}</style></head><body><h1>${title}</h1><img src="${dataUrl}" alt="${title}" /><p>${value}</p><script>window.onload=()=>window.print()</script></body></html>`);
  printWindow.document.close();
}

export default function Dashboard({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState(initialData);
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState("Visão geral");
  const [currentDateLabel, setCurrentDateLabel] = useState("FIDELIZAREI");
  const [baseUrl, setBaseUrl] = useState("https://fidelizarei.com.br");
  const [quantity, setQuantity] = useState(25);
  const [showGenerator, setShowGenerator] = useState(false);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<GeneratedCode[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<QrBatch | null>(data.qrBatches[0] ?? null);
  const firstCode = generatedCodes[0]?.url;

  useEffect(() => {
    setMounted(true);
    setCurrentDateLabel(new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date()).toUpperCase());
    setBaseUrl(window.location.origin.includes("fidelizarei.vercel.app") ? "https://fidelizarei.com.br" : window.location.origin);
  }, []);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  async function generateCodes() {
    if (!Number.isInteger(quantity) || quantity < MIN_POINT_QR_BATCH || quantity > MAX_POINT_QR_BATCH) {
      flash(`Informe uma quantidade entre ${MIN_POINT_QR_BATCH} e ${MAX_POINT_QR_BATCH}.`);
      return;
    }
    setLoading(true);
    const response = await fetch("/api/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok || !body.ok) {
      flash(body.message || "Não consegui gerar os QR Codes. Confira o banco e tente de novo.");
      return;
    }
    setGeneratedCodes(body.codes);
    setSelectedBatch(body.batch);
    setData((current) => ({ ...current, qrBatches: [body.batch, ...current.qrBatches.filter((batch) => batch.id !== body.batch.id)].slice(0, 6) }));
    setShowGenerator(false);
    setActive("QR Codes");
    flash(`${body.codes.length.toLocaleString("pt-BR")} QR Codes reais gerados.`);
  }

  async function loadBatch(batch: QrBatch) {
    setLoading(true);
    const response = await fetch(`/api/codes/batches/${batch.id}`);
    const body = await response.json().catch(() => ({ ok: false }));
    setLoading(false);
    if (!response.ok || !body.ok) {
      flash("Não consegui carregar este lote.");
      return;
    }
    setGeneratedCodes(body.codes);
    setSelectedBatch(batch);
    flash(`Lote com ${body.codes.length.toLocaleString("pt-BR")} QR Codes carregado.`);
  }

  function exportCsv() {
    const rows = ["code,url", ...generatedCodes.map((item) => `${item.code},${item.url}`)];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fidelizarei-qrcodes.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function confirmRewardRedeemed(customerId: string, customerName: string) {
    if (!window.confirm(`Confirmar que ${customerName} resgatou a recompensa?`)) return;
    const response = await fetch(`/api/customers/${customerId}/redeem-reward`, { method: "POST" });
    const body = await response.json().catch(() => ({ ok: false }));
    if (!response.ok || !body.ok) {
      flash("Não consegui confirmar o resgate da recompensa.");
      return;
    }
    flash("Recompensa marcada como resgatada.");
    window.setTimeout(() => window.location.reload(), 700);
  }

  async function removeCustomer(customerId: string, customerName: string) {
    if (!window.confirm(`Excluir ${customerName} deste programa?\n\nO histórico e o acesso deste cliente ao programa poderão ser afetados.`)) return;
    const response = await fetch(`/api/customers/${customerId}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({ ok: false }));
    if (!response.ok || !body.ok) {
      flash("Não consegui excluir este cliente do programa.");
      return;
    }
    flash("Cliente removido deste programa.");
    window.setTimeout(() => window.location.reload(), 700);
  }

  if (!mounted) return null;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">Fidelizarei</a>
        <div className="company-switcher">
          <div className="company-logo">
            {data.walletSettings.logoUrl ? (
              <img src={data.walletSettings.logoUrl} alt={`Logo ${data.organization.name}`} />
            ) : (
              data.organization.name[0]
            )}
          </div>
          <div><strong>{data.organization.name}</strong><small>Plano {planLabel(data.organization.billingInterval)}</small></div>
        </div>
        <nav>
          {["Visão geral", "Clientes", "Campanhas", "QR Codes", "Recompensas", "Personalizar cartão"].map((item) => (
            <button key={item} className={active === item ? "nav-item active" : "nav-item"} onClick={() => setActive(item)}>
              <span>{({ "Visão geral": "▦", Clientes: "♙", Campanhas: "◌", "QR Codes": "▣", Recompensas: "♢", "Personalizar cartão": "✦" } as Record<string, string>)[item]}</span>{item}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="profile" onClick={logout}><span>{initials(data.user.name)}</span><b>Sair</b><i>↗</i></button>
        </div>
      </aside>

      <section className="workspace">
        <TrialBanner data={data} />
        <header className="topbar">
          <div><p>{currentDateLabel}</p><h1>{active}</h1></div>
          <div className="top-actions"><button className="button button-dark" onClick={() => setShowGenerator(true)}>+ Gerar QR Codes</button></div>
        </header>

        {active === "Visão geral" ? <Overview data={data} onGenerate={() => setShowGenerator(true)} /> :
          active === "QR Codes" ? <Codes data={data} baseUrl={baseUrl} codes={generatedCodes} selectedBatch={selectedBatch} firstCode={firstCode} onGenerate={() => setShowGenerator(true)} onExport={exportCsv} onLoadBatch={loadBatch} /> :
          active === "Clientes" ? <Customers data={data} onRedeemReward={confirmRewardRedeemed} onRemoveCustomer={removeCustomer} /> :
          active === "Campanhas" ? <Campaigns data={data} onCampaignsChange={(campaigns) => setData((current) => ({ ...current, campaigns }))} /> :
          active === "Personalizar cartão" ? <CardDesigner data={data} onSave={flash} onSettingsChange={(walletSettings) => setData((current) => ({ ...current, walletSettings }))} /> :
          <Rewards data={data} onRedeemReward={confirmRewardRedeemed} />}
      </section>

      {showGenerator && (
        <div className="modal-backdrop" onMouseDown={() => setShowGenerator(false)}>
          <section className="modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowGenerator(false)}>×</button>
            <p className="eyebrow">NOVA REMESSA</p>
            <h2>Gerar QR Codes</h2>
            <p className="muted">Cada código é único, vale {data.program.pointsPerCode} ponto e só pode ser usado uma vez.</p>
            <label>Quantidade<input type="number" min={MIN_POINT_QR_BATCH} max={MAX_POINT_QR_BATCH} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
            <small className="muted">Mínimo {MIN_POINT_QR_BATCH}, máximo {MAX_POINT_QR_BATCH} por lote.</small>
            <button className="button button-coral modal-submit" disabled={loading} onClick={generateCodes}>{loading ? "Gerando..." : `Gerar ${quantity.toLocaleString("pt-BR")} códigos`}</button>
          </section>
        </div>
      )}
      {toast && <div className="toast">✓ {toast}</div>}
    </main>
  );
}

function TrialBanner({ data }: { data: DashboardData }) {
  if (data.organization.billingStatus !== "trialing") return null;
  const remaining = daysLeft(data.organization.trialEndsAt);
  return (
    <div className="trial-banner">
      <div>
        <strong>Teste grátis ativo</strong>
        <span>{remaining === null ? "Você está no período grátis." : `Faltam ${remaining} ${remaining === 1 ? "dia" : "dias"} para acabar o teste grátis.`}</span>
      </div>
      <a className="button button-light" href="/billing">Ver plano {planLabel(data.organization.billingInterval)}</a>
    </div>
  );
}

function Overview({ data, onGenerate }: { data: DashboardData; onGenerate: () => void }) {
  return <div className="content"><section className="welcome"><div><div className="eyebrow">{data.organization.name.toUpperCase()}</div><h2>Painel operacional</h2><p>Dados reais do banco Render: clientes, pontos, recompensas e códigos de resgate.</p></div><button className="button button-light" onClick={onGenerate}>+ Nova remessa</button></section><section className="metrics"><Metric value={formatNumber(data.metrics.customers)} label="Clientes cadastrados" trend="Banco real" /><Metric value={formatNumber(data.metrics.points)} label="Pontos distribuídos" trend="Transações" /><Metric value={formatNumber(data.metrics.rewards)} label="Recompensas disponíveis" trend={data.program.rewardName} /><Metric value={formatNumber(data.metrics.activeCodes)} label="QR Codes ativos" trend={`${formatNumber(data.metrics.redeemedCodes)} usados`} /></section><section className="dashboard-grid"><article className="panel chart-panel"><div className="panel-header"><div><h3>Resumo da campanha</h3><p>{data.program.name}</p></div><button className="select-button">Ativa</button></div><div className="real-summary"><b>{data.program.pointsToReward}</b><span>pontos para liberar</span><strong>{data.program.rewardName}</strong></div><div className="chart-total"><b>{formatNumber(data.metrics.redeemedCodes)}</b><span>QR Codes resgatados até agora</span><em>{formatNumber(data.metrics.activeCodes)} ativos</em></div></article><article className="panel wallet-preview"><div className="panel-header"><div><h3>Seu cartão</h3><p>Prévia na Wallet</p></div><button className="link-button">Editar</button></div><PassCard data={data} /><p className="wallet-foot">A integração Apple/Google Wallet entra depois da base de campanha.</p></article></section><RecentActivity data={data} /></div>;
}

function Metric({ value, label, trend }: { value: string; label: string; trend: string }) { return <article className="metric"><p>{label}</p><div><b>{value}</b><span>{trend}</span></div></article>; }

function PassCard({ data }: { data: DashboardData }) {
  return <div className="pass-card" style={{ background: data.program.backgroundColor }}><div className="pass-head"><span className="pass-mark">{data.organization.name[0]}</span><span>{data.organization.name.toUpperCase()}</span><b>•••</b></div><div className="pass-title">{data.program.name}</div><div className="pass-count"><b>0</b><span>/ {data.program.pointsToReward}</span><small>PONTOS</small></div><div className="pass-dots">{Array.from({ length: Math.min(data.program.pointsToReward, 10) }).map((_, index) => <i key={index} className={index === 0 ? "" : "empty"}></i>)}</div><div className="pass-reward">{data.program.pointsToReward} pontos = {data.program.rewardName}</div></div>;
}

function RecentActivity({ data }: { data: DashboardData }) {
  return <section className="panel activity"><div className="panel-header"><div><h3>Atividade recente</h3><p>Últimos pontos creditados</p></div></div><table><thead><tr><th>CLIENTE</th><th>PONTOS</th><th>QUANDO</th></tr></thead><tbody>{data.recent.length ? data.recent.map((item) => <tr key={item.id}><td><span className="avatar">{initials(item.customerName)}</span><b>{item.customerName}</b></td><td><strong className="points">+{item.points}</strong></td><td className="date">{formatDate(item.createdAt)}</td></tr>) : <tr><td colSpan={3}>Nenhum resgate ainda. Gere uma remessa e teste um QR Code.</td></tr>}</tbody></table></section>;
}

function codeStatusLabel(status: GeneratedCode["status"]) {
  return status === "redeemed" ? "UTILIZADO" : status === "active" ? "DISPONÍVEL" : status.toUpperCase();
}

function Codes({
  data,
  baseUrl,
  codes,
  selectedBatch,
  firstCode,
  onGenerate,
  onExport,
  onLoadBatch,
}: {
  data: DashboardData;
  baseUrl: string;
  codes: GeneratedCode[];
  selectedBatch: QrBatch | null;
  firstCode?: string;
  onGenerate: () => void;
  onExport: () => void;
  onLoadBatch: (batch: QrBatch) => void;
}) {
  const preview = firstCode || "https://fidelizarei.com.br/r/GERADO-APOS-CLIQUE";
  const joinUrl = `${baseUrl}/join/${data.program.id}`;
  const batchUrl = selectedBatch ? `/api/codes/batches/${selectedBatch.id}` : "";
  return (
    <div className="content">
      <section className="section-intro">
        <div>
          <div className="eyebrow">ADESÃO E PONTUAÇÃO</div>
          <h2>QR Codes</h2>
          <p>Use o QR fixo para cadastrar clientes. Use QR de pontuação somente para compras.</p>
        </div>
        <div className="top-actions">
          <button className="button button-light" disabled={!codes.length} onClick={onExport}>Exportar CSV</button>
          <a className={selectedBatch ? "button button-light" : "button button-light disabled"} href={selectedBatch ? `${batchUrl}/pdf` : undefined}>Baixar PDF</a>
          <a className={selectedBatch ? "button button-light" : "button button-light disabled"} href={selectedBatch ? `${batchUrl}/zip` : undefined}>Baixar imagens</a>
          <button className="button button-dark" onClick={onGenerate}>+ Gerar QR de pontuação</button>
        </div>
      </section>
      <section className="metrics">
        <Metric value="Fixo" label="QR de adesão" trend="Não pontua" />
        <Metric value={formatNumber(data.metrics.activeCodes)} label="Pontuação disponível" trend="Uso único" />
        <Metric value={formatNumber(data.metrics.redeemedCodes)} label="Pontuação usada" trend="Já resgatados" />
        <Metric value={formatNumber(codes.length)} label={selectedBatch ? "Lote carregado" : "Gerados agora"} trend="Exportáveis" />
      </section>
      <div className="qr-split">
        <article className="panel empty-qr">
          <QrPreview value={joinUrl} />
          <div>
            <h3>QR de adesão fixo</h3>
            <p>Use este QR para cadastrar novos clientes. Ele não adiciona pontos e pode ficar no balcão, mesa, embalagem ou Instagram.</p>
            <div className="qr-actions">
              <button className="button button-light" onClick={() => navigator.clipboard?.writeText(joinUrl)}>Copiar link</button>
              <button className="button button-light" onClick={() => downloadQr(joinUrl, "qr-adesao-fidelizarei.png")}>Baixar QR</button>
              <button className="button button-light" onClick={() => printQr(joinUrl, "QR de adesão")}>Imprimir</button>
              <a className="button button-light" href={joinUrl} target="_blank">Abrir →</a>
            </div>
          </div>
        </article>
        <article className="panel empty-qr">
          <QrPreview value={preview} />
          <div>
            <h3>{codes.length ? "Primeiro QR de pontuação" : "QR de pontuação"}</h3>
            <p>{codes.length ? "Cada link vale ponto uma única vez. Você pode baixar PDF, imprimir ou baixar as imagens sem recriar os códigos." : "Gere QRs únicos para compras. Eles não cadastram clientes; o cliente precisa aderir antes."}</p>
            {firstCode && (
              <div className="qr-actions">
                <button className="button button-light" onClick={() => navigator.clipboard?.writeText(firstCode)}>Copiar link</button>
                <button className="button button-light" onClick={() => downloadQr(firstCode, "qr-pontuacao-fidelizarei.png")}>Baixar QR</button>
                <button className="button button-light" onClick={() => printQr(firstCode, "QR de pontuação")}>Imprimir</button>
                <a className="button button-light" href={firstCode} target="_blank">Abrir →</a>
                {selectedBatch && <a className="button button-light" href={`${batchUrl}/print`} target="_blank">Imprimir lote</a>}
              </div>
            )}
          </div>
        </article>
      </div>
      {data.qrBatches.length > 0 && (
        <article className="panel activity code-list">
          <div className="panel-header"><div><h3>Histórico de lotes</h3><p>Reabra um lote para baixar o mesmo PDF ou ZIP, sem criar novos QRs.</p></div></div>
          <table>
            <thead><tr><th>LOTE</th><th>CRIADO EM</th><th>QTD</th><th>STATUS</th><th>AÇÕES</th></tr></thead>
            <tbody>{data.qrBatches.map((batch) => <tr key={batch.id}>
              <td><strong>{batch.id.slice(0, 8)}</strong></td>
              <td className="date">{formatDate(batch.createdAt)}</td>
              <td>{batch.quantity}</td>
              <td className="date">{batch.active} disponíveis · {batch.redeemed} utilizados</td>
              <td className="table-actions">
                <button className="link-button" onClick={() => onLoadBatch(batch)}>Ver lote</button>
                <a className="link-button" href={`/api/codes/batches/${batch.id}/pdf`}>PDF</a>
                <a className="link-button" href={`/api/codes/batches/${batch.id}/zip`}>ZIP</a>
                <a className="link-button" href={`/api/codes/batches/${batch.id}/print`} target="_blank">Imprimir</a>
              </td>
            </tr>)}</tbody>
          </table>
        </article>
      )}
      {codes.length > 0 && (
        <article className="panel activity code-list">
          <div className="panel-header"><div><h3>QR Codes do lote</h3><p>Visualização na tela mantida para uso direto ou conferência.</p></div></div>
          <table>
            <thead><tr><th>CÓDIGO</th><th>STATUS</th><th>URL</th></tr></thead>
            <tbody>{codes.slice(0, 100).map((item) => <tr key={item.code}><td><strong>{item.code}</strong></td><td><span className={item.status === "active" ? "status ready" : "status"}>{codeStatusLabel(item.status)}</span></td><td className="date">{item.url}</td></tr>)}</tbody>
          </table>
          {codes.length > 100 && <p className="muted">Mostrando os primeiros 100 de {codes.length.toLocaleString("pt-BR")} QRs. PDF e ZIP incluem todos.</p>}
        </article>
      )}
    </div>
  );
}

function Customers({ data, onRedeemReward, onRemoveCustomer }: { data: DashboardData; onRedeemReward: (customerId: string, customerName: string) => void; onRemoveCustomer: (customerId: string, customerName: string) => void }) {
  return <div className="content"><section className="section-intro"><div><div className="eyebrow">BASE DE FIDELIDADE</div><h2>Clientes</h2><p>Clientes cadastrados por adesão ao programa.</p></div></section><article className="panel activity"><table><thead><tr><th>CLIENTE</th><th>CONTATO</th><th>PROGRESSO</th><th>STATUS</th><th>CADASTRO</th><th>AÇÃO</th></tr></thead><tbody>{data.customers.length ? data.customers.map((customer) => {
    const status = customer.status === "inactive" ? "Inativo" : customer.rewards > 0 ? "Recompensa disponível" : "Ativo";
    return <tr key={customer.id}><td><span className="avatar">{initials(customer.name)}</span><b>{customer.name}</b></td><td className="date">{customer.phone || "—"}</td><td><strong>{customer.points} / {data.program.pointsToReward}</strong></td><td><span className={customer.status === "inactive" ? "status" : customer.rewards > 0 ? "status ready" : "status"}>{status}</span></td><td className="date">{formatDate(customer.createdAt)}</td><td className="table-actions">{customer.status === "active" && customer.rewards > 0 && <button className="reward-action" onClick={() => onRedeemReward(customer.id, customer.name)}>Confirmar resgate</button>}{customer.status === "active" && <button className="link-button danger" onClick={() => onRemoveCustomer(customer.id, customer.name)}>Excluir cliente</button>}</td></tr>;
  }) : <tr><td colSpan={6}>Nenhum cliente cadastrado ainda.</td></tr>}</tbody></table></article></div>;
}

function Campaigns({ data, onCampaignsChange }: { data: DashboardData; onCampaignsChange: (campaigns: DashboardData["campaigns"]) => void }) {
  type Campaign = DashboardData["campaigns"][number];
  const emptyCampaign = { name: "", rewardName: "", pointsToReward: 7, pointsPerCode: 1, active: true };
  const [campaigns, setCampaigns] = useState(data.campaigns);
  const [drafts, setDrafts] = useState<Record<string, Campaign>>(Object.fromEntries(data.campaigns.map((campaign) => [campaign.id, campaign])));
  const [newCampaign, setNewCampaign] = useState(emptyCampaign);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const syncCampaigns = (nextCampaigns: DashboardData["campaigns"]) => {
    setCampaigns(nextCampaigns);
    setDrafts(Object.fromEntries(nextCampaigns.map((campaign) => [campaign.id, campaign])));
    onCampaignsChange(nextCampaigns);
  };

  const updateDraft = <K extends keyof Campaign>(id: string, key: K, value: Campaign[K]) => {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [key]: value } }));
  };

  async function saveCampaign(id: string) {
    const draft = drafts[id];
    if (!draft) return;
    setSavingId(id);
    setMessage("");
    const response = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const body = await response.json().catch(() => ({ ok: false }));
    setSavingId(null);
    if (!response.ok || !body.ok) {
      setMessage("Não consegui salvar a campanha. Confira nome, recompensa e metas.");
      return;
    }
    syncCampaigns(campaigns.map((campaign) => campaign.id === id ? body.campaign : campaign));
    setMessage("Campanha salva.");
  }

  async function createCampaign() {
    setSavingId("new");
    setMessage("");
    const response = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCampaign),
    });
    const body = await response.json().catch(() => ({ ok: false }));
    setSavingId(null);
    if (!response.ok || !body.ok) {
      setMessage("Não consegui criar a campanha. Confira nome, recompensa e metas.");
      return;
    }
    syncCampaigns([...campaigns, body.campaign]);
    setNewCampaign(emptyCampaign);
    setMessage("Campanha criada.");
  }

  return (
    <div className="content">
      <section className="section-intro">
        <div>
          <div className="eyebrow">CAMPANHAS</div>
          <h2>Campanhas da loja</h2>
          <p>Crie mais de uma campanha e edite meta, recompensa e pontos por QR.</p>
        </div>
      </section>
      <section className="metrics">
        <Metric value={String(campaigns.length)} label="Campanhas" trend="Cadastradas" />
        <Metric value={String(campaigns.filter((campaign) => campaign.active).length)} label="Ativas" trend="Recebendo adesões/QR" />
        <Metric value={String(data.program.pointsToReward)} label="Campanha principal" trend={data.program.name} />
      </section>
      <article className="panel activity">
        <div className="panel-header"><div><h3>Nova campanha</h3><p>Exemplo: Compre 10 e ganhe 1, Clube VIP, Cashback de pontos.</p></div></div>
        <div className="coupon-box">
          <label>Nome<input value={newCampaign.name} onChange={(event) => setNewCampaign((current) => ({ ...current, name: event.target.value }))} placeholder="Programa de Fidelidade" /></label>
          <label>Recompensa<input value={newCampaign.rewardName} onChange={(event) => setNewCampaign((current) => ({ ...current, rewardName: event.target.value }))} placeholder="Recompensa" /></label>
          <label>Meta<input type="number" min={1} max={1000} value={newCampaign.pointsToReward} onChange={(event) => setNewCampaign((current) => ({ ...current, pointsToReward: Number(event.target.value) }))} /></label>
          <label>Pontos por QR<input type="number" min={1} max={100} value={newCampaign.pointsPerCode} onChange={(event) => setNewCampaign((current) => ({ ...current, pointsPerCode: Number(event.target.value) }))} /></label>
          <button className="button button-dark" disabled={savingId === "new"} onClick={createCampaign}>{savingId === "new" ? "Criando..." : "Criar campanha"}</button>
        </div>
        {message && <p className={message.includes("Não") ? "form-error" : "muted"}>{message}</p>}
      </article>
      <article className="panel activity">
        <div className="panel-header"><div><h3>Campanhas existentes</h3><p>A campanha principal atual continua sendo usada nos QR Codes e Wallet.</p></div></div>
        <table>
          <thead><tr><th>NOME</th><th>RECOMPENSA</th><th>META</th><th>PONTOS/QR</th><th>STATUS</th><th>AÇÃO</th></tr></thead>
          <tbody>{campaigns.length ? campaigns.map((campaign) => {
            const draft = drafts[campaign.id] || campaign;
            return (
              <tr key={campaign.id}>
                <td><input value={draft.name} onChange={(event) => updateDraft(campaign.id, "name", event.target.value)} /></td>
                <td><input value={draft.rewardName} onChange={(event) => updateDraft(campaign.id, "rewardName", event.target.value)} /></td>
                <td><input type="number" min={1} max={1000} value={draft.pointsToReward} onChange={(event) => updateDraft(campaign.id, "pointsToReward", Number(event.target.value))} /></td>
                <td><input type="number" min={1} max={100} value={draft.pointsPerCode} onChange={(event) => updateDraft(campaign.id, "pointsPerCode", Number(event.target.value))} /></td>
                <td><label className="inline-check"><input type="checkbox" checked={draft.active} onChange={(event) => updateDraft(campaign.id, "active", event.target.checked)} /> Ativa</label></td>
                <td><button className="reward-action" disabled={savingId === campaign.id} onClick={() => saveCampaign(campaign.id)}>{savingId === campaign.id ? "Salvando..." : "Salvar"}</button></td>
              </tr>
            );
          }) : <tr><td colSpan={6}>Nenhuma campanha cadastrada.</td></tr>}</tbody>
        </table>
      </article>
    </div>
  );
}

function Rewards({ data, onRedeemReward }: { data: DashboardData; onRedeemReward: (customerId: string, customerName: string) => void }) {
  const available = data.customers.filter((customer) => customer.rewards > 0);
  return <div className="content"><section className="section-intro"><div><div className="eyebrow">RECOMPENSAS</div><h2>{data.program.rewardName}</h2><p>Quando o cliente retirar o prêmio na loja, confirme aqui para baixar a recompensa disponível.</p></div></section><section className="metrics"><Metric value={formatNumber(data.metrics.rewards)} label="Disponíveis" trend="Na base" /><Metric value={String(data.program.pointsToReward)} label="Pontos necessários" trend={data.program.name} /></section><article className="panel activity"><div className="panel-header"><div><h3>Clientes com recompensa disponível</h3><p>Confirme somente depois que o cliente receber o benefício.</p></div></div><table><thead><tr><th>CLIENTE</th><th>PONTOS ATUAIS</th><th>RECOMPENSAS</th><th>AÇÃO</th></tr></thead><tbody>{available.length ? available.map((customer) => <tr key={customer.id}><td><span className="avatar">{initials(customer.name)}</span><b>{customer.name}</b></td><td><strong>{customer.points} / {data.program.pointsToReward}</strong></td><td><span className="status ready">{customer.rewards}</span></td><td><button className="reward-action" onClick={() => onRedeemReward(customer.id, customer.name)}>Confirmar resgate</button></td></tr>) : <tr><td colSpan={4}>Nenhuma recompensa disponível agora.</td></tr>}</tbody></table></article></div>;
}

function CardDesigner({
  data,
  onSave,
  onSettingsChange,
}: {
  data: DashboardData;
  onSave: (message: string) => void;
  onSettingsChange: (settings: WalletSettings) => void;
}) {
  const [settings, setSettings] = useState<WalletSettings>({
    ...data.walletSettings,
    logoUrl: normalizeAssetUrl(data.walletSettings.logoUrl),
    coverUrl: normalizeAssetUrl(data.walletSettings.coverUrl),
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);
  const previewPoints = Math.min(4, settings.pointsGoal);

  const update = <K extends keyof WalletSettings>(key: K, value: WalletSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  async function persistSettings(nextSettings: WalletSettings, successMessage: string) {
    setSaving(true);
    try {
      const response = await fetch("/api/wallet/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: nextSettings }),
      });
      const body = await response.json().catch(() => ({ ok: false }));
      if (!response.ok || !body.ok) {
        onSave("Não consegui salvar. Rode a migração do banco e tente de novo.");
        return false;
      }
      const savedSettings = {
        ...body.settings,
        logoUrl: normalizeAssetUrl(body.settings.logoUrl),
        coverUrl: normalizeAssetUrl(body.settings.coverUrl),
      } as WalletSettings;
      setSettings(savedSettings);
      onSettingsChange(savedSettings);
      onSave(successMessage);
      return true;
    } catch {
      onSave("Não consegui salvar. Tente novamente.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function uploadAsset(kind: "logo" | "cover", file?: File) {
    if (!file) return;
    setUploading(kind);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", kind);
      const response = await fetch("/api/wallet/assets", { method: "POST", body: formData });
      const body = await response.json().catch(() => ({ ok: false }));
      if (!response.ok || !body.ok) {
        onSave("Não consegui enviar a imagem. Use PNG, JPG ou WEBP com até 2 MB.");
        return;
      }
      const key = kind === "logo" ? "logoUrl" : "coverUrl";
      const nextSettings = { ...settings, [key]: body.url } as WalletSettings;
      setSettings(nextSettings);
      await persistSettings(nextSettings, kind === "logo" ? "Logo salva." : "Foto/capa salva.");
    } catch {
      onSave("Não consegui enviar a imagem. Tente novamente.");
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    await persistSettings(settings, "Personalização do cartão salva.");
  }

  return (
    <div className="content wallet-editor-page">
      <section className="section-intro">
        <div>
          <div className="eyebrow">WALLET DESIGN SYSTEM</div>
          <h2>Personalizar cartão</h2>
          <p>Uma configuração central. O Fidelizarei adapta a identidade para Apple Wallet e Google Wallet.</p>
        </div>
        <button className="button button-dark" disabled={saving} onClick={save}>{saving ? "Salvando..." : "Salvar cartão"}</button>
      </section>

      <div className="wallet-editor-grid">
        <article className="panel wallet-form">
          <div className="wallet-form-section">
            <h3>Identidade do estabelecimento</h3>
            <div className="upload-grid">
              <label className="upload-card">
                <span>Logo</span>
                {settings.logoUrl ? <img src={settings.logoUrl} alt="Logo do estabelecimento" /> : <b>{initials(settings.businessName)}</b>}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadAsset("logo", event.target.files?.[0])} />
                <small>{uploading === "logo" ? "Enviando..." : "PNG, JPG ou WEBP"}</small>
              </label>
              <label className="upload-card wide">
                <span>Foto/capa</span>
                {settings.coverUrl ? <img src={settings.coverUrl} alt="Capa do cartão" /> : <b>Capa</b>}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadAsset("cover", event.target.files?.[0])} />
                <small>{uploading === "cover" ? "Enviando..." : "Usada no Google Wallet; Apple usa progresso no centro"}</small>
              </label>
            </div>
            <label>Nome do estabelecimento<input value={settings.businessName} onChange={(e) => update("businessName", e.target.value)} /></label>
            <label>Nome/descrição do programa<input value={settings.programDescription} onChange={(e) => update("programDescription", e.target.value)} /></label>
            <label>Texto da recompensa<input value={settings.rewardText} onChange={(e) => update("rewardText", e.target.value)} /></label>
          </div>

          <div className="wallet-form-section">
            <h3>Oferta e textos do programa</h3>
            <label>Título principal da oferta<input value={settings.rewardTitle} onChange={(e) => update("rewardTitle", e.target.value)} placeholder="Ex: Compre 7 e ganhe uma recompensa" /></label>
            <div className="form-row">
              <label>Nome da unidade de progresso<input value={settings.progressLabel} onChange={(e) => update("progressLabel", e.target.value)} placeholder="compras, pontos, visitas..." /></label>
              <label>Mensagem ao completar<input value={settings.completedMessage} onChange={(e) => update("completedMessage", e.target.value)} /></label>
            </div>
            <label>Como acumular<textarea value={settings.accumulationText} onChange={(e) => update("accumulationText", e.target.value)} rows={3} /></label>
            <label>Termos e condições<textarea value={settings.termsText} onChange={(e) => update("termsText", e.target.value)} rows={3} placeholder="Opcional. Aparece nos detalhes do cartão." /></label>
          </div>

          <div className="wallet-form-section">
            <h3>Visual e progresso</h3>
            <div className="form-row">
              <label>Cor principal<div className="color-input"><input type="color" value={settings.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} /><span>{settings.primaryColor.toUpperCase()}</span></div></label>
              <label>Cor secundária<div className="color-input"><input type="color" value={settings.secondaryColor} onChange={(e) => update("secondaryColor", e.target.value)} /><span>{settings.secondaryColor.toUpperCase()}</span></div></label>
            </div>
            <div className="form-row">
              <label>Cor de fundo<div className="color-input"><input type="color" value={settings.backgroundColor} onChange={(e) => update("backgroundColor", e.target.value)} /><span>{settings.backgroundColor.toUpperCase()}</span></div></label>
              <label>Cor dos textos<div className="color-input"><input type="color" value={settings.textColor} onChange={(e) => update("textColor", e.target.value)} /><span>{settings.textColor.toUpperCase()}</span></div></label>
            </div>
            <div className="form-row">
              <label>Meta de pontos/compras<input type="number" min="1" max="20" value={settings.pointsGoal} onChange={(e) => update("pointsGoal", Number(e.target.value))} /></label>
              <label>Tema de pontuação<select value={settings.pointTheme} onChange={(e) => update("pointTheme", e.target.value as PointTheme)}>{pointThemes.map((theme) => <option key={theme.value} value={theme.value}>{theme.label}</option>)}</select></label>
            </div>
            <p className="editor-note">A meta aqui controla a apresentação visual do cartão. A regra operacional de pontos continua separada.</p>
          </div>

          <div className="wallet-form-section">
            <h3>Contato do estabelecimento</h3>
            <label>Site<input value={settings.websiteUrl} onChange={(e) => update("websiteUrl", e.target.value)} placeholder="https://..." /></label>
            <div className="form-row">
              <label>Instagram<input value={settings.instagramUsername} onChange={(e) => update("instagramUsername", e.target.value)} placeholder="@empresa" /></label>
              <label>Telefone<input value={settings.contactPhone} onChange={(e) => update("contactPhone", e.target.value)} placeholder="(00) 00000-0000" /></label>
            </div>
            <label>Endereço<textarea value={settings.addressText} onChange={(e) => update("addressText", e.target.value)} rows={2} placeholder="Opcional" /></label>
          </div>
        </article>

        <section className="wallet-previews">
          <article className="wallet-preview-block">
            <div className="preview-label">Apple Wallet</div>
            <AppleWalletPreview settings={settings} points={previewPoints} />
          </article>
          <article className="wallet-preview-block">
            <div className="preview-label">Google Wallet</div>
            <GoogleWalletPreview settings={settings} points={previewPoints} />
          </article>
        </section>
      </div>
    </div>
  );
}

function ProgressMarks({ theme, total, current, fill, accent }: { theme: PointTheme; total: number; current: number; fill: string; accent?: string }) {
  return <div className={theme === "universal" ? "progress-marks universal" : "progress-marks"}>{Array.from({ length: total }).map((_, index) => {
    const done = index < current;
    return <span key={index} className={done ? "done" : ""} style={{ "--mark-color": fill, "--mark-accent": accent || fill } as CSSProperties}>{theme === "universal" ? index + 1 : <PointIcon theme={theme} />}</span>;
  })}</div>;
}

function PointIcon({ theme }: { theme: PointTheme }) {
  if (theme === "cafeteria") return <svg viewBox="0 0 24 24"><path d="M4 8h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"/><path d="M16 10h2.2a2.3 2.3 0 0 1 0 4.6H16"/><path d="M7 5h6"/></svg>;
  if (theme === "acaiteria") return <svg viewBox="0 0 24 24"><path d="M5 9h14l-1.5 8.5H6.5L5 9Z"/><path d="M8 9c.4-2 1.8-3 4-3s3.6 1 4 3"/><path d="M9 13h6"/></svg>;
  if (theme === "sorveteria") return <svg viewBox="0 0 24 24"><path d="M8 10a4 4 0 0 1 8 0"/><path d="M7 10h10l-5 10-5-10Z"/><path d="M10 14h4"/></svg>;
  if (theme === "pizzaria") return <svg viewBox="0 0 24 24"><path d="M6 20 18 4c-4 0-8 1.5-12 4v12Z"/><path d="M9 11h.1"/><path d="M11 15h.1"/><path d="M13 9h.1"/></svg>;
  if (theme === "hamburgueria") return <svg viewBox="0 0 24 24"><path d="M5 11c.5-3 3-5 7-5s6.5 2 7 5H5Z"/><path d="M5 14h14"/><path d="M6 17h12"/><path d="M8 11h.1M12 9h.1M16 11h.1"/></svg>;
  if (theme === "padaria") return <svg viewBox="0 0 24 24"><path d="M5 13c0-4 3-7 7-7s7 3 7 7c0 3-2.5 5-7 5s-7-2-7-5Z"/><path d="M9 8c-1 2-1 4 0 6M13 7c-1 2-1 5 0 8"/></svg>;
  if (theme === "barbearia") return <svg viewBox="0 0 24 24"><path d="m5 5 14 14"/><path d="m19 5-7 7"/><circle cx="6" cy="17" r="2.5"/><circle cx="6" cy="7" r="2.5"/></svg>;
  if (theme === "petshop") return <svg viewBox="0 0 24 24"><path d="M8 13c2-2 6-2 8 0l1 1.5c1.5 2.2 0 4.5-2.5 3.8a9 9 0 0 0-5 0C7 19 5.5 16.7 7 14.5L8 13Z"/><circle cx="7" cy="9" r="1.7"/><circle cx="11" cy="7" r="1.7"/><circle cx="15" cy="7" r="1.7"/><circle cx="19" cy="9" r="1.7"/></svg>;
  return null;
}

function detectTransparentLogoCorners(image: HTMLImageElement) {
  try {
    const size = 24;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) return false;
    context.clearRect(0, 0, size, size);
    context.drawImage(image, 0, 0, size, size);
    const pixels = context.getImageData(0, 0, size, size).data;
    return [
      [0, 0],
      [size - 1, 0],
      [0, size - 1],
      [size - 1, size - 1],
    ].some(([x, y]) => pixels[(y * size + x) * 4 + 3] < 220);
  } catch {
    return false;
  }
}

function AdaptiveAppleLogo({ settings }: { settings: WalletSettings }) {
  const [shape, setShape] = useState<AppleLogoShape>("circle");

  useEffect(() => {
    if (!settings.logoUrl) {
      setShape("circle");
      return;
    }
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const ratio = image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 1;
      if (ratio >= 1.45) {
        setShape("pill");
        return;
      }
      setShape(detectTransparentLogoCorners(image) ? "circle" : "rounded");
    };
    image.onerror = () => setShape("circle");
    image.src = settings.logoUrl;
  }, [settings.logoUrl]);

  return (
    <span className={`apple-logo-frame apple-logo-${shape}`}>
      {settings.logoUrl ? <img src={settings.logoUrl} alt="Logo" /> : initials(settings.businessName)}
    </span>
  );
}

function AppleWalletPreview({ settings, points }: { settings: WalletSettings; points: number }) {
  const completed = points >= settings.pointsGoal;
  return <div className="apple-pass apple-pass-simple" style={{
    "--apple-primary": settings.primaryColor,
    "--apple-secondary": settings.secondaryColor,
    "--apple-text": settings.textColor,
    backgroundColor: settings.primaryColor,
    color: settings.textColor,
  } as CSSProperties}>
    <div className="apple-simple-head">
      <div className="apple-simple-brand">
        <AdaptiveAppleLogo settings={settings} />
        <strong>{settings.businessName}</strong>
      </div>
      <div className="apple-simple-count"><small>{settings.progressLabel.toUpperCase()}</small><b>{points}/{settings.pointsGoal}</b></div>
    </div>
    <div className="apple-simple-progress" style={{ backgroundColor: settings.primaryColor }}>
      <ProgressMarks theme={settings.pointTheme} total={settings.pointsGoal} current={points} fill={settings.secondaryColor} accent={settings.secondaryColor} />
    </div>
    <div className="apple-simple-fields">
      <div><small>PROGRESSO</small><b>{points}/{settings.pointsGoal} {settings.progressLabel}</b></div>
      <div><small>CLIENTE</small><b>{previewCustomer.name.split(" ")[0]}</b></div>
      <div><small>STATUS</small><b>{completed ? "Disponível" : "Ativo"}</b></div>
      <div><small>RECOMPENSA</small><b>{settings.rewardText}</b></div>
    </div>
  </div>;
}

function GoogleWalletPreview({ settings, points }: { settings: WalletSettings; points: number }) {
  const completed = points >= settings.pointsGoal;
  const remaining = Math.max(settings.pointsGoal - points, 0);
  return <div className="google-pass" style={{ "--google-primary": settings.primaryColor, "--google-secondary": settings.secondaryColor } as CSSProperties}>
    <div className="google-hero" style={{ backgroundColor: settings.primaryColor }}>{settings.coverUrl ? <img src={settings.coverUrl} alt="" /> : null}<div className="google-hero-shade" /><div><small>Google Wallet</small><strong>{settings.businessName}</strong><span>{settings.programDescription}</span></div></div>
    <div className="google-pass-head"><div className="google-logo">{settings.logoUrl ? <img src={settings.logoUrl} alt="" /> : initials(settings.businessName)}</div><div><h3>{settings.businessName}</h3><p>{settings.programDescription}</p></div><PoweredBy /></div>
    <div className="google-detail"><span className="detail-icon"><svg viewBox="0 0 24 24"><path d="M5 10h14v10H5z"/><path d="M4 10h16V7H4z"/><path d="M12 7v13"/><path d="M8.5 7C6 5 8.5 3 12 7c3.5-4 6-2 3.5 0"/></svg></span><div><b>Recompensa</b><p>{settings.rewardText}</p></div></div>
    <div className="google-detail"><span className="detail-icon"><svg viewBox="0 0 24 24"><path d="M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z"/></svg></span><div><b>Seu progresso</b><p>{points} de {settings.pointsGoal} {settings.progressLabel}. {completed ? settings.completedMessage : `Faltam ${remaining} ${settings.progressLabel}.`}</p><ProgressMarks theme={settings.pointTheme} total={settings.pointsGoal} current={points} fill={settings.primaryColor} accent={settings.secondaryColor} /></div></div>
    <div className="google-detail"><span className="detail-icon"><svg viewBox="0 0 24 24"><path d="M5 8h14v8H5z"/><path d="M8 5h8"/><path d="M8 19h8"/></svg></span><div><b>Como acumular</b><p>{settings.accumulationText}</p></div></div>
    {(settings.websiteUrl || settings.instagramUsername || settings.contactPhone || settings.addressText) && <div className="google-detail"><span className="detail-icon"><svg viewBox="0 0 24 24"><path d="M12 21s7-5.2 7-11a7 7 0 0 0-14 0c0 5.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/></svg></span><div><b>Contato</b><p>{[settings.websiteUrl, settings.instagramUsername ? `@${settings.instagramUsername}` : "", settings.contactPhone, settings.addressText].filter(Boolean).join(" · ")}</p></div></div>}
  </div>;
}

function PoweredBy() {
  return <div className="powered-by"><span>Powered by</span><img src="/logo-fidelizarei-transparent.png" alt="fidelizarei" /></div>;
}

