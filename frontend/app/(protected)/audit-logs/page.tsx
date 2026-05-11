"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    actionBadgeVariant,
    AUDIT_ACTIONS,
    AUDIT_ENTITY_TYPES,
    formatAuditAction,
    summarizeAuditDetails,
    useAuditLogs,
    type AuditAction,
    type AuditEntityType,
} from "@/lib/audit-logs"
import { useAuth } from "@/lib/auth"
import { useAllUsers } from "@/lib/users"
import { Eye } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

function AuditLogsPageInner() {
    const { user } = useAuth()
    const router = useRouter()
    const searchParams = useSearchParams()

    const entityTypeParam = (searchParams.get("entityType") as AuditEntityType | null) ?? ""
    const entityIdParam = searchParams.get("entityId") ?? ""
    const actorParam = searchParams.get("actorId") ?? ""
    const actionParam = (searchParams.get("action") as AuditAction | null) ?? ""
    const fromParam = searchParams.get("from") ?? ""
    const toParam = searchParams.get("to") ?? ""

    const [page, setPage] = useState(0)
    const size = 20

    const enabled = user?.role === "OWNER"

    const query = useAuditLogs(
        enabled
            ? {
                  entityType: entityTypeParam || undefined,
                  entityId: entityIdParam || undefined,
                  actorId: actorParam || undefined,
                  action: actionParam || undefined,
                  from: fromParam || undefined,
                  to: toParam || undefined,
                  page,
                  size,
              }
            : {},
    )
    const users = useAllUsers()

    if (user?.role !== "OWNER") return <NoAccess />

    function setFilter(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString())
        if (value === "") params.delete(key)
        else params.set(key, value)
        setPage(0)
        router.replace(`/audit-logs?${params.toString()}`)
    }

    const data = query.data
    const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold text-text-primary">Auditoria</h1>
                <p className="mt-1 text-sm text-text-secondary">
                    Histórico imutável de mutações sensíveis no sistema.
                </p>
            </header>

            <div className="flex flex-wrap items-end gap-3">
                <Field label="Tipo de entidade" htmlFor="f-entity-type">
                    <Select id="f-entity-type" value={entityTypeParam} onChange={(e) => setFilter("entityType", e.target.value)} >
                        <option value="">Todos</option>
                        {AUDIT_ENTITY_TYPES.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="ID da entidade" htmlFor="f-entity-id">
                    <Input id="f-entity-id" value={entityIdParam} onChange={(e) => setFilter("entityId", e.target.value)} placeholder="UUID" />
                </Field>
                <Field label="Ação" htmlFor="f-action">
                    <Select id="f-action" value={actionParam} onChange={(e) => setFilter("action", e.target.value)} >
                        <option value="">Todas</option>
                        {AUDIT_ACTIONS.map((a) => (
                            <option key={a} value={a}>
                                {formatAuditAction(a)}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="Ator" htmlFor="f-actor">
                    <Select id="f-actor" value={actorParam} onChange={(e) => setFilter("actorId", e.target.value)} >
                        <option value="">Todos</option>
                        {users.data?.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="De" htmlFor="f-from">
                    <Input id="f-from" type="date" value={fromParam} onChange={(e) => setFilter("from", e.target.value)} />
                </Field>
                <Field label="Até" htmlFor="f-to">
                    <Input id="f-to" type="date" value={toParam} onChange={(e) => setFilter("to", e.target.value)} />
                </Field>
            </div>

            {query.isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-text-primary/5" />
                    ))}
                </div>
            ) : query.isError ? (
                <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                    <p className="text-sm text-danger">Falha ao carregar auditoria.</p>
                    <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : data && data.data.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-text-secondary">
                        Nenhum registro para os filtros selecionados.
                    </p>
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Ação</TableHead>
                            <TableHead>Entidade</TableHead>
                            <TableHead>Ator</TableHead>
                            <TableHead>Detalhes</TableHead>
                            <TableHead>Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data!.data.map((log) => (
                            <TableRow key={log.id}>
                                <TableCell>{new Date(log.createdAt).toLocaleString("pt-BR")}</TableCell>
                                <TableCell>
                                    <Badge variant={actionBadgeVariant(log.action)}>
                                        {formatAuditAction(log.action)}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {log.entityType}{" "}
                                    <span className="font-mono text-xs text-text-secondary">
                                        #{log.entityId.slice(0, 8)}
                                    </span>
                                </TableCell>
                                <TableCell>{log.actorName}</TableCell>
                                <TableCell className="max-w-xs truncate">
                                    {summarizeAuditDetails(log.action, log.details)}
                                </TableCell>
                                <TableCell>
                                    <Link href={`/audit-logs/${log.id}`} className="inline-flex items-center gap-1 text-primary hover:underline" >
                                        <Eye className="h-4 w-4" /> Ver
                                    </Link>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            {data && data.total > size ? (
                <div className="flex items-center justify-between text-sm text-text-secondary">
                    <span>
                        Página {page + 1} de {totalPages} · {size} por página
                    </span>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} >
                            Anterior
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= totalPages} >
                            Próximo
                        </Button>
                    </div>
                </div>
            ) : null}
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

export default function AuditLogsPage() {
    return (
        <Suspense fallback={null}>
            <AuditLogsPageInner />
        </Suspense>
    )
}