export function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(value);
}

export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: decimals
  }).format(value);
}

export function formatTable(headers: string[], rows: (string | number)[][]): string {
  const columnWidths = headers.map((_, colIndex) => {
    const maxInRows = Math.max(...rows.map(row => String(row[colIndex]).length));
    return Math.max(headers[colIndex].length, maxInRows);
  });

  const headerRow = headers.map((h, i) => h.padEnd(columnWidths[i])).join(' | ');
  const separator = columnWidths.map(w => '-'.repeat(w)).join('-+-');
  const dataRows = rows.map(row =>
    row.map((cell, i) => String(cell).padEnd(columnWidths[i])).join(' | ')
  );

  return [headerRow, separator, ...dataRows].join('\n');
}
