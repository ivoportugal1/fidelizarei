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
      <section className="landing-contact" aria-labelledby="contact-title">
        <div className="landing-contact-copy">
          <span className="eyebrow">ESTAMOS AQUI PARA AJUDAR</span>
          <h2 id="contact-title">Ainda ficou com alguma dúvida?</h2>
          <p>Fale com a gente e entenda como a Fidelizarei pode fazer seus clientes voltarem mais vezes.</p>
        </div>
        <div className="contact-actions">
          <a
            className="contact-button contact-button-whatsapp"
            href="https://wa.me/5571982185663?text=Olá!%20Tenho%20interesse%20em%20conhecer%20a%20Fidelizarei."
            target="_blank"
            rel="noreferrer"
          >
            <span className="contact-icon" aria-hidden="true">◔</span>
            <span><small>Fale pelo WhatsApp</small><b>(71) 98218-5663</b></span>
            <i aria-hidden="true">↗</i>
          </a>
          <a className="contact-button contact-button-instagram" href="https://www.instagram.com/fidelizarei/" target="_blank" rel="noreferrer">
            <span className="contact-icon" aria-hidden="true">◎</span>
            <span><small>Acompanhe no Instagram</small><b>@fidelizarei</b></span>
            <i aria-hidden="true">↗</i>
          </a>
        </div>
      </section>
    </main>
  );
}
