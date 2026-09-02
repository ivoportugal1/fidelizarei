import Link from "next/link";

export default function Home() {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <span className="brand">fideliza<span>.</span></span>
        <Link className="button button-dark" href="/dashboard">Ver demonstração</Link>
      </nav>
      <section className="hero">
        <div className="eyebrow">FIDELIDADE SEM APLICATIVO</div>
        <h1>Comprou. Escaneou.<br /><i>Voltou.</i></h1>
        <p>Transforme cada embalagem em uma nova visita. Seus clientes acumulam pontos pela câmera e acompanham tudo na Wallet.</p>
        <Link className="button button-coral" href="/dashboard">Conhecer o painel <span>→</span></Link>
      </section>
      <section className="steps">
        <div><b>01</b><span>Você cria uma campanha e gera os QR Codes.</span></div>
        <div><b>02</b><span>O cliente escaneia o QR da embalagem.</span></div>
        <div><b>03</b><span>O ponto vai para a carteira dele.</span></div>
      </section>
    </main>
  );
}
