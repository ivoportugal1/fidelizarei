import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { query } from "./database";
import { hashCode } from "./redemption";

export const MIN_POINT_QR_BATCH = 1;
export const MAX_POINT_QR_BATCH = 500;

export type QrCodeItem = {
  id: string;
  code: string;
  url: string;
  status: "active" | "redeemed" | "voided" | "expired";
  createdAt: string;
  redeemedAt: string | null;
};

export type QrBatchSummary = {
  id: string;
  quantity: number;
  active: number;
  redeemed: number;
  createdAt: string;
};

type UserProgramContext = {
  organization_id: string;
  program_id: string;
  points_per_code: number;
};

type BatchRow = {
  id: string;
  quantity: number;
  active: string;
  redeemed: string;
  created_at: Date;
};

type CodeRow = {
  id: string;
  code_value: string;
  status: "active" | "redeemed" | "voided" | "expired";
  created_at: Date;
  redeemed_at: Date | null;
};

export function normalizeBatchQuantity(value: unknown) {
  const quantity = Number(value);
  if (!Number.isInteger(quantity)) throw new Error("invalid_quantity");
  if (quantity < MIN_POINT_QR_BATCH || quantity > MAX_POINT_QR_BATCH) throw new Error("invalid_quantity");
  return quantity;
}

export function makePointCode() {
  const raw = randomBytes(8).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  return `FID-${raw.slice(0, 5)}-${raw.slice(5)}`;
}

export function publicCodeUrl(origin: string, code: string) {
  return `${origin}/r/${code}`;
}

export async function getUserProgramContext(userId: string) {
  const context = await query<UserProgramContext>(`
    select o.id as organization_id, p.id as program_id, p.points_per_code
    from organization_members m
    join organizations o on o.id = m.organization_id
    join loyalty_programs p on p.organization_id = o.id
    where m.user_id = $1 and p.active = true
    order by o.created_at asc, p.created_at asc
    limit 1`, [userId]);
  return context.rows[0] ?? null;
}

export async function listQrBatches(organizationId: string, programId: string, limit = 6): Promise<QrBatchSummary[]> {
  const result = await query<BatchRow>(`
    select b.id, b.quantity, b.created_at,
      count(c.id) filter (where c.status = 'active') as active,
      count(c.id) filter (where c.status = 'redeemed') as redeemed
    from qr_code_batches b
    left join redemption_codes c on c.batch_id = b.id
    where b.organization_id = $1 and b.program_id = $2
    group by b.id
    order by b.created_at desc
    limit $3`, [organizationId, programId, limit]);

  return result.rows.map((row) => ({
    id: row.id,
    quantity: Number(row.quantity),
    active: Number(row.active),
    redeemed: Number(row.redeemed),
    createdAt: row.created_at.toISOString(),
  }));
}

export async function getQrBatchCodes(userId: string, batchId: string, origin: string): Promise<QrCodeItem[] | null> {
  const context = await getUserProgramContext(userId);
  if (!context) return null;

  const batch = await query<{ id: string }>(`
    select id from qr_code_batches
    where id = $1 and organization_id = $2 and program_id = $3
    limit 1`, [batchId, context.organization_id, context.program_id]);
  if (!batch.rows[0]) return null;

  const result = await query<CodeRow>(`
    select id, code_value, status, created_at, redeemed_at
    from redemption_codes
    where batch_id = $1 and code_value is not null
    order by created_at asc`, [batchId]);

  return result.rows.map((row) => ({
    id: row.id,
    code: row.code_value,
    url: publicCodeUrl(origin, row.code_value),
    status: row.status,
    createdAt: row.created_at.toISOString(),
    redeemedAt: row.redeemed_at?.toISOString() ?? null,
  }));
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function qrMatrix(value: string) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" }) as unknown as {
    modules: { size: number; data: Uint8Array | boolean[]; get?: (x: number, y: number) => boolean };
  };
  const size = qr.modules.size;
  const get = (x: number, y: number) => {
    if (typeof qr.modules.get === "function") return qr.modules.get(x, y);
    return Boolean(qr.modules.data[y * size + x]);
  };
  return { size, get };
}

