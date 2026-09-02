"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

const customers = [
  ["Mariana Costa", "MC", "7", "Recompensa disponível", "Hoje, 13:24"],
  ["Rafael Lima", "RL", "5", "Faltam 2 pontos", "Hoje, 11:05"],
  ["Ana Beatriz", "AB", "3", "Faltam 4 pontos", "Ontem, 19:42"],
  ["João Pedro", "JP", "1", "Faltam 6 pontos", "Ontem, 16:18"],
];

function QrPreview({ value }: { value: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) QRCode.toCanvas(ref.current, value, { width: 176, margin: 1, color: { dark: "#17211f", light: "#ffffff" } });
  }, [value]);
  return <canvas ref={ref} aria-label="QR Code de demonstração" />;
}

export default function Dashboard() {
  const [active, setActive] = useState("Visão geral");
  const [codes, setCodes] = useState(250);
  const [showGenerator, setShowGenerator] = useState(false);
  const [toast, setToast] = useState("");
  const redemptionUrl = typeof window === "undefined" ? "https://fideliza.app/r/DEMO-CAF-8K2Q" : `${window.location.origin}/r/DEMO-CAF-8K2Q`;
  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2800); };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">fideliza<span>.</span></a>
        <div className="company-switcher"><div className="company-logo">B</div><div><strong>Boiler Café</strong><small>Plano Essencial</small></div><span>⌄</span></div>
        <nav>
          {["Visão geral", "Clientes", "Campanhas", "QR Codes", "Recompensas", "Personalizar cartão"].map((item) => (
            <button key={item} className={active === item ? "nav-item active" : "nav-item"} onClick={() => setActive(item)}>
              <span>{({ "Visão geral": "▦", Clientes: "♙", Campanhas: "◌", "QR Codes": "▣", Recompensas: "♢", "Personalizar cartão": "✦" } as Record<string, string>)[item]}</span>{item}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom"><button className="nav-item"><span>?</span>Central de ajuda</button><button className="profile"><span>RC</span><b>Rafa Café</b><i>⌄</i></button></div>
      </aside>

      <section className="workspace">
        <header className="topbar"><div><p>TERÇA-FEIRA, 1 DE SETEMBRO</p><h1>{active}</h1></div><div className="top-actions"><button className="icon-button">⌕</button><button className="icon-button notification">♧</button><button className="button button-dark" onClick={() => setShowGenerator(true)}>+ Gerar QR Codes</button></div></header>

        {active === "Visão geral" ? <Overview onGenerate={() => setShowGenerator(true)} /> :
          active === "QR Codes" ? <Codes onGenerate={() => setShowGenerator(true)} /> :
          active === "Clientes" ? <Customers /> :
          active === "Personalizar cartão" ? <CardDesigner onSave={() => flash("Personalização salva. O próximo passe refletirá as alterações.")} /> :
          <ComingSoon section={active} />}
      </section>

      {showGenerator && <div className="modal-backdrop" onMouseDown={() => setShowGenerator(false)}><section className="modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowGenerator(false)}>×</button><p className="eyebrow">NOVA REMESSA</p><h2>Gerar QR Codes</h2><p className="muted">Cada código pode ser usado uma única vez e vale 1 ponto para a campanha Café que volta.</p><label>Quantidade<input type="number" min="1" max="10000" value={codes} onChange={(event) => setCodes(Number(event.target.value))} /></label><label>Validade<select><option>Sem expiração</option><option>30 dias</option><option>90 dias</option></select></label><button className="button button-coral modal-submit" onClick={() => { setShowGenerator(false); flash(`${codes.toLocaleString("pt-BR")} QR Codes gerados. A exportação será habilitada ao conectar o banco.`); }}>Gerar {codes.toLocaleString("pt-BR")} códigos →</button></section></div>}
      {toast && <div className="toast">✓ {toast}</div>}
      <span className="sr-only">URL de exemplo: {redemptionUrl}</span>
    </main>
  );
}

function Overview({ onGenerate }: { onGenerate: () => void }) {
  return <div className="content"><section className="welcome"><div><div className="eyebrow">BOILER CAFÉ</div><h2>Bom dia, Rafa. <span>☕</span></h2><p>Seu programa está crescendo bonito. Veja como foi a movimentação recente.</p></div><button className="button button-light" onClick={onGenerate}>+ Nova remessa</button></section><section className="metrics"><Metric value="1.284" label="Clientes cadastrados" trend="+12% este mês" /><Metric value="5.821" label="Pontos distribuídos" trend="+18% este mês" /><Metric value="342" label="Recompensas resgatadas" trend="+8% este mês" /><Metric value="817" label="Clientes ativos" trend="63% da base" /></section><section className="dashboard-grid"><article className="panel chart-panel"><div className="panel-header"><div><h3>Pontos por dia</h3><p>Últimos 7 dias</p></div><button className="select-button">Esta semana⌄</button></div><div className="chart"><div className="axis"><i>120</i><i>80</i><i>40</i><i>0</i></div><div className="bars">{[42, 61, 54, 72, 66, 91, 80].map((height, index) => <div key={index}><span style={{ height: `${height}%` }}></span><small>{["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"][index]}</small></div>)}</div></div><div className="chart-total"><b>684</b><span>pontos distribuídos esta semana</span><em>↑ 18,4%</em></div></article><article className="panel wallet-preview"><div className="panel-header"><div><h3>Seu cartão</h3><p>Prévia na Wallet</p></div><button className="link-button">Editar</button></div><PassCard /><p className="wallet-foot">O cartão é atualizado automaticamente<br />depois de cada QR resgatado.</p></article></section><section className="panel activity"><div className="panel-header"><div><h3>Atividade recente</h3><p>Últimos pontos creditados</p></div><button className="link-button">Ver todos →</button></div><table><thead><tr><th>CLIENTE</th><th>PONTOS</th><th>STATUS</th><th>QUANDO</th></tr></thead><tbody>{customers.map(([name, initials, points, status, date]) => <tr key={name}><td><span className="avatar">{initials}</span><b>{name}</b></td><td><strong className="points">+{points === "7" ? "1" : "1"}</strong></td><td><span className={status.includes("disponível") ? "status ready" : "status"}>{status}</span></td><td className="date">{date}</td></tr>)}</tbody></table></section></div>;
}

function Metric({ value, label, trend }: { value: string; label: string; trend: string }) { return <article className="metric"><p>{label}</p><div><b>{value}</b><span>{trend}</span></div></article>; }

function PassCard() { return <div className="pass-card"><div className="pass-head"><span className="pass-mark">B</span><span>BOILER CAFÉ</span><b>•••</b></div><div className="pass-title">Café que volta</div><div className="pass-count"><b>5</b><span>/ 7</span><small>CAFÉS</small></div><div className="pass-dots"><i></i><i></i><i></i><i></i><i></i><i className="empty"></i><i className="empty"></i></div><div className="pass-reward">Faltam 2 cafés para seu próximo grátis ☕</div></div>; }

function Codes({ onGenerate }: { onGenerate: () => void }) { return <div className="content"><section className="section-intro"><div><div className="eyebrow">EMBALAGENS E PEDIDOS</div><h2>QR Codes</h2><p>Gere códigos únicos para imprimir ou inserir nos seus pedidos.</p></div><button className="button button-dark" onClick={onGenerate}>+ Gerar QR Codes</button></section><section className="metrics"><Metric value="2.500" label="Códigos disponíveis" trend="Remessa #14" /><Metric value="1.683" label="Códigos resgatados" trend="67% da remessa" /><Metric value="817" label="Ainda não usados" trend="Sem expiração" /></section><article className="panel empty-qr"><QrPreview value="https://fideliza.app/r/DEMO-CAF-8K2Q" /><div><h3>Seu primeiro QR de teste</h3><p>Use a câmera do celular para abrir a página de resgate. Neste MVP, ele funciona como uma demonstração visual.</p><a className="button button-light" href="/r/DEMO-CAF-8K2Q" target="_blank">Abrir página de resgate →</a></div></article></div>; }

function Customers() { return <div className="content"><section className="section-intro"><div><div className="eyebrow">BASE DE FIDELIDADE</div><h2>Clientes</h2><p>Acompanhe os clientes e o histórico de pontos do Boiler Café.</p></div><button className="button button-light">Exportar CSV</button></section><article className="panel activity"><table><thead><tr><th>CLIENTE</th><th>PONTOS</th><th>STATUS</th><th>ÚLTIMA ATIVIDADE</th></tr></thead><tbody>{customers.map(([name, initials, points, status, date]) => <tr key={name}><td><span className="avatar">{initials}</span><b>{name}</b></td><td><strong>{points} / 7</strong></td><td><span className={status.includes("disponível") ? "status ready" : "status"}>{status}</span></td><td className="date">{date}</td></tr>)}</tbody></table></article></div>; }

function CardDesigner({ onSave }: { onSave: () => void }) { const [name, setName] = useState("Boiler Café"); const [color, setColor] = useState("#12635A"); return <div className="content"><section className="section-intro"><div><div className="eyebrow">IDENTIDADE VISUAL</div><h2>Personalizar cartão</h2><p>O cliente vê este cartão na Apple Wallet ou Google Wallet.</p></div></section><div className="designer"><article className="panel design-form"><label>Nome da empresa<input value={name} onChange={(e) => setName(e.target.value)} /></label><label>Nome do programa<input defaultValue="Café que volta" /></label><label>Cor principal<div className="color-input"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /><span>{color.toUpperCase()}</span></div></label><label>Regra do programa<input defaultValue="7 cafés = 1 café grátis" /></label><button className="button button-dark" onClick={onSave}>Salvar alterações</button></article><article className="designer-preview"><div className="pass-card editable" style={{ background: color }}><div className="pass-head"><span className="pass-mark">B</span><span>{name.toUpperCase()}</span><b>•••</b></div><div className="pass-title">Café que volta</div><div className="pass-count"><b>5</b><span>/ 7</span><small>CAFÉS</small></div><div className="pass-dots"><i></i><i></i><i></i><i></i><i></i><i className="empty"></i><i className="empty"></i></div><div className="pass-reward">Faltam 2 cafés para seu próximo grátis ☕</div></div><p>Prévia ilustrativa. A Wallet mantém limitações próprias de layout.</p></article></div></div>; }
function ComingSoon({ section }: { section: string }) { return <div className="content"><section className="coming"><div className="coming-icon">✦</div><div className="eyebrow">EM CONSTRUÇÃO</div><h2>{section}</h2><p>Esta área entra na próxima etapa do MVP. A estrutura do painel já está pronta para receber os dados reais.</p></section></div>; }
