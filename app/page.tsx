import "./landing.css";
import { PROGRESS_ICON_GRID, progressIconPaths } from "@/lib/wallet-icons";

const WHATSAPP = "https://wa.me/5571982185663?text=Ol%C3%A1!%20Quero%20conhecer%20a%20Fidelizarei.";
const INSTAGRAM = "https://www.instagram.com/fidelizarei/";
const EMAIL = "fidelizarei@gmail.com";

function Glyph({ theme, className }: { theme: string; className?: string }) {
  const paths = progressIconPaths[theme] ?? [];
  return (
    <svg className={className} viewBox={`0 0 ${PROGRESS_ICON_GRID} ${PROGRESS_ICON_GRID}`} fill="currentColor" aria-hidden="true">
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  );
}

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
  );
}

type CardProps = { store: string; theme: string; goal: number; points: number; bg: string; accent: string; reward: string; customer: string; small?: boolean };

// Mini version of the real Apple Wallet pass we generate.
function WalletCard({ store, theme, goal, points, bg, accent, reward, customer, small }: CardProps) {
  return (
    <div className={small ? "lp-pass is-small" : "lp-pass"} style={{ background: bg, ["--accent" as string]: accent }}>
      <div className="lp-pass-top">
        <div className="lp-pass-brand"><img src="/brand/crown-gold.png" alt="" /><span>{store}</span></div>
        <div className="lp-pass-points"><small>PONTOS</small><b>{points} de {goal}</b></div>
      </div>
      <div className="lp-pass-strip">
        {Array.from({ length: goal }).map((_, i) => (
          <Glyph key={i} theme={theme} className={i < points ? "is-on" : "is-off"} />
        ))}
      </div>
      <div className="lp-pass-fields">
        <div><small>CLIENTE</small><b>{customer}</b></div>
        <div><small>RECOMPENSA</small><b>{reward}</b></div>
      </div>
    </div>
  );
}

const sectors = [
  { theme: "cafeteria", label: "Cafeterias" },
  { theme: "padaria", label: "Padarias" },
  { theme: "pizzaria", label: "Pizzarias" },
  { theme: "hamburgueria", label: "Hamburguerias" },
  { theme: "sorveteria", label: "Sorveterias" },
  { theme: "acaiteria", label: "Açaiterias" },
  { theme: "barbearia", label: "Barbearias" },
  { theme: "petshop", label: "Pet shops" },
];

const faqs = [
  { q: "O cliente precisa baixar algum aplicativo?", a: "Não. Ele escaneia o QR Code da sua loja com a câmera do celular, preenche o cadastro uma única vez e salva o cartão na Apple Wallet ou no Google Wallet, que já vêm no aparelho." },
  { q: "Funciona no iPhone e no Android?", a: "Sim. O mesmo cadastro gera o cartão para a Apple Wallet no iPhone e para o Google Wallet no Android." },
  { q: "Como o cliente ganha os pontos?", a: "A cada compra, ele escaneia um QR Code de pontuação, que vale uma única vez. O ponto entra na hora e o cartão do celular se atualiza sozinho." },
  { q: "Posso ter mais de uma campanha?", a: "Pode. Cada campanha tem a própria meta, recompensa, validade e QR Codes, e você escolhe qual delas usar em cada remessa." },
  { q: "Como entrego o prêmio?", a: "Quando o cliente completa a meta, o cartão avisa que o prêmio está disponível. Você entrega e confirma o resgate no painel, em um clique." },
  { q: "Como ficam os dados dos meus clientes?", a: "Você vê nome, contato e pontos no painel. O CPF é guardado de forma protegida, sem ficar exposto, e serve apenas para identificar o cliente quando ele precisa." },
];

