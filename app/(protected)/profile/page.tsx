'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthContext } from "@/contexts/AuthContext";
import { useSmartFilters } from "@/hooks/useSmartFilters";
import { COLLEGES } from "@/data/colleges";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    User,
    CreditCard,
    CheckCircle2,
    AlertCircle,
    Mail,
    Calendar,
    Building2,
    Loader2,
    GraduationCap,
    Clock,
    UserCircle,
    School,
    X,
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SelectGroup,
    SelectLabel,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── Cancellation modal ─────────────────────────────────────────────────────

interface CancelDialogProps {
    isRefundWindow: boolean;
    onConfirm: (feedback: string) => Promise<void>;
    onClose: () => void;
}

function CancelDialog({ isRefundWindow, onConfirm, onClose }: CancelDialogProps) {
    const [feedback, setFeedback] = useState('');
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        setLoading(true);
        await onConfirm(feedback);
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-lg text-foreground">
                        {isRefundWindow ? 'Solicitar reembolso' : 'Cancelar assinatura'}
                    </h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <p className="text-sm text-muted-foreground">
                    {isRefundWindow
                        ? 'Você está dentro do prazo de 7 dias. Enviaremos sua solicitação ao nosso time e entraremos em contato em breve.'
                        : 'Seu acesso Premium continuará ativo até o fim do período pago. Após isso, você voltará ao plano gratuito.'}
                </p>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                        {isRefundWindow ? 'Motivo do cancelamento' : 'Gostaria de deixar um feedback? (opcional)'}
                    </label>
                    <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder={isRefundWindow
                            ? 'Conte-nos o motivo para podermos melhorar...'
                            : 'O que poderia ter sido diferente?'}
                        rows={3}
                        required={isRefundWindow}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    {isRefundWindow && (
                        <p className="text-xs text-muted-foreground">Obrigatório para solicitação de reembolso.</p>
                    )}
                </div>

                <div className="flex gap-3 pt-1">
                    <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
                        Voltar
                    </Button>
                    <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={handleConfirm}
                        disabled={loading || (isRefundWindow && !feedback.trim())}
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fetchSubscriptionCreatedAt(userId: string): Promise<Date | null> {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data } = await supabase
        .from('subscriptions')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    return data?.created_at ? new Date(data.created_at) : null;
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function ProfilePage() {
    const router = useRouter();
    const { user, profile, userType, updateProfile } = useAuthContext();
    const { aliveOptions, isLoading: isLoadingBancas } = useSmartFilters();
    const { toast } = useToast();

    const [fullName, setFullName] = useState(profile?.full_name || "");
    const [age, setAge] = useState(profile?.age?.toString() || "");
    const [graduationYear, setGraduationYear] = useState(profile?.graduation_year?.toString() || "");
    const [university, setUniversity] = useState(profile?.university || "");
    const [isSaving, setIsSaving] = useState(false);

    // Cancellation state
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [isRefundWindow, setIsRefundWindow] = useState(false);
    const [cancelResult, setCancelResult] = useState<'refund' | 'cancel_future' | null>(null);
    const [loadingCancel, setLoadingCancel] = useState(false);

    useEffect(() => {
        if (profile) {
            setFullName(profile.full_name || "");
            setAge(profile.age?.toString() || "");
            setGraduationYear(profile.graduation_year?.toString() || "");
            setUniversity(profile.university || "");
        }
    }, [profile]);

    const groupedColleges = useMemo(() => {
        const groups: Record<string, string[]> = {};
        COLLEGES.forEach(college => {
            if (!groups[college.state]) {
                groups[college.state] = [];
            }
            groups[college.state].push(college.sigla);
        });
        return groups;
    }, []);

    if (!user) {
        return (
            <div className="container mx-auto py-10 px-4">
                <Card>
                    <CardContent className="py-10 text-center">
                        <p>Você precisa estar logado para acessar seu perfil.</p>
                        <Link href="/auth">
                            <Button className="mt-4">Fazer Login</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const isPremium = userType === 'paid';
    const isCancelled = (profile as Record<string, unknown> | null)?.subscription_status === 'cancelled';
    const planName = isPremium ? "Premium" : "Gratuito";
    const joinDate = new Date(user.created_at || "").toLocaleDateString('pt-BR');
    const tierExpiry = (profile as Record<string, unknown> | null)?.tier_expiry as string | undefined;

    const handleSaveProfile = async () => {
        setIsSaving(true);
        const { error } = await updateProfile({
            full_name: fullName,
            age: age ? parseInt(age) : null,
            graduation_year: graduationYear ? parseInt(graduationYear) : null,
            university: university || null
        });
        setIsSaving(false);

        if (error) {
            toast({
                title: "Erro ao salvar",
                description: "Ocorreu um problema ao atualizar seus dados.",
                variant: "destructive"
            });
        } else {
            toast({
                title: "Perfil atualizado",
                description: "Seus dados foram salvos com sucesso.",
            });
        }
    };

    const handleBancaChange = async (value: string) => {
        const bancaValue = value === "none" ? null : value;
        const { error } = await updateProfile({ preferred_banca: bancaValue });

        if (error) {
            toast({
                title: "Erro ao atualizar preferência",
                description: "Não foi possível salvar sua instituição de preferência.",
                variant: "destructive"
            });
        } else {
            toast({
                title: "Preferência atualizada",
                description: "Sua instituição de preferência foi salva com sucesso.",
            });
        }
    };

    const handleManageSubscription = async () => {
        if (!isPremium) {
            router.push("/pricing");
            return;
        }

        setLoadingCancel(true);
        const subCreatedAt = await fetchSubscriptionCreatedAt(user.id);
        setLoadingCancel(false);

        const now = new Date();
        const daysSince = subCreatedAt
            ? (now.getTime() - subCreatedAt.getTime()) / (1000 * 60 * 60 * 24)
            : Infinity;

        setIsRefundWindow(daysSince <= 7);
        setCancelDialogOpen(true);
    };

    const handleCancelConfirm = async (feedback: string) => {
        const session = await createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        ).auth.getSession();
        const token = session.data.session?.access_token;
        if (!token) return;

        const res = await fetch('/api/asaas/cancel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ feedback }),
        });

        const data = await res.json();

        if (!res.ok) {
            toast({
                title: "Erro",
                description: data.error ?? 'Erro ao processar cancelamento.',
                variant: "destructive",
            });
            return;
        }

        setCancelDialogOpen(false);
        setCancelResult(data.type as 'refund' | 'cancel_future');
    };

    return (
        <div className="container max-w-4xl mx-auto py-10 px-4 space-y-8">
            {cancelDialogOpen && (
                <CancelDialog
                    isRefundWindow={isRefundWindow}
                    onConfirm={handleCancelConfirm}
                    onClose={() => setCancelDialogOpen(false)}
                />
            )}

            <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                    {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <User className="h-8 w-8 text-primary" />
                    )}
                </div>
                <div>
                    <h1 className="text-3xl font-bold">Meu Perfil</h1>
                    <p className="text-muted-foreground">{user.email}</p>
                </div>
            </div>

            <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full md:w-[400px] grid-cols-2">
                    <TabsTrigger value="general">Geral</TabsTrigger>
                    <TabsTrigger value="subscription">Assinatura</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="mt-6 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Informações Pessoais</CardTitle>
                            <CardDescription>Mantenha seus dados atualizados para uma experiência personalizada.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                        <UserCircle className="h-4 w-4" /> Nome Completo
                                    </label>
                                    <Input
                                        placeholder="Seu nome"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                        <Mail className="h-4 w-4" /> Email
                                    </label>
                                    <div className="p-2.5 bg-secondary/30 rounded-md border text-sm font-medium text-muted-foreground">
                                        {user.email}
                                    </div>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                        <Clock className="h-4 w-4" /> Idade
                                    </label>
                                    <Input
                                        type="number"
                                        placeholder="Ex: 24"
                                        value={age}
                                        onChange={(e) => setAge(e.target.value)}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                        <GraduationCap className="h-4 w-4" /> Ano de Formatura
                                    </label>
                                    <Input
                                        type="number"
                                        placeholder="Ex: 2026"
                                        value={graduationYear}
                                        onChange={(e) => setGraduationYear(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <School className="h-4 w-4" /> Qual sua Faculdade / Universidade?
                                </label>
                                <Select value={university || "none"} onValueChange={(val) => setUniversity(val === "none" ? "" : val)}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Selecione sua faculdade" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[300px]">
                                        <SelectItem value="none">Selecione...</SelectItem>
                                        {Object.entries(groupedColleges).sort().map(([state, siglaList]) => (
                                            <SelectGroup key={state}>
                                                <SelectLabel className="bg-muted/50 py-1.5 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                    {state}
                                                </SelectLabel>
                                                {siglaList.sort().map(sigla => (
                                                    <SelectItem key={sigla} value={sigla}>
                                                        {sigla}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="pt-2">
                                <Button
                                    onClick={handleSaveProfile}
                                    disabled={isSaving}
                                    className="w-full md:w-auto"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Salvando...
                                        </>
                                    ) : "Salvar Alterações"}
                                </Button>
                            </div>

                            <div className="pt-4 border-t">
                                <div className="grid gap-1">
                                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                        <Calendar className="h-3 w-3" /> Membro desde
                                    </label>
                                    <div className="text-xs text-muted-foreground">
                                        {joinDate}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Preferências de Estudo</CardTitle>
                            <CardDescription>Personalize o comportamento padrão da plataforma.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-1">
                                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <Building2 className="h-4 w-4" /> Instituição de Preferência (Banca)
                                </label>

                                {isLoadingBancas ? (
                                    <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Carregando instituições...
                                    </div>
                                ) : (
                                    <Select
                                        defaultValue={profile?.preferred_banca || "none"}
                                        onValueChange={handleBancaChange}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Selecione uma instituição" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Nenhuma (Mostrar todas)</SelectItem>
                                            {aliveOptions.bancas.map(([banca]) => (
                                                <SelectItem key={banca} value={banca}>
                                                    {banca}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                    Esta instituição será destacada em suas estatísticas.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Aparência</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                O tema (Claro/Escuro) pode ser alterado no cabeçalho da página através do ícone correspondente.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="subscription" className="mt-6 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span>Plano Atual</span>
                                <Badge variant={isPremium ? "default" : "secondary"}>
                                    {isCancelled && isPremium ? "Cancelado" : planName}
                                </Badge>
                            </CardTitle>
                            <CardDescription>Detalhes da sua assinatura e faturamento.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">

                            {/* ── Cancellation result messages ── */}
                            {cancelResult === 'refund' && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 text-sm flex gap-3 text-blue-800 dark:text-blue-200">
                                    <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                                    <p>
                                        Sua solicitação foi enviada ao nosso time. Em breve entraremos em contato com mais informações via email.
                                    </p>
                                </div>
                            )}
                            {cancelResult === 'cancel_future' && (
                                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800 text-sm flex gap-3 text-green-800 dark:text-green-200">
                                    <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                        <p className="font-semibold">Cancelamento concluído.</p>
                                        <p>
                                            Os recursos Premium continuarão ativos até o fim do período pago
                                            {tierExpiry ? ` (${new Date(tierExpiry).toLocaleDateString('pt-BR')})` : ''}.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* ── Plan card ── */}
                            <div className="flex items-center justify-between p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${isPremium ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'}`}>
                                        <CreditCard className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-semibold">Plano {planName}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {isPremium && !isCancelled && "Acesso ilimitado a todas as funcionalidades."}
                                            {isPremium && isCancelled && tierExpiry && `Acesso ativo até ${new Date(tierExpiry).toLocaleDateString('pt-BR')}.`}
                                            {!isPremium && "Funcionalidades limitadas."}
                                        </p>
                                    </div>
                                </div>
                                {isPremium && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                            </div>

                            {!isPremium && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-900 text-sm flex gap-3 text-amber-800 dark:text-amber-200">
                                    <AlertCircle className="h-5 w-5 shrink-0" />
                                    <div className="space-y-1">
                                        <p className="font-semibold">Faça um upgrade para Premium</p>
                                        <p>Tenha acesso a questões ilimitadas, estatísticas avançadas e modo focado.</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>

                        <CardFooter className="flex justify-end gap-3 border-t bg-muted/20 px-6 py-4">
                            {isPremium && !isCancelled && cancelResult === null ? (
                                <Button
                                    variant="outline"
                                    onClick={handleManageSubscription}
                                    disabled={loadingCancel}
                                >
                                    {loadingCancel
                                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...</>
                                        : 'Gerenciar Assinatura'}
                                </Button>
                            ) : !isPremium ? (
                                <Link href="/pricing">
                                    <Button className="w-full sm:w-auto">
                                        Fazer Upgrade Agora
                                    </Button>
                                </Link>
                            ) : null}
                        </CardFooter>
                    </Card>

                    <p className="text-center text-xs text-muted-foreground">
                        Pagamentos processados com segurança pela <span className="font-medium text-foreground">Asaas</span>.
                    </p>
                </TabsContent>
            </Tabs>
        </div>
    );
}
