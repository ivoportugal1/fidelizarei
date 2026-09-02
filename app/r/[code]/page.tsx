"use client";

import { use, useState } from "react";

export default function RedeemPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [status, setStatus] = useState<"ready" | "success" | "used">("ready");
  return <main className="redeem-page"><section className="redeem-card"><div className="redeem-brand"><span>B</span> BOILER CAFÉ</div>{status === "ready" && <><div className="redeem-illustration">☕</div><p className="eyebrow">SEU PEDIDO VALE 1 PONTO</p><h1>Um café mais perto<br />do próximo por conta da casa.</h1><p className="redeem-text">Você está prestes a registrar este pedido no seu cartão Fideliza.</p><button className="button button-coral redeem-button" onClick={() => setStatus("success")}>Adicionar 1 ponto →</button><small>Código: {code}</small></>}{status === "success" && <><div className="success-icon">✓</div><p className="eyebrow">PONTO ADICIONADO</p><h1>Boa! Agora você<br />tem 6 de 7 cafés.</h1><p className="redeem-text">Seu cartão na Wallet será atualizado em alguns instantes.</p><div className="progress"><span style={{ width: "85%" }}></span></div><div className="coffee-row">☕ ☕ ☕ ☕ ☕ ☕ <i>☕</i></div><button className="button button-dark redeem-button" onClick={() => setStatus("used")}>Ver meu cartão</button></>}{status === "used" && <><div className="success-icon">✓</div><p className="eyebrow">CÓDIGO JÁ UTILIZADO</p><h1>Este ponto já foi<br />registrado.</h1><p className="redeem-text">Cada QR Code é único e vale apenas um ponto. Obrigado por fazer parte do Boiler.</p></>}</section><p className="redeem-footer">fideliza<span>.</span> — fidelidade sem aplicativo</p></main>;
}
