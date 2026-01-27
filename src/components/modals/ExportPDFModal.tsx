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
import { FileDown, Loader2 } from "lucide-react";

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
    const [count, setCount] = useState<string>("10");
    const [error, setError] = useState<string | null>(null);

    const maxLimit = Math.min(30, totalAvailable);

    const handleConfirm = () => {
        const num = parseInt(count);
        if (isNaN(num) || num <= 0) {
            setError("Por favor, insira um número válido.");
            return;
        }
        if (num > maxLimit) {
            setError(`O máximo permitido é ${maxLimit} questões.`);
            return;
        }

        setError(null);
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
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="count" className="text-right">
                            Quantidade
                        </Label>
                        <Input
                            id="count"
                            type="number"
                            value={count}
                            onChange={(e) => {
                                setCount(e.target.value);
                                setError(null);
                            }}
                            className="col-span-3"
                            max={maxLimit}
                            min={1}
                        />
                    </div>
                    <div className="text-sm text-muted-foreground ml-[25%]">
                        Disponível: {totalAvailable} (Máx: {maxLimit})
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
                    <Button onClick={handleConfirm} disabled={isGenerating || !!error}>
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
