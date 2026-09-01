import { parse } from "csv-parse/sync";
import { readFile } from "node:fs/promises";

export async function readCsv(path: string): Promise<string[][]> {
  const input = await readFile(path, "utf8");
  return parse(input, { bom: true, relax_column_count: true, skip_empty_lines: false });
}

export function rowsToObjects(headers: string[], rows: string[][]) {
  return rows.map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}
