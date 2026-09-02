import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "./supabase/server";

export const normalizeCode = (code: string) => code.trim().toUpperCase();
export const hashCode = (code: string) => createHash("sha256").update(normalizeCode(code)).digest("hex");

export async function redeemCode(code: string, customerId: string) {
  const client = getSupabaseAdmin();
  const { data, error } = await client.rpc("redeem_loyalty_code", { p_code: normalizeCode(code), p_customer_id: customerId });
  if (error) throw error;
  return data?.[0] as { points: number; rewards_available: number; points_to_reward: number } | undefined;
}

export async function getCodeForEnrollment(code: string) {
  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from("redemption_codes")
    .select("id, organization_id, program_id, status, expires_at, loyalty_programs(name, organizations(name))")
    .eq("code_hash", hashCode(code))
    .maybeSingle();
  if (error) throw error;
  return data;
}
