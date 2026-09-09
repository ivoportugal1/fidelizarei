"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import QRCode from "qrcode";
import type { DashboardData } from "@/lib/admin-data";

type GeneratedCode = { code: string; url: string };
type WalletSettings = DashboardData["walletSettings"];
type PointTheme = WalletSettings["pointTheme"];

const formatNumber = (value: number) => value.toLocaleString("pt-BR");
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Sem atividade";
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "CL";
const planLabel = (interval: "monthly" | "yearly") => interval === "yearly" ? "Anual" : "Mensal";

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

export default function Dashboard({ initialData }: { initialData: DashboardData }) {
  const [active, setActive] = useState("Visão geral");
  const [quantity, setQuantity] = useState(25);
  const [showGenerator, setShowGenerator] = useState(false);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<GeneratedCode[]>([]);
  const firstCode = generatedCodes[0]?.url;

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  async function generateCodes() {
    setLoading(true);
    const response = await fetch("/api/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok || !body.ok) {
      flash("Não consegui gerar os QR Codes. Confira o banco e tente de novo.");
      return;
    }
    setGeneratedCodes(body.codes);
    setShowGenerator(false);
    setActive("QR Codes");
    flash(`${body.codes.length.toLocaleString("pt-BR")} QR Codes reais gerados.`);
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

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">fideliza<span>.</span></a>
        <div className="company-switcher">
          <div className="company-logo">
            {initialData.walletSettings.logoUrl ? (
              <img src={initialData.walletSettings.logoUrl} alt={`Logo ${initialData.organization.name}`} />
            ) : (
              initialData.organization.name[0]
            )}
          </div>
          <div><strong>{initialData.organization.name}</strong><small>Plano {planLabel(initialData.organization.billingInterval)}</small></div>
        </div>
        <nav>
          {["Visão geral", "Clientes", "Campanhas", "QR Codes", "Recompensas", "Personalizar cartão"].map((item) => (
            <button key={item} className={active === item ? "nav-item active" : "nav-item"} onClick={() => setActive(item)}>
              <span>{({ "Visão geral": "▦", Clientes: "♙", Campanhas: "◌", "QR Codes": "▣", Recompensas: "♢", "Personalizar cartão": "✦" } as Record<string, string>)[item]}</span>{item}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="profile" onClick={logout}><span>{initials(initialData.user.name)}</span><b>Sair</b><i>↗</i></button>
        </div>
      </aside>

      <section className="workspace">
        <TrialBanner data={initialData} />
        <header className="topbar">
          <div><p>{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date()).toUpperCase()}</p><h1>{active}</h1></div>
          <div className="top-actions"><button className="button button-dark" onClick={() => setShowGenerator(true)}>+ Gerar QR Codes</button></div>
        </header>

        {active === "Visão geral" ? <Overview data={initialData} onGenerate={() => setShowGenerator(true)} /> :
          active === "QR Codes" ? <Codes data={initialData} codes={generatedCodes} firstCode={firstCode} onGenerate={() => setShowGenerator(true)} onExport={exportCsv} /> :
          active === "Clientes" ? <Customers data={initialData} /> :
          active === "Campanhas" ? <Campaigns data={initialData} /> :
          active === "Personalizar cartão" ? <CardDesigner data={initialData} onSave={flash} /> :
          <Rewards data={initialData} />}
      </section>

      {showGenerator && (
        <div className="modal-backdrop" onMouseDown={() => setShowGenerator(false)}>
          <section className="modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowGenerator(false)}>×</button>
            <p className="eyebrow">NOVA REMESSA</p>
            <h2>Gerar QR Codes</h2>
            <p className="muted">Cada código é único, vale {initialData.program.pointsPerCode} ponto e só pode ser usado uma vez.</p>
            <label>Quantidade<input type="number" min="1" max="500" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
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

function Codes({ data, codes, firstCode, onGenerate, onExport }: { data: DashboardData; codes: GeneratedCode[]; firstCode?: string; onGenerate: () => void; onExport: () => void }) {
  const preview = firstCode || "https://fidelizarei.vercel.app/r/GERADO-APOS-CLIQUE";
  return <div className="content"><section className="section-intro"><div><div className="eyebrow">EMBALAGENS E PEDIDOS</div><h2>QR Codes</h2><p>Gere códigos únicos para imprimir ou inserir nos seus pedidos.</p></div><div className="top-actions"><button className="button button-light" disabled={!codes.length} onClick={onExport}>Exportar CSV</button><button className="button button-dark" onClick={onGenerate}>+ Gerar QR Codes</button></div></section><section className="metrics"><Metric value={formatNumber(data.metrics.activeCodes)} label="Códigos disponíveis" trend="Antes desta tela" /><Metric value={formatNumber(data.metrics.redeemedCodes)} label="Códigos resgatados" trend="Uso único" /><Metric value={formatNumber(codes.length)} label="Gerados agora" trend="Exportáveis" /></section><article className="panel empty-qr"><QrPreview value={preview} /><div><h3>{codes.length ? "Primeiro QR gerado" : "Gere uma remessa"}</h3><p>{codes.length ? "Estes links só aparecem agora. Exporte o CSV antes de sair desta página." : "Os códigos são gravados no banco como hash e liberam pontos na tela pública de resgate."}</p>{firstCode && <a className="button button-light" href={firstCode} target="_blank">Abrir página de resgate →</a>}</div></article>{codes.length > 0 && <article className="panel activity code-list"><table><thead><tr><th>CÓDIGO</th><th>URL</th></tr></thead><tbody>{codes.slice(0, 20).map((item) => <tr key={item.code}><td><strong>{item.code}</strong></td><td className="date">{item.url}</td></tr>)}</tbody></table></article>}</div>;
}

function Customers({ data }: { data: DashboardData }) {
  return <div className="content"><section className="section-intro"><div><div className="eyebrow">BASE DE FIDELIDADE</div><h2>Clientes</h2><p>Clientes cadastrados por resgate de QR Code.</p></div></section><article className="panel activity"><table><thead><tr><th>CLIENTE</th><th>PONTOS</th><th>RECOMPENSAS</th><th>ÚLTIMA ATIVIDADE</th></tr></thead><tbody>{data.customers.length ? data.customers.map((customer) => <tr key={customer.id}><td><span className="avatar">{initials(customer.name)}</span><b>{customer.name}</b></td><td><strong>{customer.points} / {data.program.pointsToReward}</strong></td><td><span className={customer.rewards > 0 ? "status ready" : "status"}>{customer.rewards}</span></td><td className="date">{formatDate(customer.updatedAt)}</td></tr>) : <tr><td colSpan={4}>Nenhum cliente cadastrado ainda.</td></tr>}</tbody></table></article></div>;
}

function Campaigns({ data }: { data: DashboardData }) {
  return <div className="content"><section className="section-intro"><div><div className="eyebrow">CAMPANHA ATIVA</div><h2>{data.program.name}</h2><p>{data.program.pointsToReward} pontos liberam {data.program.rewardName}.</p></div></section><section className="metrics"><Metric value={String(data.program.pointsPerCode)} label="Ponto por QR" trend="Atual" /><Metric value={String(data.program.pointsToReward)} label="Meta" trend="Por recompensa" /><Metric value="Ativa" label="Status" trend="Recebendo resgates" /></section></div>;
}

function Rewards({ data }: { data: DashboardData }) {
  return <div className="content"><section className="section-intro"><div><div className="eyebrow">RECOMPENSAS</div><h2>{data.program.rewardName}</h2><p>O saldo é calculado automaticamente quando o cliente atinge a meta de pontos.</p></div></section><section className="metrics"><Metric value={formatNumber(data.metrics.rewards)} label="Disponíveis" trend="Na base" /><Metric value={String(data.program.pointsToReward)} label="Pontos necessários" trend={data.program.name} /></section></div>;
}

function CardDesigner({ data, onSave }: { data: DashboardData; onSave: (message: string) => void }) {
  const [settings, setSettings] = useState<WalletSettings>(data.walletSettings);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);
  const previewPoints = Math.min(4, settings.pointsGoal);

  const update = <K extends keyof WalletSettings>(key: K, value: WalletSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  async function uploadAsset(kind: "logo" | "cover", file?: File) {
    if (!file) return;
    setUploading(kind);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/wallet/assets", { method: "POST", body: formData });
      const body = await response.json().catch(() => ({ ok: false }));
      if (!response.ok || !body.ok) {
        onSave("Não consegui enviar a imagem. Use PNG, JPG ou WEBP com até 2 MB.");
        return;
      }
      update(kind === "logo" ? "logoUrl" : "coverUrl", body.url);
    } catch {
      onSave("Não consegui enviar a imagem. Tente novamente.");
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/wallet/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const body = await response.json().catch(() => ({ ok: false }));
      if (!response.ok || !body.ok) {
        onSave("Não consegui salvar. Rode a migração do banco e tente de novo.");
        return;
      }
      setSettings(body.settings);
      onSave("Personalização do cartão salva.");
    } catch {
      onSave("Não consegui salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
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
                <small>{uploading === "cover" ? "Enviando..." : "Imagem horizontal funciona melhor"}</small>
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

function AppleWalletPreview({ settings, points }: { settings: WalletSettings; points: number }) {
  const completed = points >= settings.pointsGoal;
  const remaining = Math.max(settings.pointsGoal - points, 0);
  return <div className="apple-pass" style={{ backgroundColor: settings.backgroundColor, color: settings.textColor }}>
    <div className="pass-hero" style={{ backgroundColor: settings.primaryColor, "--accent-color": settings.secondaryColor } as CSSProperties}>{settings.coverUrl ? <img src={settings.coverUrl} alt="" /> : null}<div className="pass-hero-shade" /><div className="merchant-logo">{settings.logoUrl ? <img src={settings.logoUrl} alt="" /> : initials(settings.businessName)}</div><strong>{settings.businessName}</strong><small>{settings.programDescription}</small></div>
    <div className="pass-body">
      <h3>{settings.rewardTitle}</h3>
      <ProgressMarks theme={settings.pointTheme} total={settings.pointsGoal} current={points} fill={settings.primaryColor} accent={settings.secondaryColor} />
      <div className="pass-progress-row"><b>{points} de {settings.pointsGoal} {settings.progressLabel}</b><span>{completed ? settings.completedMessage : `Faltam ${remaining} ${settings.progressLabel}`}</span></div>
      <div className="pass-footer-grid"><div><small>CLIENTE</small><b>{previewCustomer.name}</b></div><div><small>MEMBRO DESDE</small><b>{previewCustomer.memberSince}</b></div><PoweredBy /></div>
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
