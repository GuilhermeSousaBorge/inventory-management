"use client"

import {
    ArrowLeftRight,
    BarChart3,
    Bell,
    Boxes,
    FileText,
    Flame,
    LayoutGrid,
    Leaf,
    type LucideIcon,
    Package,
    PanelLeft,
    Ruler,
    Search,
    ShoppingBag,
    ShoppingCart,
    Tag,
    Truck,
    Users,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

type NavItem = {
    label: string
    href: string
    icon: LucideIcon
}

type NavSection = {
    title: string
    items: NavItem[]
}

const SECTIONS: NavSection[] = [
    {
        title: "Visão geral",
        items: [{ label: "Dashboard", href: "/home", icon: LayoutGrid }],
    },
    {
        title: "Vendas",
        items: [
            { label: "Pedidos", href: "/pedidos", icon: ShoppingBag },
            { label: "Notificações", href: "/notificacoes", icon: Bell },
        ],
    },
    {
        title: "Catálogo",
        items: [
            { label: "Produtos", href: "/produtos", icon: Package },
            { label: "Categorias", href: "/categorias", icon: Tag },
            { label: "Ingredientes", href: "/ingredientes", icon: Leaf },
            { label: "Unidades", href: "/unidades", icon: Ruler },
        ],
    },
    {
        title: "Suprimentos",
        items: [
            { label: "Compras", href: "/compras", icon: ShoppingCart },
            { label: "Fornecedores", href: "/fornecedores", icon: Truck },
            { label: "Estoque", href: "/estoque", icon: Boxes },
            { label: "Movimentações", href: "/movimentacoes", icon: ArrowLeftRight },
        ],
    },
    {
        title: "Análise",
        items: [
            { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
            { label: "Auditoria", href: "/auditoria", icon: FileText },
        ],
    },
    {
        title: "Administração",
        items: [{ label: "Usuários", href: "/usuarios", icon: Users }],
    },
]

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [collapsed, setCollapsed] = useState(false)
    const pathname = usePathname()

    return (
        <div className="flex flex-1 min-h-0">
            {!collapsed && (
                <aside className="flex w-64 shrink-0 flex-col border-r border-border/40 bg-bg">
                    <div className="flex items-center gap-3 px-5 py-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-danger text-white">
                            <Flame className="h-5 w-5" />
                        </div>
                        <div className="leading-tight">
                            <p className="text-sm font-semibold text-text-primary">
                                Forno Vivo
                            </p>
                            <p className="text-xs text-text-secondary">
                                Gestão de pizzaria
                            </p>
                        </div>
                    </div>

                    <nav className="flex-1 overflow-y-auto px-3 pb-6">
                        {SECTIONS.map((section) => (
                            <div key={section.title} className="mt-4">
                                <p className="px-3 pb-1 text-xs font-medium text-text-secondary">
                                    {section.title}
                                </p>
                                <ul className="space-y-0.5">
                                    {section.items.map((item) => {
                                        const Icon = item.icon
                                        const active = pathname === item.href
                                        return (
                                            <li key={item.href}>
                                                <Link
                                                    href={item.href}
                                                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                                                        active
                                                            ? "bg-text-primary font-medium text-bg"
                                                            : "text-text-primary/70 hover:bg-text-primary/5 hover:text-text-primary"
                                                    }`}
                                                >
                                                    <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : ""}`} />
                                                    <span>{item.label}</span>
                                                </Link>
                                            </li>
                                        )
                                    })}
                                </ul>
                            </div>
                        ))}
                    </nav>
                </aside>
            )}

            <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border/40 bg-bg px-4">
                    <button
                        type="button"
                        onClick={() => setCollapsed((c) => !c)}
                        className="flex h-9 w-9 items-center justify-center rounded-md text-text-primary/70 transition hover:bg-text-primary/5 hover:text-text-primary"
                        aria-label="Alternar menu lateral"
                    >
                        <PanelLeft className="h-5 w-5" />
                    </button>

                    <div className="relative flex-1 max-w-2xl">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-primary/50" />
                        <input
                            type="search"
                            placeholder="Buscar pedidos, produtos, ingredientes..."
                            className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm text-text-primary outline-none transition placeholder:text-text-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/30"
                        />
                    </div>

                    <div className="ml-auto flex items-center gap-3">
                        <button
                            type="button"
                            className="relative flex h-9 w-9 items-center justify-center rounded-md text-text-primary/70 transition hover:bg-text-primary/5 hover:text-text-primary"
                            aria-label="Notificações"
                        >
                            <Bell className="h-5 w-5" />
                            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                                2
                            </span>
                        </button>

                        <div
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white"
                            aria-label="Ana Gomes"
                        >
                            AG
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-6">{children}</main>
            </div>
        </div>
    )
}
