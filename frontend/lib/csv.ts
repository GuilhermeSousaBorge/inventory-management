const CSV_BOM = "﻿"
const CSV_SEP = ";"

function escapeCell(value: string | number): string {
    const s = typeof value === "number" ? value.toLocaleString("pt-BR") : value
    if (s.includes(CSV_SEP) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
        return `"${s.replace(/"/g, '""')}"`
    }
    return s
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
    const lines = [headers.map(escapeCell).join(CSV_SEP)]
    for (const row of rows) {
        lines.push(row.map(escapeCell).join(CSV_SEP))
    }
    return CSV_BOM + lines.join("\r\n")
}

export function downloadCsv(filename: string, csv: string): void {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}
