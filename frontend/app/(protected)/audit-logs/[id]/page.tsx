"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    actionBadgeVariant,
    formatAuditAction,
    useAuditLog,
} from "@/lib/audit-logs"
import { useAuth } from "@/lib/auth"
import Link from "next/link"
import { useParams } from "next/navigation"

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v)
}

function DiffView({
    before,
    after,
}: {
    before: Record<string, unknown>
    after: Record<string, unknown>
}) {
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    return (
        <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border/40 bg-text-primary/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    Antes
                </p>
                <dl className="mt-2 space-y-1 font-mono text-xs">
                    {keys.map((k) => {
                        const changed = JSON.stringify(before[k]) !== JSON.stringify(after[k])
                        return (
                            <div key={k} className={`flex justify-between gap-3 ${changed ? "text-warning-foreground" : ""}`} >
                                <dt className="text-text-secondary">{k}</dt>
                                <dd className={ changed ? "rounded bg-secondary/40 px-1 text-text-primary" : "text-text-primary" } >
                                    {JSON.stringify(before[k] ?? null)}
                                </dd>
                            </div>
                        )
                    })}
                </dl>
            </div>
            <div className="rounded-lg border border-border/40 bg-primary/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    Depois
                </p>
                <dl className="mt-2 space-y-1 font-mono text-xs">
                    {keys.map((k) => {
                        const changed = JSON.stringify(before[k]) !== JSON.stringify(after[k])
                        return (
                            <div key={k} className="flex justify-between gap-3">
                                <dt className="text-text-secondary">{k}</dt>
                                <dd className={ changed ? "rounded bg-secondary/40 px-1 text-text-primary" : "text-text-primary" } >
                                    {JSON.stringify(after[k] ?? null)}
                                </dd>
                            </div>
                        )
                    })}
                </dl>
            </div>
        </div>
    )
}

const ENTITY_LINK_BASE: Partial<Record<string, string>> = {
    Product: "/products",
    Ingredient: "/ingredients",
    Order: "/orders",
    PurchaseOrder: "/purchase-orders",
    User: "/users",
    Unit: "/units",
}

export default function AuditLogDetailPage() {
    const { user } = useAuth()
    const params = useParams<{ id: string }>()
    const id = params.id
    const query = useAuditLog(user?.role === "OWNER" ? id : "")

    if (user?.role !== "OWNER") return <NoAccess />

    if (query.isLoading) {
        return (
            <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-10 animate-pulse rounded-lg bg-text-primary/5" />
                ))}
            </div>
        )
    }

    if (query.isError || !query.data) {
        return (
            <div className="text-center">
                <p className="text-sm text-danger">Não foi possível carregar o registro.</p>
                <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                    Tentar novamente
                </Button>
            </div>
        )
    }

    const log = query.data
    const before = isPlainObject(log.details?.before) ? (log.details!.before as Record<string, unknown>) : null
    const after = isPlainObject(log.details?.after) ? (log.details!.after as Record<string, unknown>) : null
    const entityHref = ENTITY_LINK_BASE[log.entityType as string]

    return (
        <div className="space-y-6">
            <header>
                <p className="text-sm text-text-secondary">
                    <Link href="/audit-logs" className="hover:underline">
                        Auditoria
                    </Link>{" "}
                    › {formatAuditAction(log.action)}
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-text-primary">
                    {formatAuditAction(log.action)}
                </h1>
            </header>

            <div className="rounded-xl border border-border/40 bg-white p-5">
                <h2 className="text-base font-semibold text-text-primary">Informações</h2>
                <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                    <div className="flex justify-between gap-3">
                        <dt className="text-text-secondary">Data</dt>
                        <dd className="text-text-primary">
                            {new Date(log.createdAt).toLocaleString("pt-BR", {
                                second: "2-digit",
                            })}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-text-secondary">Ação</dt>
                        <dd>
                            <Badge variant={actionBadgeVariant(log.action)}>
                                {formatAuditAction(log.action)}
                            </Badge>
                        </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-text-secondary">Tipo de entidade</dt>
                        <dd className="text-text-primary">{log.entityType}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-text-secondary">ID da entidade</dt>
                        <dd className="font-mono text-xs text-text-primary">
                            {log.entityId}
                            {entityHref ? (
                                <>
                                    {" "}
                                    <Link href={`${entityHref}/${log.entityId}`} className="ml-2 text-primary hover:underline" >
                                        Ver recurso →
                                    </Link>
                                </>
                            ) : null}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-text-secondary">Ator</dt>
                        <dd className="text-text-primary">{log.actorName}</dd>
                    </div>
                </dl>
            </div>

            <div className="rounded-xl border border-border/40 bg-white p-5">
                <h2 className="text-base font-semibold text-text-primary">Payload</h2>
                {before && after ? (
                    <div className="mt-3">
                        <DiffView before={before} after={after} />
                    </div>
                ) : log.details ? (
                    <pre className="mt-3 overflow-x-auto rounded-lg bg-text-primary/5 p-3 font-mono text-xs">
                        {JSON.stringify(log.details, null, 2)}
                    </pre>
                ) : (
                    <p className="mt-3 text-sm text-text-secondary">
                        Sem detalhes adicionais.
                    </p>
                )}
            </div>
        </div>
    )
}

function NoAccess() {
    return (
        <div className="mx-auto max-w-md rounded-xl border border-border/40 bg-white p-8 text-center">
            <h2 className="text-base font-semibold text-text-primary">Sem permissão</h2>
            <p className="mt-2 text-sm text-text-secondary">
                Apenas o proprietário pode acessar a auditoria.
            </p>
        </div>
    )
}