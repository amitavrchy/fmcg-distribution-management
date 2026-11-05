export function exportCsv(
  name: string,
  rows: Record<string, string | number>[],
) {
  if (!rows.length) return;
  const escape = (value: string | number) => {
    let text = String(value);
    if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const csv =
    "\uFEFF" +
    [Object.keys(rows[0]), ...rows.map(Object.values)]
      .map((row) => row.map(escape).join(","))
      .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
