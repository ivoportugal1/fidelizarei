"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import type { DashboardData } from "@/lib/admin-data";

type GeneratedCode = { code: string; url: string };

const formatNumber = (value: number) => value.toLocaleString("pt-BR");
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Sem atividade";
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "CL";

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
          <div className="company-logo">{initialData.organization.name[0]}</div>
          <div><strong>{initialData.organization.name}</strong><small>Plano {initialData.organization.plan}</small></div>
          <span>⌄</span>
        </div>
        <nav>
          {["Visão geral", "Clientes", "Campanhas", "QR Codes", "Recompensas", "Personalizar cartão"].map((item) => (
            <button key={item} className={active === item ? "nav-item active" : "nav-item"} onClick={() => setActive(item)}>
              <span>{({ "Visão geral": "▦", Clientes: "♙", Campanhas: "◌", "QR Codes": "▣", Recompensas: "♢", "Personalizar cartão": "✦" } as Record<string, string>)[item]}</span>{item}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item"><span>?</span>Central de ajuda</button>
          <button className="profile" onClick={logout}><span>{initials(initialData.user.name)}</span><b>Sair</b><i>↗</i></button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><p>{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date()).toUpperCase()}</p><h1>{active}</h1></div>
          <div className="top-actions"><button className="icon-button">⌕</button><button className="icon-button notification">♧</button><button className="button button-dark" onClick={() => setShowGenerator(true)}>+ Gerar QR Codes</button></div>
        </header>

        {active === "Visão geral" ? <Overview data={initialData} onGenerate={() => setShowGenerator(true)} /> :
          active === "QR Codes" ? <Codes data={initialData} codes={generatedCodes} firstCode={firstCode} onGenerate={() => setShowGenerator(true)} onExport={exportCsv} /> :
          active === "Clientes" ? <Customers data={initialData} /> :
          active === "Campanhas" ? <Campaigns data={initialData} /> :
          active === "Personalizar cartão" ? <CardDesigner data={initialData} onSave={() => flash("Personalização visual entra na próxima etapa de edição real.")} /> :
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

function CardDesigner({ data, onSave }: { data: DashboardData; onSave: () => void }) {
  const [name, setName] = useState(data.organization.name);
  const [color, setColor] = useState(data.program.backgroundColor);
  const dots = useMemo(() => Array.from({ length: Math.min(data.program.pointsToReward, 10) }), [data.program.pointsToReward]);
  return <div className="content"><section className="section-intro"><div><div className="eyebrow">IDENTIDADE VISUAL</div><h2>Personalizar cartão</h2><p>Prévia do cartão que será usado na integração com Wallet.</p></div></section><div className="designer"><article className="panel design-form"><label>Nome da empresa<input value={name} onChange={(e) => setName(e.target.value)} /></label><label>Nome do programa<input value={data.program.name} readOnly /></label><label>Cor principal<div className="color-input"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /><span>{color.toUpperCase()}</span></div></label><button className="button button-dark" onClick={onSave}>Salvar alterações</button></article><article className="designer-preview"><div className="pass-card editable" style={{ background: color }}><div className="pass-head"><span className="pass-mark">{name[0]}</span><span>{name.toUpperCase()}</span><b>•••</b></div><div className="pass-title">{data.program.name}</div><div className="pass-count"><b>0</b><span>/ {data.program.pointsToReward}</span><small>PONTOS</small></div><div className="pass-dots">{dots.map((_, index) => <i key={index} className={index === 0 ? "" : "empty"}></i>)}</div><div className="pass-reward">{data.program.pointsToReward} pontos = {data.program.rewardName}</div></div><p>Persistência de personalização entra no próximo corte.</p></article></div></div>;
}
