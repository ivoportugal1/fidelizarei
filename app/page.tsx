import Link from "next/link";

export default function Home() {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <img className="landing-logo" src="/logo-fidelizarei-transparent.png" alt="Fidelizarei" />
        <Link className="button button-gold" href="/signup">Cadastre-se</Link>
      </nav>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">FIDELIDADE SEM APLICATIVO</div>
          <h1>Comprou. Escaneou.<br /><i>Voltou.</i></h1>
          <p>Crie QR Codes, registre pontos e faça o cliente voltar sem instalar app. Tudo com a identidade visual da Fidelizarei.</p>
          <div className="landing-actions">
            <Link className="button button-gold" href="/signup">Cadastre-se <span>→</span></Link>
            <Link className="button button-outline" href="/login">Entrar</Link>
          </div>
        </div>
        <div className="hero-brand-card" aria-label="Marca Fidelizarei">
          <img src="/fidelizarei-crown-banner.png" alt="" />
          <div>
            <span>FIDELIZAREI</span>
            <b>7 pontos</b>
            <small>recompensa liberada direto na carteira do cliente</small>
          </div>
        </div>
      </section>
      <section className="steps">
        <div><b>01</b><span>Você cria uma campanha e gera os QR Codes.</span></div>
        <div><b>02</b><span>O cliente escaneia o QR da embalagem.</span></div>
        <div><b>03</b><span>O ponto vai para a carteira dele.</span></div>
      </section>
    </main>
  );
}
