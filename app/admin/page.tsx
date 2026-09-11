import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { getCurrentUser, isPlatformAdmin } from "@/lib/auth";
import { getPlatformAdminData, type PlatformAdminData, type PlatformCompany } from "@/lib/platform-admin-data";
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

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

function BarChart({ title, description, values, valueLabel }: {
  title: string;
  description: string;
  values: Array<{ label: string; value: number; helper?: string }>;
  valueLabel: (value: number) => string;
}) {
  const max = Math.max(...values.map((item) => item.value), 1);
  return (
    <article className="admin-chart-card">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="admin-bars" style={{ "--bar-count": values.length } as CSSProperties}>
        {values.map((item) => (
          <div key={item.label} className="admin-bar-item">
            <span style={{ height: `${Math.max(8, (item.value / max) * 100)}%` }} title={valueLabel(item.value)} />
            <b>{valueLabel(item.value)}</b>
            <small>{item.label}</small>
            {item.helper && <em>{item.helper}</em>}
          </div>
        ))}
      </div>
    </article>
  );
}

function StatusChart({ data }: { data: PlatformAdminData }) {
  const total = Math.max(data.totals.companies, 1);
  return (
    <article className="admin-chart-card admin-status-chart">
      <div>
        <h2>Status das empresas</h2>
        <p>Distribuição atual de pagamento/acesso.</p>
      </div>
      <div className="status-rings">
        {data.charts.statusDistribution.map((item) => (
          <div key={item.status} className={`status-ring ${item.status}`} style={{ "--percent": `${(item.value / total) * 100}%` } as CSSProperties}>
            <b>{item.value}</b>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function CompanyRow({ company }: { company: PlatformCompany }) {
  return (
    <tr>
      <td data-label="Empresa">
        <strong>{company.name}</strong>
        <small>{company.ownerName || "Responsável não informado"} · {company.ownerEmail || "email não informado"}</small>
      </td>
      <td data-label="CPF/CNPJ">{formatTaxId(company.taxId)}</td>
      <td data-label="Status">
        <span className={statusClass(company.billingStatus)}>{statusLabel(company.billingStatus)}</span>
      </td>
      <td data-label="Plano">{planLabel(company.billingInterval)}</td>
      <td data-label="Cadastro">{formatDate(company.createdAt)}</td>
      <td data-label="Validade">{formatDate(company.currentPeriodEnd || company.trialEndsAt)}</td>
      <td data-label="Uso">
        <strong>{company.customersCount.toLocaleString("pt-BR")}</strong>
        <small>{company.redeemedCodesCount.toLocaleString("pt-BR")} QR usados · {company.activeCodesCount.toLocaleString("pt-BR")} ativos</small>
      </td>
      <td data-label="Asaas">
        <span className="admin-id">{shortId(company.paymentProviderId)}</span>
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
        <article><span>MRR estimado</span><b>{formatMoney(data.totals.estimatedMrr)}</b><small>Receita mensal recorrente</small></article>
        <article><span>Lucro estimado</span><b>{formatMoney(data.totals.estimatedMonthlyProfit)}</b><small>{data.totals.monthlyCosts ? `Custos: ${formatMoney(data.totals.monthlyCosts)}` : "Sem custos cadastrados"}</small></article>
      </section>

      <section className="admin-charts">
        <BarChart
          title="Receita mensal"
          description="Estimativa com empresas ativas: mensal cheio + anual diluído por 12."
          values={data.charts.revenueByMonth.map((item) => ({ label: item.label, value: item.revenue, helper: `${item.activeCompanies} ativas` }))}
          valueLabel={formatMoney}
        />
        <BarChart
          title="Novas empresas"
          description="Cadastros recebidos nos últimos 6 meses."
          values={data.charts.companiesByMonth.map((item) => ({ label: item.label, value: item.companies }))}
          valueLabel={(value) => value.toLocaleString("pt-BR")}
        />
        <StatusChart data={data} />
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
                <th>Asaas</th>
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