export function buildQrPdf(codes: QrCodeItem[]) {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 36;
  const columns = 4;
  const rows = 6;
  const cellWidth = (pageWidth - margin * 2) / columns;
  const cellHeight = (pageHeight - margin * 2) / rows;
  const qrSize = 86;
  const objects: string[] = [];
  const pages: number[] = [];

  for (let pageStart = 0; pageStart < codes.length; pageStart += columns * rows) {
    const pageCodes = codes.slice(pageStart, pageStart + columns * rows);
    const commands: string[] = ["q", "1 1 1 rg", `0 0 ${pageWidth} ${pageHeight} re f`, "Q"];

    pageCodes.forEach((item, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = margin + col * cellWidth + (cellWidth - qrSize) / 2;
      const y = pageHeight - margin - (row + 1) * cellHeight + 24;
      const matrix = qrMatrix(item.url);
      const quiet = 2;
      const modules = matrix.size + quiet * 2;
      const moduleSize = qrSize / modules;

      commands.push("q", "1 1 1 rg", `${x.toFixed(2)} ${y.toFixed(2)} ${qrSize} ${qrSize} re f`, "0 0 0 rg");
      for (let my = 0; my < matrix.size; my += 1) {
        for (let mx = 0; mx < matrix.size; mx += 1) {
          if (!matrix.get(mx, my)) continue;
          const rx = x + (mx + quiet) * moduleSize;
          const ry = y + qrSize - (my + quiet + 1) * moduleSize;
          commands.push(`${rx.toFixed(2)} ${ry.toFixed(2)} ${moduleSize.toFixed(2)} ${moduleSize.toFixed(2)} re f`);
        }
      }
      commands.push("Q", "0.82 0.78 0.68 RG", `${(margin + col * cellWidth).toFixed(2)} ${(pageHeight - margin - (row + 1) * cellHeight).toFixed(2)} ${cellWidth.toFixed(2)} ${cellHeight.toFixed(2)} re S`);
      commands.push("BT", "/F1 8 Tf", "0.09 0.13 0.12 rg", `${(x + 20).toFixed(2)} ${(y - 13).toFixed(2)} Td`, `(#${String(pageStart + index + 1).padStart(3, "0")} - ${pdfEscape(item.status === "redeemed" ? "UTILIZADO" : "DISPONIVEL")}) Tj`, "ET");
    });

    const stream = commands.join("\n");
    const contentId = objects.push(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);
    const pageId = objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    pages.push(pageId);
  }

  objects.unshift(
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Kids [${pages.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
  );

  const offsets: number[] = [0];
  let body = "%PDF-1.4\n";
  objects.forEach((object, index) => {
    offsets[index + 1] = Buffer.byteLength(body, "utf8");
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(body, "utf8");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body, "utf8");
}

const crcTable = new Uint32Array(256).map((_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

export async function buildQrZip(codes: QrCodeItem[]) {
  const files = await Promise.all(codes.map(async (item, index) => ({
    name: `qr-${String(index + 1).padStart(3, "0")}.png`,
    data: await QRCode.toBuffer(item.url, { width: 900, margin: 2, color: { dark: "#17211f", light: "#ffffff" } }),
  })));
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const { time, day } = dosDateTime();

  for (const file of files) {
    const name = Buffer.from(file.name);
    const crc = crc32(file.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, file.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(file.data.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + file.data.length;
  }

  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, central, end]);
}

export async function buildPrintHtml(codes: QrCodeItem[]) {
  const svgs = await Promise.all(codes.map((item) => QRCode.toString(item.url, { type: "svg", width: 240, margin: 2, color: { dark: "#17211f", light: "#ffffff" } })));
  const items = codes.map((item, index) => `<article>${svgs[index]}<strong>#${String(index + 1).padStart(3, "0")}</strong><span>${item.status === "redeemed" ? "UTILIZADO" : "DISPONÍVEL"}</span></article>`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><title>QR Codes de pontuação</title><style>
    @page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;color:#17211f}.print-head{margin-bottom:10mm}h1{font-size:18pt;margin:0 0 4mm}.muted{color:#66716d;font-size:9pt}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7mm 5mm}article{break-inside:avoid;text-align:center;border:1px dashed #d6cfbd;padding:4mm 2mm}svg{width:32mm;height:32mm}strong,span{display:block;font-size:8pt}@media screen{body{padding:24px;background:#f8f3e8}.sheet{background:white;max-width:210mm;margin:auto;padding:12mm;box-shadow:0 20px 60px #0002}.actions{position:sticky;top:0;margin-bottom:16px}.actions button{height:42px;border:0;border-radius:8px;background:#173d20;color:white;font-weight:700;padding:0 16px}}@media print{.actions{display:none}.sheet{padding:0}}
  </style></head><body><div class="actions"><button onclick="window.print()">Imprimir</button></div><main class="sheet"><header class="print-head"><h1>QR Codes de pontuação</h1><div class="muted">Cada QR representa uma compra válida e só pode ser usado uma vez.</div></header><section class="grid">${items}</section></main><script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`;
}
