"use client"

import { NotificationsBell } from "@/components/notifications/notifications-bell"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth, type Role } from "@/lib/auth"
import {
    ArrowLeftRight,
    BarChart3,
    Bell,
    Boxes,
    FileText,
    Flame,
    LayoutGrid,
    Leaf,
    LogOut,
    Package,
    PanelLeft,
    Ruler,
    Search,
    ShoppingBag,
    ShoppingCart,
    Tag,
    Truck,
    User as UserIcon,
    Users,
    type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type NavItem = {
    label: string
    href: string
    icon: LucideIcon
    requireRole?: Role
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
            { label: "Pedidos", href: "/orders", icon: ShoppingBag },
            { label: "Notificações", href: "/notifications", icon: Bell },
        ],
    },
    {
        title: "Catálogo",
        items: [
            { label: "Produtos", href: "/products", icon: Package },
            { label: "Categorias", href: "/categories", icon: Tag },
            { label: "Ingredientes", href: "/ingredients", icon: Leaf },
            { label: "Unidades", href: "/units", icon: Ruler },
        ],
    },
    {
        title: "Suprimentos",
        items: [
            { label: "Compras", href: "/purchase-orders", icon: ShoppingCart },
            { label: "Fornecedores", href: "/suppliers", icon: Truck },
            { label: "Estoque", href: "/stock", icon: Boxes },
            { label: "Movimentações", href: "/stock-movements", icon: ArrowLeftRight },
        ],
    },
    {
        title: "Análise",
        items: [
            { label: "Relatórios", href: "/reports", icon: BarChart3 },
            { label: "Auditoria", href: "/audit-logs", icon: FileText, requireRole: "OWNER" },
        ],
    },
    {
        title: "Administração",
        items: [{ label: "Usuários", href: "/users", icon: Users, requireRole: "OWNER" }],
    },
]

function initials(name: string): string {
    return name
        .split(" ")
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const { user, status, logout } = useAuth()
    const [collapsed, setCollapsed] = useState(false)

    useEffect(() => {
        if (status === "unauthenticated") router.replace("/auth")
    }, [status, router])

    if (status !== "authenticated" || !user) {
        return (
            <div className="flex flex-1 items-center justify-center text-sm text-text-secondary">
                Carregando...
            </div>
        )
    }

    async function onLogout() {
        await logout()
        router.replace("/auth")
    }

    const visibleSections = SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) => !item.requireRole || item.requireRole === user.role),
    })).filter((s) => s.items.length > 0)

    return (
        <div className="flex flex-1 min-h-0">
            {!collapsed && (
                <aside className="flex w-64 shrink-0 flex-col border-r border-border/40 bg-bg">
                    <div className="flex items-center gap-3 px-5 py-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-danger text-white">
                            <Flame className="h-5 w-5" />
                        </div>
                        <div className="leading-tight">
                            <p className="text-sm font-semibold text-text-primary">Forno Vivo</p>
                            <p className="text-xs text-text-secondary">Gestão de pizzaria</p>
                        </div>
                    </div>

                    <nav className="flex-1 overflow-y-auto px-3 pb-6">
                        {visibleSections.map((section) => (
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
                                                    <Icon
                                                        className={`h-4 w-4 shrink-0 ${active ? "text-primary" : ""}`}
                                                    />
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
                        <NotificationsBell />

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white"
                                    aria-label={user.name}
                                >
                                    {initials(user.name)}
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel className="font-normal">
                                    <p className="truncate text-sm font-medium">{user.name}</p>
                                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link href="/me">
                                        <UserIcon className="h-4 w-4" /> Meu perfil
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={onLogout}
                                    className="text-destructive focus:text-destructive"
                                >
                                    <LogOut className="h-4 w-4" /> Sair
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-6">{children}</main>
            </div>
        </div>
    )
}