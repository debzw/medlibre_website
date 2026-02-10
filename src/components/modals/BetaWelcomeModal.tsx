
"use client"

import { useEffect, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RocketIcon, CheckIcon } from "lucide-react"

export function BetaWelcomeModal() {
    const [open, setOpen] = useState(false)

    useEffect(() => {
        // Check if user has already seen the modal
        const hasSeen = localStorage.getItem("medlibre_beta_welcome_seen")
        if (!hasSeen) {
            // Small delay for better UX
            const timer = setTimeout(() => setOpen(true), 1500)
            return () => clearTimeout(timer)
        }
    }, [])

    const handleClose = () => {
        localStorage.setItem("medlibre_beta_welcome_seen", "true")
        setOpen(false)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="mx-auto bg-primary/10 p-3 rounded-full mb-4 w-fit">
                        <RocketIcon className="h-8 w-8 text-primary" />
                    </div>
                    <DialogTitle className="text-center text-xl">Bem-vindo ao Beta do MedLibre!</DialogTitle>
                    <DialogDescription className="text-center pt-2">
                        Como agradecimento por fazer parte do início da nossa jornada, você ganhou acesso <strong>Premium Totalmente Gratuito</strong> até <strong>Abril de 2026</strong>.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 text-sm">
                            <div className="h-6 w-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                                <CheckIcon className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            </div>
                            <span>Questões Ilimitadas</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <div className="h-6 w-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                                <CheckIcon className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            </div>
                            <span>Análise de Desempenho Avançada</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <div className="h-6 w-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                                <CheckIcon className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            </div>
                            <span>Sem Anúncios</span>
                        </div>
                    </div>
                </div>

                <DialogFooter className="sm:justify-center">
                    <Button type="button" onClick={handleClose} className="w-full sm:w-auto min-w-[150px]">
                        Aproveitar Agora
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