export default function Home() {
  return (
    <main className="lp">
      <header className="lp-header">
        <div className="lp-wrap lp-header-row">
          <a href="/" className="lp-logo" aria-label="Fidelizarei"><img src="/brand/logo-dark.png" alt="Fidelizarei" /></a>
          <nav className="lp-nav" aria-label="Principal">
            <a href="#como-funciona">Como funciona</a>
            <a href="#para-sua-loja">Para sua loja</a>
            <a href="#planos">Planos</a>
            <a href="#duvidas">Dúvidas</a>
          </nav>
          <div className="lp-header-actions">
            <a className="lp-btn lp-btn-ghost" href="/login">Entrar</a>
            <a className="lp-btn lp-btn-primary" href="/signup">Cadastre-se</a>
          </div>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-wrap lp-hero-grid">
          <div className="lp-hero-copy">
            <p className="lp-pill"><Glyph theme="cafeteria" /> Para quem vive de cliente que volta</p>
            <h1>O cartão fidelidade que fica <em>no celular</em> do seu cliente.</h1>
            <p className="lp-lead">Ele escaneia o QR Code da sua loja, entra no programa em segundos e acompanha os pontos direto na Apple Wallet ou no Google Wallet. Sem aplicativo e sem cartão de papel para perder.</p>
            <div className="lp-cta-row">
              <a className="lp-btn lp-btn-primary lp-btn-lg" href="/signup">Cadastre-se <ArrowRight /></a>
              <a className="lp-btn lp-btn-outline lp-btn-lg" href="#como-funciona">Ver como funciona</a>
            </div>
            <ul className="lp-checks">
              <li><Check /> iPhone e Android</li>
              <li><Check /> Sem baixar nada</li>
              <li><Check /> Pronto em minutos</li>
            </ul>
          </div>

          <div className="lp-hero-visual" aria-hidden="true">
            <div className="lp-phone">
              <div className="lp-phone-notch" />
              <div className="lp-phone-screen">
                <p className="lp-phone-title">Carteira</p>
                <WalletCard store="Café do Centro" theme="cafeteria" goal={7} points={3} bg="#1E3A2E" accent="#F4C430" reward="Café grátis" customer="Marina S." />
                <div className="lp-phone-stack"><span /><span /></div>
              </div>
            </div>
            <div className="lp-toast">
              <span className="lp-toast-icon"><img src="/brand/crown-gold.png" alt="" /></span>
              <div><b>Café do Centro</b><span>Seu progresso agora é 4 de 7.</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-sectors" aria-label="Para quem é">
        <div className="lp-wrap">
          <p className="lp-sectors-title">Feito para quem atende o dia todo</p>
          <ul className="lp-sector-list">
            {sectors.map((s) => (
              <li key={s.theme}><Glyph theme={s.theme} /><span>{s.label}</span></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lp-section" id="como-funciona">
        <div className="lp-wrap">
          <div className="lp-section-head">
            <h2>Do balcão ao celular em três passos</h2>
            <p>Você configura uma vez. Depois, é só deixar o QR Code no balcão.</p>
          </div>

          <div className="lp-steps">
            <article className="lp-step">
              <div className="lp-step-copy">
                <span className="lp-step-num">1</span>
                <h3>Você cria a campanha</h3>
                <p>Defina a meta de pontos, a recompensa e a validade. Escolha o símbolo do seu negócio e as cores do cartão. Se quiser, cria outras campanhas depois.</p>
              </div>
              <div className="lp-step-art" aria-hidden="true">
                <div className="lp-mock-form">
                  <div><small>Nome da campanha</small><span>Cartão fidelidade do café</span></div>
                  <div className="lp-mock-two"><div><small>Pontos para ganhar</small><span>7</span></div><div><small>Recompensa</small><span>Café grátis</span></div></div>
                  <div className="lp-mock-themes">
                    {["cafeteria", "padaria", "pizzaria", "barbearia", "petshop"].map((t, i) => <span key={t} className={i === 0 ? "is-picked" : ""}><Glyph theme={t} /></span>)}
                  </div>
                  <b className="lp-mock-btn">Criar campanha</b>
                </div>
              </div>
            </article>

            <article className="lp-step is-flip">
              <div className="lp-step-copy">
                <span className="lp-step-num">2</span>
                <h3>O cliente escaneia o QR Code</h3>
                <p>Deixe o QR no balcão, na mesa ou na embalagem. Ele aponta a câmera, informa nome e CPF uma única vez e já tem o cartão pronto para salvar na Wallet.</p>
              </div>
              <div className="lp-step-art" aria-hidden="true">
                <div className="lp-mock-qr">
                  <div className="lp-qr-box">
                    <svg viewBox="0 0 11 11" shapeRendering="crispEdges"><rect width="11" height="11" fill="#fff" /><path fill="#14281F" d="M0 0h3v3H0zM8 0h3v3H8zM0 8h3v3H0zM4 0h1v1H4zM5 2h2v1H5zM4 4h2v1H4zM7 4h1v2H7zM9 5h2v1H9zM4 6h1v2H4zM6 7h2v1H6zM5 9h2v2H5zM9 8h2v1H9zM8 10h1v1H8zM3 5h1v1H3z" /></svg>
                  </div>
                  <p>Escaneie e entre no programa</p>
                </div>
              </div>
            </article>

            <article className="lp-step">
              <div className="lp-step-copy">
                <span className="lp-step-num">3</span>
                <h3>O ponto cai direto na Wallet</h3>
                <p>A cada compra, um QR Code de pontuação de uso único. O cartão do celular atualiza sozinho e avisa quando o prêmio estiver disponível.</p>
              </div>
              <div className="lp-step-art" aria-hidden="true">
                <WalletCard store="Barbearia do Davi" theme="barbearia" goal={4} points={4} bg="#1E3A2E" accent="#F4C430" reward="Corte grátis" customer="Davi S." small />
                <div className="lp-won"><Check /> Prêmio disponível</div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="lp-store" id="para-sua-loja">
        <div className="lp-wrap lp-store-grid">
          <div className="lp-store-copy">
            <h2>Você acompanha tudo em um painel simples</h2>
            <p>Veja quem está voltando, quantos pontos cada cliente tem e quais prêmios estão esperando para ser entregues.</p>
            <ul className="lp-bullets">
              <li><Check /><span><b>Clientes e pontos</b> sempre à vista, com busca por CPF.</span></li>
              <li><Check /><span><b>QR Codes em lote</b>, prontos para imprimir em PDF ou baixar em imagem.</span></li>
              <li><Check /><span><b>Cartão com a cara do seu negócio</b>: cores, símbolo, textos e contatos.</span></li>
              <li><Check /><span><b>Resgate de prêmios</b> confirmado em um clique.</span></li>
            </ul>
          </div>
          <div className="lp-dash" aria-hidden="true">
            <div className="lp-dash-side"><img src="/brand/logo-light.png" alt="" /><span className="is-on">Visão geral</span><span>Clientes</span><span>Campanhas</span><span>QR Codes</span><span>Recompensas</span></div>
            <div className="lp-dash-main">
              <b className="lp-dash-title">Seu painel</b>
              <div className="lp-dash-tiles">
                <div><small>Clientes</small><b>128</b></div>
                <div><small>Pontos hoje</small><b>42</b></div>
                <div><small>Prêmios</small><b>6</b></div>
              </div>
              <div className="lp-dash-list">
                <div><i>MS</i><span>Marina S.</span><b>+1</b></div>
                <div><i>CL</i><span>Carlos L.</span><b>+1</b></div>
                <div><i>AP</i><span>Ana P.</span><b>+1</b></div>
              </div>
              <small className="lp-dash-note">Exemplo ilustrativo</small>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section lp-themes">
        <div className="lp-wrap">
          <div className="lp-section-head">
            <h2>Um cartão com a identidade do seu negócio</h2>
            <p>Escolha o símbolo, as cores e a recompensa. O cartão se adapta ao seu jeito de atender.</p>
          </div>
          <div className="lp-cards-row">
            <WalletCard store="Padaria Pão Quente" theme="padaria" goal={6} points={4} bg="#1E3A2E" accent="#F4C430" reward="Pão de queijo" customer="Rita M." small />
            <WalletCard store="Pizzaria Forno a Lenha" theme="pizzaria" goal={8} points={5} bg="#7A2E22" accent="#FFD27A" reward="Pizza grátis" customer="Paulo R." small />
            <WalletCard store="Barbearia do Davi" theme="barbearia" goal={5} points={3} bg="#1F2A44" accent="#F4C430" reward="Corte grátis" customer="Davi S." small />
            <WalletCard store="Pet Amigo" theme="petshop" goal={6} points={2} bg="#0F5B5F" accent="#FFD27A" reward="Banho grátis" customer="Bia T." small />
          </div>
        </div>
      </section>

      <section className="lp-section lp-plans" id="planos">
        <div className="lp-wrap">
          <div className="lp-section-head">
            <h2>Planos simples, sem surpresa</h2>
            <p>Os dois planos têm tudo o que a Fidelizarei oferece. Cancele quando quiser.</p>
          </div>
          <div className="lp-plan-grid">
            <article className="lp-plan">
              <h3>Mensal</h3>
              <p className="lp-price"><span>R$</span> 79,90 <small>/mês</small></p>
              <ul>
                <li><Check /> Campanhas, QR Codes e painel</li>
                <li><Check /> Cartão na Apple Wallet e no Google Wallet</li>
                <li><Check /> Atendimento pelo WhatsApp</li>
              </ul>
              <a className="lp-btn lp-btn-outline" href="/signup">Cadastre-se</a>
            </article>
            <article className="lp-plan is-featured">
              <span className="lp-plan-tag">Melhor custo</span>
              <h3>Anual</h3>
              <p className="lp-price"><span>R$</span> 640 <small>/ano</small></p>
              <p className="lp-plan-note">Equivale a R$ 53,33 por mês. Economia de R$ 318,80 no ano.</p>
              <ul>
                <li><Check /> Tudo do plano mensal</li>
                <li><Check /> Um único pagamento por ano</li>
                <li><Check /> Atendimento pelo WhatsApp</li>
              </ul>
              <a className="lp-btn lp-btn-primary" href="/signup">Cadastre-se</a>
            </article>
          </div>
        </div>
      </section>

      <section className="lp-section lp-faq" id="duvidas">
        <div className="lp-wrap lp-faq-grid">
          <div className="lp-section-head is-left">
            <h2>Perguntas frequentes</h2>
            <p>Não achou o que procurava? Fale com a gente pelo WhatsApp ou por e-mail.</p>
            <a className="lp-link" href={WHATSAPP} target="_blank" rel="noreferrer">Falar no WhatsApp <ArrowRight /></a>
          </div>
          <div className="lp-faq-list">
            {faqs.map((item, i) => (
              <details key={item.q} open={i === 0}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-final">
        <div className="lp-wrap lp-final-row">
          <div>
            <h2>Seu cliente na Wallet, e você com uma fidelidade que funciona.</h2>
            <p>Crie a sua conta e monte a primeira campanha hoje.</p>
          </div>
          <div className="lp-cta-row">
            <a className="lp-btn lp-btn-dark lp-btn-lg" href="/signup">Cadastre-se <ArrowRight /></a>
            <a className="lp-btn lp-btn-outline-dark lp-btn-lg" href="/login">Entrar</a>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-grid">
          <div className="lp-footer-brand">
            <img src="/brand/logo-light.png" alt="Fidelizarei" />
            <p>Clientes fiéis, negócios reais. Fidelidade digital sem aplicativo.</p>
          </div>
          <div>
            <h4>Fidelizarei</h4>
            <a href="#como-funciona">Como funciona</a>
            <a href="#para-sua-loja">Para sua loja</a>
            <a href="#planos">Planos</a>
            <a href="#duvidas">Dúvidas</a>
          </div>
          <div>
            <h4>Sua conta</h4>
            <a href="/login">Entrar</a>
            <a href="/signup">Cadastre-se</a>
          </div>
          <div>
            <h4>Contato</h4>
            <a href={WHATSAPP} target="_blank" rel="noreferrer">WhatsApp</a>
            <a href={INSTAGRAM} target="_blank" rel="noreferrer">@fidelizarei</a>
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
          </div>
        </div>
        <div className="lp-wrap lp-footer-bottom">© 2026 Fidelizarei. Todos os direitos reservados.</div>
      </footer>
    </main>
  );
}
