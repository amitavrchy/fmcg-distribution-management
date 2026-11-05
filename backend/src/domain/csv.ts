export function parseCsv(input: string, maxRows = 500) {
  const text = input.replace(/^\uFEFF/, "");
  if (text.length > 250000) throw new Error("CSV is limited to 250 KB");
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else value += c;
      continue;
    }
    if (c === '"') {
      if (value || closed) throw new Error("Invalid CSV quote");
      quoted = true;
    } else if (c === ",") {
      row.push(value.trim());
      value = "";
      closed = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
      closed = false;
      if (rows.length > maxRows + 1) throw new Error("Too many CSV rows");
    } else if (closed && c.trim())
      throw new Error("Text after closed CSV quote");
    else value += c;
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length > maxRows + 1) throw new Error("Too many CSV rows");
  if (rows.length < 2) throw new Error("CSV needs headers and data");
  return rows;
}
