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
    School
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
    const planName = isPremium ? "Premium" : "Gratuito";
    const joinDate = new Date(user.created_at || "").toLocaleDateString('pt-BR');

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

    const handleManageSubscription = () => {
        if (isPremium) {
            console.log("Open Customer Portal");
            alert("Redirecionando para o portal do cliente (Asaas)...");
        } else {
            router.push("/pricing");
        }
    };

    return (
        <div className="container max-w-4xl mx-auto py-10 px-4 space-y-8">
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
                                    {planName}
                                </Badge>
                            </CardTitle>
                            <CardDescription>Detalhes da sua assinatura e faturamento.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${isPremium ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'}`}>
                                        <CreditCard className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-semibold">Plano {planName}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {isPremium
                                                ? "Acesso ilimitado a todas as funcionalidades."
                                                : "Funcionalidades limitadas."}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isPremium && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                                </div>
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
                            {isPremium ? (
                                <Button variant="outline" onClick={handleManageSubscription}>
                                    Gerenciar Assinatura
                                </Button>
                            ) : (
                                <Link href="/pricing">
                                    <Button className="w-full sm:w-auto">
                                        Fazer Upgrade Agora
                                    </Button>
                                </Link>
                            )}
                        </CardFooter>
                    </Card>

                    {isPremium && (
                        <p className="text-center text-xs text-muted-foreground">
                            Sua assinatura é processada e gerenciada de forma segura via Stripe ou Asaas.
                        </p>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
