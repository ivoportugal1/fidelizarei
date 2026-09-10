import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { transaction } from "@/lib/database";

export const runtime = "nodejs";

type CustomerRow = {
  organization_id: string;
  program_id: string;
};

export async function DELETE(_: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { customerId } = await params;

  try {
    await transaction(async (client) => {
      const customer = await client.query<CustomerRow>(`
        select c.organization_id, p.id as program_id
        from customers c
        join organization_members m on m.organization_id = c.organization_id and m.user_id = $2
        join loyalty_programs p on p.organization_id = c.organization_id and p.active = true
        where c.id = $1
        for update of c`, [customerId, user.id]);
      const row = customer.rows[0];
      if (!row) throw new Error("customer_not_found");

      await client.query(`
        update customers
        set status = 'inactive', deactivated_at = now()
        where id = $1 and organization_id = $2`, [customerId, row.organization_id]);

      await client.query(`
        update wallet_passes
        set status = 'voided', updated_at = now()
        where customer_id = $1 and program_id = $2 and status = 'active'`, [customerId, row.program_id]);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unable_to_remove_customer";
    return NextResponse.json({ ok: false, error: message }, { status: message === "customer_not_found" ? 404 : 500 });
  }
}
