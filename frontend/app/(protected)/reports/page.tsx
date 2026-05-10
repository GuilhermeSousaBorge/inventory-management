import { DollarSign, Package, Trash2, TrendingDown } from "lucide-react"
import Link from "next/link"

const CARDS = [
    {
        href: "/reports/consumption",
        icon: TrendingDown,
        title: "Consumo",
        description: "Total de saídas por ingrediente no período.",
    },
    {
        href: "/reports/sales",
        icon: DollarSign,
        title: "Vendas",
        description: "Pedidos concluídos por produto e receita gerada.",
    },
    {
        href: "/reports/waste",
        icon: Trash2,
        title: "Desperdício",
        description: "Ajustes negativos (perdas, quebras) por ingrediente.",
    },
    {
        href: "/reports/stock-status",
        icon: Package,
        title: "Status de estoque",
        description: "Visão atual de saldos vs. mínimos por unidade.",
    },
]

export default function ReportsHubPage() {
    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold text-text-primary">Relatórios</h1>
                <p className="mt-1 text-sm text-text-secondary">
                    Indicadores operacionais para a gestão diária.
                </p>
            </header>

            <div className="grid gap-4 md:grid-cols-2">
                {CARDS.map(({ href, icon: Icon, title, description }) => (
                    <Link key={href} href={href} className="flex items-start gap-3 rounded-xl border border-border/40 bg-white p-5 transition hover:border-primary/50 hover:bg-primary/5" >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-base font-semibold text-text-primary">
                                {title}
                            </p>
                            <p className="mt-1 text-sm text-text-secondary">
                                {description}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    )
}