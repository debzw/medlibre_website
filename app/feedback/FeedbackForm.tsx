'use client';

import { useState } from 'react';
import { Star, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface RatingFieldProps {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
}

function RatingField({ label, description, value, onChange }: RatingFieldProps) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;

  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground mb-2">{description}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className="p-0.5 transition-transform hover:scale-110 focus:outline-none"
            aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
          >
            <Star
              className={`w-7 h-7 transition-colors ${
                display >= star
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground/30'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

interface FeedbackData {
  rating_overall: number;
  rating_content_quality: number;
  rating_interface: number;
  rating_study_algorithm: number;
  rating_performance: number;
  rating_value: number;
  most_useful: string;
  needs_improvement: string;
  missing_features: string;
  would_recommend: boolean | null;
  willing_to_pay: boolean | null;
  suggested_price: string;
  free_comment: string;
}

const INITIAL: FeedbackData = {
  rating_overall: 0,
  rating_content_quality: 0,
  rating_interface: 0,
  rating_study_algorithm: 0,
  rating_performance: 0,
  rating_value: 0,
  most_useful: '',
  needs_improvement: '',
  missing_features: '',
  would_recommend: null,
  willing_to_pay: null,
  suggested_price: '',
  free_comment: '',
};

export default function FeedbackForm({ token }: { token: string }) {
  const [data, setData] = useState<FeedbackData>(INITIAL);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [newExpiry, setNewExpiry] = useState('');

  function setRating(field: keyof FeedbackData) {
    return (v: number) => setData((d) => ({ ...d, [field]: v }));
  }

  function setText(field: keyof FeedbackData) {
    return (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
      setData((d) => ({ ...d, [field]: e.target.value }));
  }

  function wordCount(text: string) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  const totalWords =
    wordCount(data.most_useful) +
    wordCount(data.needs_improvement) +
    wordCount(data.missing_features);

  const isValid =
    data.rating_overall > 0 &&
    data.rating_content_quality > 0 &&
    data.rating_interface > 0 &&
    data.rating_study_algorithm > 0 &&
    data.rating_performance > 0 &&
    data.rating_value > 0 &&
    data.most_useful.trim() !== '' &&
    data.needs_improvement.trim() !== '' &&
    data.missing_features.trim() !== '' &&
    totalWords >= 50 &&
    data.would_recommend !== null &&
    data.willing_to_pay !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setStatus('submitting');

    try {
      const res = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...data }),
      });
      const json = await res.json();

      if (!res.ok) {
        setErrorMsg(json.error ?? 'Erro desconhecido.');
        setStatus('error');
        return;
      }

      setNewExpiry(json.new_expiry ?? '');
      setStatus('success');
    } catch (err) {
      setErrorMsg(String(err));
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-lg card-elevated p-10 text-center space-y-6">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          <h1 className="font-title text-2xl text-foreground">Obrigado pelo feedback!</h1>
          <p className="text-muted-foreground leading-relaxed">
            Seu Premium foi estendido por <strong>3 meses</strong>.
            {newExpiry && (
              <>
                {' '}Novo acesso garantido até{' '}
                <strong>{new Date(newExpiry).toLocaleDateString('pt-BR')}</strong>.
              </>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            Não esqueça: você também ganha <strong>+1 mês</strong> para cada amigo que se cadastrar
            com o seu código de convite.
          </p>
          <Link
            href="/app"
            className="inline-block bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Continuar estudando →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="w-full max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <Link href="/">
            <img src="/logo_withname.svg" alt="medlibre" className="h-10 mx-auto dark:hidden" />
            <img src="/logo_withname_white.svg" alt="medlibre" className="h-10 mx-auto hidden dark:block" />
          </Link>
          <h1 className="font-title text-2xl text-foreground mt-4">Formulário de Feedback</h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-md mx-auto">
            Responda com honestidade — cada resposta nos ajuda a melhorar.
            Ao enviar, você ganha <strong className="text-foreground">3 meses de Premium grátis</strong>.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Bloco 1: Avaliações */}
          <div className="card-elevated p-6 space-y-6">
            <h2 className="font-semibold text-foreground text-base">Avaliações gerais</h2>

            <RatingField
              label="Avaliação geral"
              description="Como você avalia o medlibre no geral?"
              value={data.rating_overall}
              onChange={setRating('rating_overall')}
            />
            <RatingField
              label="Qualidade do conteúdo"
              description="As questões são precisas, atualizadas e bem formuladas?"
              value={data.rating_content_quality}
              onChange={setRating('rating_content_quality')}
            />
            <RatingField
              label="Interface e usabilidade"
              description="O app é fácil de usar, intuitivo e agradável visualmente?"
              value={data.rating_interface}
              onChange={setRating('rating_interface')}
            />
            <RatingField
              label="Algoritmo de estudo"
              description="A repetição espaçada e personalização fazem sentido para sua rotina?"
              value={data.rating_study_algorithm}
              onChange={setRating('rating_study_algorithm')}
            />
            <RatingField
              label="Performance técnica"
              description="O app é rápido, estável e livre de bugs que atrapalhem o estudo?"
              value={data.rating_performance}
              onChange={setRating('rating_performance')}
            />
            <RatingField
              label="Custo-benefício"
              description="O medlibre vale o investimento para sua preparação para residência?"
              value={data.rating_value}
              onChange={setRating('rating_value')}
            />
          </div>

          {/* Bloco 2: Texto aberto */}
          <div className="card-elevated p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground text-base">Sua experiência em detalhes</h2>
              <span className={`text-xs font-medium ${totalWords >= 50 ? 'text-green-500' : 'text-muted-foreground'}`}>
                {totalWords}/50 palavras
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-foreground">
                O que mais te ajudou a estudar? <span className="text-destructive">*</span>
              </label>
              <textarea
                rows={3}
                value={data.most_useful}
                onChange={setText('most_useful')}
                placeholder="Ex.: as estatísticas de desempenho, o modo de revisão..."
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-foreground">
                O que precisa melhorar com mais urgência? <span className="text-destructive">*</span>
              </label>
              <textarea
                rows={3}
                value={data.needs_improvement}
                onChange={setText('needs_improvement')}
                placeholder="Ex.: explicações das questões, filtros por especialidade..."
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-foreground">
                Quais funcionalidades você sente falta? <span className="text-destructive">*</span>
              </label>
              <textarea
                rows={3}
                value={data.missing_features}
                onChange={setText('missing_features')}
                placeholder="Ex.: simulados cronometrados, app mobile, caderno de erros..."
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
          </div>

          {/* Bloco 3: Perguntas sim/não */}
          <div className="card-elevated p-6 space-y-5">
            <h2 className="font-semibold text-foreground text-base">Rápidas</h2>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">
                Você indicaria o medlibre a um colega?
              </p>
              <div className="flex gap-3">
                {([true, false] as const).map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => setData((d) => ({ ...d, would_recommend: val }))}
                    className={`px-5 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                      data.would_recommend === val
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:border-foreground'
                    }`}
                  >
                    {val ? 'Sim' : 'Não'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">
                Você pagaria pelo medlibre quando o beta encerrar?
              </p>
              <div className="flex gap-3">
                {([true, false] as const).map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => setData((d) => ({ ...d, willing_to_pay: val }))}
                    className={`px-5 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                      data.willing_to_pay === val
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:border-foreground'
                    }`}
                  >
                    {val ? 'Sim' : 'Não'}
                  </button>
                ))}
              </div>
            </div>

            {data.willing_to_pay === true && (
              <div className="space-y-1">
                <label className="text-sm font-semibold text-foreground">
                  Quanto você pagaria por mês? (R$)
                </label>
                <input
                  type="text"
                  value={data.suggested_price}
                  onChange={setText('suggested_price')}
                  placeholder="Ex.: R$ 29,90"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}
          </div>

          {/* Bloco 4: Comentário livre */}
          <div className="card-elevated p-6 space-y-3">
            <h2 className="font-semibold text-foreground text-base">
              Comentário livre{' '}
              <span className="text-muted-foreground font-normal text-sm">(opcional)</span>
            </h2>
            <textarea
              rows={4}
              value={data.free_comment}
              onChange={setText('free_comment')}
              placeholder="Qualquer coisa que queira nos dizer — elogios, críticas, sugestões..."
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Erro */}
          {status === 'error' && (
            <div className="flex items-start gap-3 bg-destructive/10 text-destructive rounded-xl px-4 py-3 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!isValid || status === 'submitting'}
            className="w-full bg-primary text-primary-foreground font-semibold py-4 rounded-xl text-base hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
          >
            {status === 'submitting' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar feedback e ganhar 3 meses grátis →'
            )}
          </button>

          {!isValid && (
            <p className="text-center text-xs text-muted-foreground">
              Preencha todas as avaliações em estrelas, os campos de texto (mínimo 50 palavras no total) e as perguntas sim/não para habilitar o envio.
            </p>
          )}

        </form>
      </div>
    </div>
  );
}
