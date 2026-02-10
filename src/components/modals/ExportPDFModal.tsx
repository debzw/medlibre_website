import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileDown, Loader2, AlertCircle } from "lucide-react";
import { useUsageLimit } from '@/hooks/useUsageLimit';
import { useAuthContext } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ExportPDFModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    totalAvailable: number;
    onConfirm: (count: number) => void;
    isGenerating: boolean;
}

export const ExportPDFModal = ({
    open,
    onOpenChange,
    totalAvailable,
    onConfirm,
    isGenerating
}: ExportPDFModalProps) => {
    const { user, profile } = useAuthContext();
    const {
        canExportPdf,
        getRemainingPdfs,
        incrementPdfUsage,
        userType
    } = useUsageLimit(profile, !!user);

    const [count, setCount] = useState<string>("10");
    const [error, setError] = useState<string | null>(null);

    const maxLimit = Math.min(30, totalAvailable);
    const remainingPdfs = getRemainingPdfs();
    const limitReached = !canExportPdf();

    const handleConfirm = async () => {
        const num = parseInt(count);
        if (isNaN(num) || num <= 0) {
            setError("Por favor, insira um número válido.");
            return;
        }
        if (num > maxLimit) {
            setError(`O máximo permitido é ${maxLimit} questões.`);
            return;
        }

        if (limitReached) {
            setError("Você atingiu o limite diário de exportação de PDFs (20 por dia).");
            return;
        }

        setError(null);
        await incrementPdfUsage();
        onConfirm(num);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileDown className="h-5 w-5 text-primary" />
                        Exportar Caderno de Questões
                    </DialogTitle>
                    <DialogDescription>
                        Crie um PDF personalizado com as questões selecionadas.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {limitReached && (
                        <Alert variant="destructive" className="mb-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Limite atingido</AlertTitle>
                            <AlertDescription>
                                Você já exportou 20 PDFs hoje. O limite diário será resetado amanhã.
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="count" className="text-right">
                            Quantidade
                        </Label>
                        <Input
                            id="count"
                            type="number"
                            value={count}
                            disabled={limitReached}
                            onChange={(e) => {
                                setCount(e.target.value);
                                setError(null);
                            }}
                            className="col-span-3"
                            max={maxLimit}
                            min={1}
                        />
                    </div>
                    <div className="space-y-1 ml-[25%] uppercase tracking-wider font-bold">
                        <div className="text-[10px] text-muted-foreground">
                            Questões disponíveis: {totalAvailable} (Máx: {maxLimit})
                        </div>
                        {userType === 'paid' && (
                            <div className={`text-[10px] ${remainingPdfs <= 3 ? 'text-amber-500' : 'text-primary'}`}>
                                PDFs restantes hoje: {remainingPdfs}
                            </div>
                        )}
                    </div>
                    {error && (
                        <div className="text-sm text-destructive font-medium ml-[25%]">
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={handleConfirm} disabled={isGenerating || !!error || limitReached}>
                        {isGenerating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Gerando...
                            </>
                        ) : (
                            "Exportar PDF"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
