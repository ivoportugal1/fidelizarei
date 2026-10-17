"use client";

import { use, useEffect, useState } from "react";
import "../balcao.css";

type CounterView =
  | { state: "loading" }
  | { state: "not_found" }
  | { state: "idle"; storeName: string }
  | { state: "used"; storeName: string }
  | { state: "qr"; storeName: string; qr: string; expiresAt: string };

const POLL_MS = 2000;
const QR_WINDOW_SECONDS = 180;

function secondsLeft(expiresAt: string) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function Crown() {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true">
      <path d="M6 40 2 12l16 14L32 4l14 22L62 12l-4 28z" fill="#f1b900" />
      <rect x="6" y="42" width="52" height="5" rx="2.5" fill="#103b24" />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="m10 25 9 9 19-21" fill="none" stroke="#f1b900" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function CounterPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [view, setView] = useState<CounterView>({ state: "loading" });
  const [, tick] = useState(0);

  useEffect(() => {
    let stopped = false;
    async function load() {
      try {
        const response = await fetch(`/api/balcao/${encodeURIComponent(token)}`, { cache: "no-store" });
        const body = await response.json();
        if (stopped) return;
        if (response.status === 404) setView({ state: "not_found" });
        else if (body.ok) setView(body);
      } catch {
        // Keep showing the last screen; the next poll retries.
      }
    }
    load();
    const poll = setInterval(load, POLL_MS);
    const clock = setInterval(() => tick((value) => value + 1), 1000);
    return () => { stopped = true; clearInterval(poll); clearInterval(clock); };
  }, [token]);

  if (view.state === "loading") return <main className="counter" aria-busy="true" />;

  const storeName = "storeName" in view ? view.storeName : "";
  const left = view.state === "qr" ? secondsLeft(view.expiresAt) : 0;
  const showQr = view.state === "qr" && left > 0;

  return (
    <main className="counter">
      <section className="counter-side">
        <div className="counter-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-light.png" alt="Fidelizarei" />
        </div>
        <div>
          {storeName && <p className="counter-store">{storeName}</p>}
          <h1 className="counter-headline">Pague e ganhe<br />pontos.</h1>
        </div>
        <ol className="counter-steps">
          <li><b>1</b>Pague sua compra normalmente</li>
          <li><b>2</b>Escaneie o QR code com o celular</li>
          <li><b>3</b>Seu ponto cai no cartão da Wallet</li>
        </ol>
        <p className="counter-foot">Fidelidade sem aplicativo</p>
      </section>

      <section className="counter-stage" aria-live="polite">
        {view.state === "not_found" && (
          <>
            <h2 className="counter-title">Tela indisponível</h2>
            <p className="counter-sub">Confira o endereço ou se a integração está ativa.</p>
          </>
        )}
        {showQr && view.state === "qr" && (
          <>
            <h2 className="counter-title">Escaneie e ganhe 1 ponto</h2>
            <div className="qr-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={view.qr} alt="QR code para registrar seu ponto" />
            </div>
            <div className="qr-timer">
              <div className="qr-timer-label">Válido por {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</div>
              <div className="qr-timer-track"><div className="qr-timer-bar" style={{ width: `${Math.min(100, (left / QR_WINDOW_SECONDS) * 100)}%` }} /></div>
            </div>
          </>
        )}
        {view.state === "used" && (
          <>
            <div className="done-badge"><Check /></div>
            <h2 className="counter-title">Ponto registrado!</h2>
            <p className="counter-sub">Obrigado pela preferência. Volte sempre.</p>
          </>
        )}
        {(view.state === "idle" || (view.state === "qr" && !showQr)) && (
          <>
            <div className="idle-ring"><Crown /></div>
            <h2 className="counter-title">Aguardando o pagamento</h2>
            <p className="counter-sub">Assim que a compra for confirmada, seu QR code aparece aqui.</p>
          </>
        )}
      </section>
    </main>
  );
}
