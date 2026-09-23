import Link from "next/link";

const Arrow = () => <span aria-hidden="true">→</span>;

export default function Home() {
  return (
    <main className="marketing-page marketing-page-refined">
      <nav className="marketing-nav">
        <img className="marketing-logo" src="/logo-fidelizarei-transparent.png" alt="Fidelizarei" />
        <div className="marketing-nav-links">
          <a href="#como-funciona">Como funciona</a>
          <a href="#recursos">Recursos</a>
          <a href="#duvidas">Dúvidas</a>
        </div>
        <Link className="marketing-button marketing-button-dark" href="/signup">Criar conta <Arrow /></Link>
      </nav>

      <section className="marketing-hero">
        <div className="marketing-hero-copy">
          <p className="marketing-kicker"><i /> PROGRAMA DE FIDELIDADE DIGITAL</p>
          <h1>Fidelidade simples<br />para clientes que <em>voltam.</em></h1>
          <p className="marketing-lead">Crie campanhas, gere QR Codes e registre pontos sem cartão de papel e sem aplicativo para o cliente baixar.</p>
          <div className="marketing-hero-actions">
            <Link className="marketing-button marketing-button-gold" href="/signup">Começar teste grátis <Arrow /></Link>
            <a className="marketing-text-link" href="#como-funciona">Entender a plataforma <span>↓</span></a>
          </div>
          <div className="marketing-trust"><span>Sem aplicativo</span><span>Apple e Google Wallet</span><span>Controle por campanha</span></div>
        </div>
        <div className="marketing-hero-visual" aria-label="Exemplo de cartão de fidelidade digital">
          <div className="marketing-orbit marketing-orbit-one" /><div className="marketing-orbit marketing-orbit-two" />
          <div className="marketing-phone"><div className="marketing-phone-notch" /><div className="marketing-phone-top"><span>9:41</span><b>● ● ●</b></div><div className="marketing-wallet-label">Apple Wallet</div><div className="marketing-pass-card"><div className="marketing-pass-head"><img src="/logo-fidelizarei-transparent.png" alt="" /><span>CAFÉ PORTUGAL</span></div><small>CARTÃO DE FIDELIDADE</small><strong>7 cafés<br />e o próximo é grátis</strong><div className="marketing-pass-dots"><i className="done" /><i className="done" /><i className="done" /><i /><i /><i /><i /></div><div className="marketing-pass-bottom"><span>3 DE 7 PONTOS</span><b>ATIVO</b></div></div><div className="marketing-phone-bottom">⌁</div></div>
          <div className="marketing-scan-chip"><span>⌘</span><div><small>PONTUAÇÃO</small><b>QR Code lido</b></div></div>
        </div>
      </section>

      <section className="marketing-proof"><p>FEITO PARA NEGÓCIOS QUE ATENDEM TODOS OS DIAS</p><div><span>PADARIAS</span><span>RESTAURANTES</span><span>LAVA-JATOS</span><span>SALÕES</span><span>LOJAS</span></div></section>

      <section className="marketing-problem" id="recursos">
        <div className="marketing-section-heading"><p className="marketing-kicker"><i /> TUDO EM UM SÓ LUGAR</p><h2>Uma campanha clara<br />para a equipe e para o cliente.</h2></div>
        <div className="marketing-benefit-grid"><article><b>01</b><h3>Campanhas</h3><p>Defina a meta, a recompensa, a validade e as regras de cada programa.</p><span>↗</span></article><article><b>02</b><h3>QR Codes</h3><p>Gere adesão e pontuação para usar no balcão, no cardápio ou no totem.</p><span>↗</span></article><article><b>03</b><h3>Carteira digital</h3><p>O cliente acompanha os pontos no celular, direto pela Apple ou Google Wallet.</p><span>↗</span></article></div>
      </section>

      <section className="marketing-how" id="como-funciona"><div className="marketing-how-copy"><p className="marketing-kicker"><i /> COMO FUNCIONA</p><h2>Do cadastro ao retorno do cliente.</h2><p>O processo foi pensado para caber na rotina da sua loja: uma campanha configurada, QR Codes prontos e pontos registrados em poucos passos.</p><Link className="marketing-button marketing-button-dark" href="/signup">Criar minha conta <Arrow /></Link></div><ol className="marketing-steps"><li><b>1</b><div><small>CONFIGURE</small><h3>Crie uma campanha</h3><p>Escolha a regra, a recompensa e a validade.</p></div></li><li><b>2</b><div><small>DIVULGUE</small><h3>Disponibilize os QR Codes</h3><p>O cliente entra no programa pelo próprio celular.</p></div></li><li><b>3</b><div><small>REGISTRE</small><h3>Adicione os pontos</h3><p>Use o CPF do cliente para identificar e pontuar.</p></div></li></ol></section>

      <section className="marketing-campaign"><div className="marketing-campaign-card"><div className="marketing-campaign-copy"><p className="marketing-kicker"><i /> VISÃO DO CLIENTE</p><h2>O cartão fica<br />onde ele já olha.</h2><p>O progresso da campanha fica salvo na carteira do celular. Sem papel, sem cartão físico e sem login repetido.</p><span>Compatível com Apple Wallet e Google Wallet.</span></div><div className="marketing-reward"><small>CAFÉ PORTUGAL</small><b>3</b><p>de 7 cafés acumulados</p><div>● ● ● ○ ○ ○ ○</div><strong>FALTAM 4 PONTOS</strong></div></div></section>

      <section className="marketing-faq" id="duvidas"><div><p className="marketing-kicker"><i /> PERGUNTAS FREQUENTES</p><h2>O essencial, sem enrolação.</h2></div><div className="marketing-faq-list"><details open><summary>O cliente precisa baixar um aplicativo?<span>+</span></summary><p>Não. Ele salva o cartão na Apple Wallet ou Google Wallet e acompanha os pontos por lá.</p></details><details><summary>Consigo usar mais de uma campanha?<span>+</span></summary><p>Sim. Cada campanha tem seus próprios QR Codes, recompensa e regra de pontuação.</p></details><details><summary>É difícil para a equipe usar?<span>+</span></summary><p>Não. A pontuação acontece lendo o QR Code e identificando o cliente pelo CPF.</p></details></div></section>

      <section className="marketing-final-cta"><p className="marketing-kicker"><i /> PRONTO PARA COMEÇAR?</p><h2>Crie sua primeira campanha<br />e comece a fidelizar.</h2><p>Conheça a plataforma no seu ritmo e veja como ela funciona na sua operação.</p><div><Link className="marketing-button marketing-button-gold" href="/signup">Criar conta grátis <Arrow /></Link><a href="https://wa.me/5571982185663?text=Olá!%20Quero%20conhecer%20a%20Fidelizarei." target="_blank" rel="noreferrer">Falar com a Fidelizarei</a></div></section>
      <footer className="marketing-footer"><img src="/logo-fidelizarei-transparent.png" alt="Fidelizarei" /><span>Programa de fidelidade digital.</span><a href="https://www.instagram.com/fidelizarei/" target="_blank" rel="noreferrer">@fidelizarei ↗</a></footer>
    </main>
  );
}
