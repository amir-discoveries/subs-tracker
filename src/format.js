export function formatCurrency(value) {
  return value.toFixed(2);
}

export function formatTable(rows, headers) {
  const all = [headers, ...rows];
  const widths = headers.map((_, i) =>
    Math.max(...all.map((row) => String(row[i]).length))
  );
  return all
    .map((row) =>
      row
        .map((cell, i) => String(cell).padEnd(widths[i] + 2))
        .join('')
        .trimEnd()
    )
    .join('\n');
}

const CSV_NEEDS_QUOTE = /[",\n\r]/;

export function csvEscape(value) {
  const str = String(value);
  if (CSV_NEEDS_QUOTE.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(rows, headers) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','));
  }
  return lines.join('\n') + '\n';
}
