import { NextResponse } from "next/server";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { query, transaction } from "@/lib/database";
import { ensureOrganizationSchema } from "@/lib/organization-schema";

export const runtime = "nodejs";

function normalizeEmail(value?: string) {
  return String(value || "").trim().toLowerCase();
}

function cleanText(value: unknown, limit: number) {
  return String(value || "").trim().slice(0, limit);
}

function cleanPhone(value: unknown) {
  return String(value || "").trim().slice(0, 30);
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as {
    businessName?: string;
    ownerName?: string;
    email?: string;
    phone?: string;
    salespersonName?: string;
    password?: string;
  };

  const businessName = cleanText(body.businessName, 120);
  const ownerName = cleanText(body.ownerName, 120);
  const email = normalizeEmail(body.email);
  const phone = cleanPhone(body.phone);
  const salespersonName = cleanText(body.salespersonName, 120);
  const password = String(body.password || "");

  if (!businessName || !ownerName || !email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "invalid_profile" }, { status: 400 });
  }
  if (password && password.length < 8) {
    return NextResponse.json({ ok: false, error: "weak_password" }, { status: 400 });
  }

  await ensureOrganizationSchema();

  try {
    const result = await transaction(async (client) => {
      const membership = await client.query<{ organization_id: string }>(`
        select organization_id
        from organization_members
        where user_id = $1
        order by case when role = 'owner' then 0 else 1 end
        limit 1
        for update`, [user.id]);
      const organizationId = membership.rows[0]?.organization_id;
      if (!organizationId) throw new Error("organization_not_found");

      const existingEmail = await client.query<{ id: string }>(
        "select id from app_users where email = $1 and id <> $2 limit 1",
        [email, user.id],
      );
      if (existingEmail.rows[0]) throw new Error("email_already_exists");

      await client.query(`
        update organizations
        set name = $2,
            contact_phone = nullif($3, ''),
            salesperson_name = nullif($4, '')
        where id = $1`, [organizationId, businessName, phone, salespersonName]);

      if (password) {
        await client.query(`
          update app_users
          set full_name = $2,
              email = $3,
              password_hash = $4
          where id = $1`, [user.id, ownerName, email, hashPassword(password)]);
      } else {
        await client.query(`
          update app_users
          set full_name = $2,
              email = $3
          where id = $1`, [user.id, ownerName, email]);
      }

      return {
        user: { name: ownerName, email },
        organization: { name: businessName, phone, salespersonName },
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "profile_update_failed";
    return NextResponse.json(
      { ok: false, error: message },
      { status: message === "email_already_exists" ? 409 : message === "organization_not_found" ? 404 : 500 },
    );
  }
}
