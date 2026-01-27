import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useReport, type ReportType } from "@/hooks/useReport";

interface ReportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    type: ReportType;
    targetId: string;
    targetName?: string;
}

const CATEGORIES: Record<ReportType, { label: string; value: string }[]> = {
    question: [
        { label: "Gabarito Errado", value: "wrong_answer" },
        { label: "Erro de Digitação/Português", value: "typo" },
        { label: "Imagem Corrompida/Ausente", value: "image_issue" },
        { label: "Explicação Confusa", value: "explanation_issue" },
        { label: "Outro", value: "other" },
    ],
    statistics: [
        { label: "Dados Incorretos", value: "wrong_data" },
        { label: "Gráfico não Carrega", value: "chart_issue" },
        { label: "Filtro não Funciona", value: "filter_issue" },
        { label: "Outro", value: "other" },
    ],
    bridge: [
        { label: "Sugestões Erradas", value: "wrong_suggestions" },
        { label: "Erro na Busca", value: "search_issue" },
        { label: "Outro", value: "other" },
    ],
    general: [
        { label: "Erro Visual (Layout)", value: "layout_issue" },
        { label: "Lentidão", value: "slowness" },
        { label: "Bug Inesperado", value: "unexpected_bug" },
        { label: "Outro", value: "other" },
    ],
};

export function ReportDialog({
    isOpen,
    onClose,
    type,
    targetId,
    targetName,
}: ReportDialogProps) {
    const [category, setCategory] = useState<string>("");
    const [description, setDescription] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { submitReport } = useReport();

    const handleSubmit = async () => {
        if (!category) return;

        setIsSubmitting(true);
        const result = await submitReport({
            type,
            category,
            target_id: targetId,
            description,
            metadata: { targetName },
        });

        setIsSubmitting(false);
        if (result.success) {
            setCategory("");
            setDescription("");
            onClose();
        }
    };

    const categories = CATEGORIES[type] || CATEGORIES.general;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] rounded-3xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black">Reportar Problema</DialogTitle>
                    <DialogDescription>
                        {targetName ? `Relatando erro em: ${targetName}` : "Ajude-nos a manter o MedLibre perfeito."}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="category" className="font-bold">O que está acontecendo?</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger id="category" className="rounded-xl">
                                <SelectValue placeholder="Selecione uma categoria" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map((cat) => (
                                    <SelectItem key={cat.value} value={cat.value}>
                                        {cat.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description" className="font-bold">Mais detalhes (opcional)</Label>
                        <Textarea
                            id="description"
                            placeholder="Descreva o erro que você encontrou..."
                            className="rounded-xl min-h-[100px]"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} className="rounded-xl">
                        Cancelar
                    </Button>
                    <Button
                        disabled={!category || isSubmitting}
                        onClick={handleSubmit}
                        className="rounded-xl px-8"
                    >
                        {isSubmitting ? "Enviando..." : "Enviar Relatório"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
