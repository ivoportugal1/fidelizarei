import { redirect } from "next/navigation";
import { getCurrentUser, isPlatformAdmin } from "@/lib/auth";
import { getPlatformAdminData, type PlatformCompany } from "@/lib/platform-admin-data";
import { AdminLogoutButton } from "./logout-button";

const planLabel = (interval: "monthly" | "yearly") => interval === "yearly" ? "Anual" : "Mensal";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatTaxId(value: string | null) {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (digits.length === 14) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return value;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "Ativo",
    pending: "Pendente",
    trialing: "Teste",
    past_due: "Atrasado",
    canceled: "Cancelado",
    expired: "Expirado",
  };
  return labels[status] || status;
}

function statusClass(status: string) {
  if (status === "active") return "admin-status active";
  if (status === "trialing") return "admin-status trialing";
  if (status === "pending") return "admin-status pending";
  return "admin-status blocked";
}

function shortId(value: string | null) {
  if (!value) return "—";
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function CompanyRow({ company }: { company: PlatformCompany }) {
  return (
    <tr>
      <td>
        <strong>{company.name}</strong>
        <small>{company.ownerName || "Responsável não informado"} · {company.ownerEmail || "email não informado"}</small>
      </td>
      <td>{formatTaxId(company.taxId)}</td>
      <td>
        <span className={statusClass(company.billingStatus)}>{statusLabel(company.billingStatus)}</span>
      </td>
      <td>{planLabel(company.billingInterval)}</td>
      <td>{formatDate(company.createdAt)}</td>
      <td>{formatDate(company.currentPeriodEnd || company.trialEndsAt)}</td>
      <td>
        <strong>{company.customersCount.toLocaleString("pt-BR")}</strong>
        <small>{company.redeemedCodesCount.toLocaleString("pt-BR")} QR usados · {company.activeCodesCount.toLocaleString("pt-BR")} ativos</small>
      </td>
      <td>
        <span className="admin-id">{shortId(company.mercadoPagoPreapprovalId)}</span>
        <small>{company.lastPaymentId ? `Pgto ${shortId(company.lastPaymentId)}` : "Sem pagamento confirmado"}</small>
      </td>
    </tr>
  );
}

export default async function PlatformAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isPlatformAdmin(user.email)) redirect("/dashboard");

  const data = await getPlatformAdminData();

  return (
    <main className="platform-admin">
      <header className="platform-admin-hero">
        <a className="brand" href="/">fideliza<span>.</span></a>
        <div>
          <p className="eyebrow">ADMIN FIDELIZAREI</p>
          <h1>Empresas e assinaturas</h1>
          <span>Visão somente leitura das empresas cadastradas, planos e status de pagamento.</span>
        </div>
        <AdminLogoutButton />
      </header>

      <section className="admin-metrics">
        <article><span>Empresas</span><b>{data.totals.companies}</b><small>Total cadastrado</small></article>
        <article><span>Pagando</span><b>{data.totals.active}</b><small>Status ativo</small></article>
        <article><span>Pendentes</span><b>{data.totals.pending}</b><small>Aguardando pagamento</small></article>
        <article><span>Teste</span><b>{data.totals.trialing}</b><small>Cupom/período grátis</small></article>
        <article><span>Planos</span><b>{data.totals.monthly}/{data.totals.yearly}</b><small>Mensal / anual</small></article>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <div>
            <h2>Empresas cadastradas</h2>
            <p>Dados lidos do banco. Nenhuma alteração operacional é feita por esta tela.</p>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>CPF/CNPJ</th>
                <th>Status</th>
                <th>Plano</th>
                <th>Cadastro</th>
                <th>Validade</th>
                <th>Uso</th>
                <th>Mercado Pago</th>
              </tr>
            </thead>
            <tbody>
              {data.companies.length ? data.companies.map((company) => <CompanyRow key={company.id} company={company} />) : (
                <tr><td colSpan={8}>Nenhuma empresa cadastrada ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
