# Fideliza

MVP de fidelidade por QR Code: a empresa cria uma campanha e QR Codes únicos; o cliente aponta a câmera, ganha o ponto e acompanha o saldo em Apple Wallet ou Google Wallet — sem instalar aplicativo.

## O que já foi construído

- Página inicial e painel da empresa, responsivos e navegáveis.
- Visualização de clientes, pontos, recompensas, métricas, QR Codes e personalização do cartão.
- Página pública de resgate: `r/{codigo}`.
- Modelo multiempresa no Supabase, com isolamento por organização (RLS).
- QR de uso único com token armazenado somente como hash SHA-256.
- Procedimento atômico: uma única operação marca o QR como usado, registra o histórico, atualiza o saldo, libera recompensa e enfileira a atualização do passe.
- Rotas de API para consultar, identificar o cliente no primeiro uso e resgatar um código.

## Rodar localmente

```bash
copy .env.example .env.local
npm install
npm run dev
```

Abra `http://localhost:3000/dashboard`.

## Configurar o banco

1. Crie um projeto no Supabase.
2. Rode o conteúdo de `supabase/migrations/202609010001_initial_schema.sql` no SQL Editor.
3. Preencha em `.env.local` a URL, a chave pública, a `SUPABASE_SERVICE_ROLE_KEY` e um `CUSTOMER_SESSION_SECRET` longo e aleatório.

O segredo `SUPABASE_SERVICE_ROLE_KEY` fica apenas no servidor: ele nunca deve ser exposto no navegador ou enviado ao Git.

## Fluxo real do cliente

1. A empresa imprime um URL com código aleatório único, por exemplo `https://dominio.com/r/8K2Q...`.
2. No primeiro QR, o cliente informa e confirma o telefone (a confirmação por SMS/WhatsApp ainda é a próxima integração necessária). O navegador recebe uma sessão segura de seis meses.
3. Nos próximos QRs, a sessão identifica o cliente, o banco concede o ponto uma única vez e uma tarefa é criada para atualizar seu passe.
4. Ao alcançar a regra da campanha, o banco converte pontos em recompensa disponível.

Para delivery, associe o QR ao cliente do pedido ao gerá-lo. Isso evita que outra pessoa use a embalagem. Para loja física, o fluxo de sessão do cliente evita a necessidade de um aplicativo, mas a confirmação de telefone é indispensável para reduzir fraude.

## O que falta para produção

- Login real para a empresa com Supabase Auth e permissões de `owner`, `manager` e `staff`.
- Geração e exportação de lotes de QR Codes pelo painel.
- Confirmação de telefone via SMS ou WhatsApp antes do primeiro resgate.
- Worker/cron que consome `wallet_update_jobs` e assina/envia o passe Apple ou atualiza o objeto Google Wallet.
- Certificados Apple Developer e conta de serviço Google Wallet, cujas variáveis já estão previstas em `.env.example`.
- Auditoria, limites antifraude, LGPD, domínio próprio e hospedagem.

Não há nenhuma dependência da Fidel API: QR único e nosso banco são o mecanismo de fidelidade; Apple/Google Wallet são a interface visível ao cliente.
