"use client"

import { Modal } from "@/components/overlays/modal"
import { Button } from "@/components/ui/button"

type Props = {
    open: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    message: string
    confirmLabel?: string
    confirmVariant?: "primary" | "danger"
    loading?: boolean
}

export function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = "Confirmar",
    confirmVariant = "danger",
    loading,
}: Props) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button variant={confirmVariant} onClick={onConfirm} disabled={loading}>
                        {loading ? "Processando..." : confirmLabel}
                    </Button>
                </>
            }
        >
            <p className="text-sm text-text-primary">{message}</p>
        </Modal>
    )
}