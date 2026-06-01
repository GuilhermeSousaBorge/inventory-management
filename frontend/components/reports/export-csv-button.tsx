"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "@/lib/csv";

type Props = {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
};

export function ExportCsvButton({ filename, headers, rows }: Props) {
  const disabled = rows.length === 0;

  function onClick() {
    const csv = toCsv(headers, rows);
    downloadCsv(filename, csv);
  }

  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={disabled}>
      <Download className="mr-2 h-4 w-4" />
      Exportar CSV
    </Button>
  );
}
