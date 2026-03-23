'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Mail, UserCircle, GraduationCap, Clock, School, Building2, Globe } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useSmartFilters } from '@/hooks/useSmartFilters';
import { useToast } from '@/components/ui/use-toast';
import { COLLEGES } from '@/data/colleges';

interface ProfileCompletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LOCALES = [
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'es', label: 'Español' },
];

export function ProfileCompletionModal({ open, onOpenChange }: ProfileCompletionModalProps) {
  const { user, profile, updateProfile } = useAuthContext();
  const { aliveOptions, isLoading: isLoadingBancas } = useSmartFilters();
  const { toast } = useToast();

  const [fullName, setFullName] = useState('');
  const [locale, setLocale] = useState('');
  const [university, setUniversity] = useState('');
  const [age, setAge] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [preferredBanca, setPreferredBanca] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setLocale(profile.locale || 'pt-BR');
      setUniversity(profile.university || '');
      setAge(profile.age?.toString() || '');
      setGraduationYear(profile.graduation_year?.toString() || '');
      setPreferredBanca(profile.preferred_banca || 'none');
    }
  }, [profile, open]);

  const groupedColleges = useMemo(() => {
    const groups: Record<string, string[]> = {};
    COLLEGES.forEach(college => {
      if (!groups[college.state]) groups[college.state] = [];
      groups[college.state].push(college.sigla);
    });
    return groups;
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await updateProfile({
      full_name: fullName || null,
      locale: locale || null,
      university: university && university !== 'none' ? university : null,
      age: age ? parseInt(age) : null,
      graduation_year: graduationYear ? parseInt(graduationYear) : null,
      preferred_banca: preferredBanca && preferredBanca !== 'none' ? preferredBanca : null,
    });
    setIsSaving(false);

    if (error) {
      toast({
        title: 'Erro ao salvar',
        description: 'Ocorreu um problema ao atualizar seus dados.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Perfil atualizado',
        description: 'Seus dados foram salvos com sucesso.',
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete seu perfil</DialogTitle>
          <DialogDescription>
            Preencha seus dados para nos ajudar a entender melhor nossa comunidade.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Full name */}
          <div className="grid gap-1.5">
            <Label className="flex items-center gap-2 text-muted-foreground">
              <UserCircle className="h-4 w-4" /> Nome Completo
            </Label>
            <Input
              placeholder="Seu nome"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          {/* Email — read only */}
          <div className="grid gap-1.5">
            <Label className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" /> Email
            </Label>
            <div className="p-2.5 bg-secondary/30 rounded-md border text-sm text-muted-foreground">
              {user?.email}
            </div>
          </div>

          {/* Locale */}
          <div className="grid gap-1.5">
            <Label className="flex items-center gap-2 text-muted-foreground">
              <Globe className="h-4 w-4" /> Idioma
            </Label>
            <Select value={locale || 'pt-BR'} onValueChange={setLocale}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o idioma" />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map(l => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Age + Graduation year */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" /> Idade
              </Label>
              <Input
                type="number"
                placeholder="Ex: 24"
                min={18}
                max={80}
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="flex items-center gap-2 text-muted-foreground">
                <GraduationCap className="h-4 w-4" /> Ano de Formatura
              </Label>
              <Input
                type="number"
                placeholder="Ex: 2026"
                min={1980}
                max={2035}
                value={graduationYear}
                onChange={(e) => setGraduationYear(e.target.value)}
              />
            </div>
          </div>

          {/* University */}
          <div className="grid gap-1.5">
            <Label className="flex items-center gap-2 text-muted-foreground">
              <School className="h-4 w-4" /> Faculdade / Universidade
            </Label>
            <Select value={university || 'none'} onValueChange={(val) => setUniversity(val === 'none' ? '' : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione sua faculdade" />
              </SelectTrigger>
              <SelectContent className="max-h-[240px]">
                <SelectItem value="none">Selecione...</SelectItem>
                {Object.entries(groupedColleges).sort().map(([state, siglaList]) => (
                  <SelectGroup key={state}>
                    <SelectLabel className="bg-muted/50 py-1.5 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {state}
                    </SelectLabel>
                    {siglaList.sort().map(sigla => (
                      <SelectItem key={sigla} value={sigla}>{sigla}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preferred banca */}
          <div className="grid gap-1.5">
            <Label className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4" /> Banca de Preferência
            </Label>
            {isLoadingBancas ? (
              <div className="flex items-center gap-2 p-2.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : (
              <Select value={preferredBanca} onValueChange={setPreferredBanca}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma banca" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (Mostrar todas)</SelectItem>
                  {aliveOptions.bancas.map(([banca]) => (
                    <SelectItem key={banca} value={banca}>{banca}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Agora não
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
            ) : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
