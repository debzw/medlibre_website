import {
  Body,
  Button,
  Container,
  Font,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const brand = {
  gold: "#EDB92E", // Sunflower Gold — primary
  indigo: "#293452", // Twilight Indigo — secondary / header
  bgLight: "#F6F5F4", // White Smoke — outer background
  fg: "#212329", // Shadow Grey — headings + body
  muted: "#F6E4BC", // Pearl Beige — accent sections
  white: "#FFFFFF",
  mutedFg: "#7A6A4A", // warm muted text on pearl bg
};

interface BetaConversion1Props {
  firstName?: string;
  questionsAnswered?: number;
  accuracyRate?: number;
  studyDays?: number;
  totalBetaUsers?: number;
  appUrl?: string;
}

export const BetaConversion1 = ({
  firstName = "Estudante",
  questionsAnswered = 0,
  accuracyRate = 0,
  studyDays = 0,
  totalBetaUsers = 1200,
  appUrl = "https://www.medlibre.com.br",
}: BetaConversion1Props) => {
  const previewText =
    "Você foi um dos primeiros a confiar no MedLibre — e isso fez toda a diferença.";

  return (
    <Html lang="pt-BR">
      <Head>
        {/* Headings — Archivo Black */}
        <Font
          fontFamily="Archivo Black"
          fallbackFontFamily="serif"
          webFont={{
            url: "https://fonts.gstatic.com/s/archivoblack/v21/HTxqL289NzCGg4MzN6KJ7eW6OYuP_x7yx.woff2",
            format: "woff2",
          }}
          fontWeight={900}
          fontStyle="normal"
        />
        {/* Body — Lexend Deca */}
        <Font
          fontFamily="Lexend Deca"
          fallbackFontFamily="sans-serif"
          webFont={{
            url: "https://fonts.gstatic.com/s/lexenddeca/v21/K2F1fZFYk-dHSE0UPPuwQ7CrD94i-NCKm-U48MxArBPCqLNflg.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>

      <Preview>{previewText}</Preview>

      <Body style={main}>
        <Container style={container}>

          {/* ── Header ── */}
          <Section style={header}>
            <Img
              src={`${appUrl}/logo_withname.png`}
              alt="Medlibre"
              width={160}
              style={logoImg}
            />
          </Section>

          {/* Gold accent bar */}
          <Section style={goldBar} />

          {/* ── Hero ── */}
          <Section style={heroSection}>
            <Heading as="h1" style={h1}>
              Você ajudou a construir o Medlibre.
              <br />
              Obrigado, {firstName}.
            </Heading>
            <Text style={lead}>
              Há alguns meses, você confiou em uma ideia: estudar para
              residência de forma mais inteligente, sem desperdiçar horas em
              videoaulas passivas. Hoje, queremos te mostrar o que construímos
              juntos.
            </Text>
          </Section>

          <Hr style={divider} />

          {/* ── Personal Stats ── */}
          {questionsAnswered > 0 && (
            <Section style={statsSection}>
              <Heading as="h2" style={h2Pearl}>
                Seu impacto no beta
              </Heading>
              <Section style={statsRow}>
                <Section style={statCard}>
                  <Text style={statNumber}>
                    {questionsAnswered.toLocaleString("pt-BR")}
                  </Text>
                  <Text style={statLabel}>questões respondidas</Text>
                </Section>
                <Section style={statCard}>
                  <Text style={statNumber}>{accuracyRate}%</Text>
                  <Text style={statLabel}>taxa de acerto</Text>
                </Section>
                <Section style={statCard}>
                  <Text style={statNumber}>{studyDays}</Text>
                  <Text style={statLabel}>dias de estudo</Text>
                </Section>
              </Section>
            </Section>
          )}

          {/* ── Community Impact ── */}
          <Section style={lightSection}>
            <Heading as="h2" style={h2}>
              O que a comunidade conquistou
            </Heading>
            <Text style={bodyText}>
              Junto com você,{" "}
              <strong style={{ color: brand.indigo }}>
                {totalBetaUsers.toLocaleString("pt-BR")} estudantes
              </strong>{" "}
              usaram o Medlibre durante o beta. Coletivamente, respondemos
              centenas de milhares de questões — cada uma alimentando o
              algoritmo FSRS que torna o seu cronograma de revisões cada vez
              mais preciso.
            </Text>
            <Text style={bodyText}>
              Seu feedback moldou funcionalidades reais: o painel de desempenho
              por especialidade, a busca por termos DeCS, a tela de confiança
              metacognitiva. Essas features existem porque estudantes como você
              disseram o que precisavam.
            </Text>
          </Section>

          {/* ── Story — Indigo dark block ── */}
          <Section style={indigoSection}>
            <Heading as="h2" style={h2Indigo}>
              Por que construímos isso
            </Heading>
            <Text style={bodyTextIndigo}>
              O Medlibre nasceu da frustração de médicos que viveram a
              preparação para residência na pele. Horas e horas de videoaulas.
              Questões sem contexto de revisão. Plataformas que tratavam todos
              os estudantes igual, ignorando o que cada um já sabe — ou está
              prestes a esquecer.
            </Text>
            <Text style={bodyTextIndigo}>
              Queríamos a antítese disso: baseada em ciência cognitiva, guiada
              por dados, respeitosa do seu tempo.{" "}
              <span style={{ color: brand.gold }}>
                Você foi o primeiro a apostar nessa visão.
              </span>
            </Text>
          </Section>

          {/* ── What's next ── */}
          <Section style={lightSection}>
            <Heading as="h2" style={h2}>
              O que vem a seguir
            </Heading>
            <Text style={bodyText}>
              Nas próximas semanas, vamos compartilhar os próximos passos do
              Medlibre — incluindo uma oportunidade especial para quem fez parte
              do beta desde o início.
            </Text>
            <Text style={bodyText}>
              Por agora, uma coisa:{" "}
              <strong style={{ color: brand.indigo }}>continue estudando.</strong>{" "}
              Cada sessão que você faz hoje é dado que o algoritmo usa amanhã
              para te mostrar exatamente o que precisa revisar.
            </Text>
          </Section>

          {/* ── CTA ── */}
          <Section style={ctaSection}>
            <Button style={ctaButton} href={`${appUrl}/dashboard`}>
              Ver meu desempenho →
            </Button>
          </Section>

          <Hr style={divider} />

          {/* ── Sign-off ── */}
          <Section style={signoffSection}>
            <Text style={signoffText}>
              Com gratidão,
              <br />
              <strong>A equipe Medlibre</strong>
              <br />
              <em style={{ color: brand.mutedFg }}>
                Feito para quem quer passar na residência.
              </em>
            </Text>
          </Section>

          {/* ── Footer ── */}
          <Section style={footer}>
            <Text style={footerText}>
              Você está recebendo este e-mail porque faz parte do beta do
              Medlibre.
            </Text>
            <Text style={footerText}>
              <Link href={`${appUrl}/unsubscribe`} style={footerLink}>
                Cancelar inscrição
              </Link>
              {" · "}
              <Link href={`${appUrl}/privacidade`} style={footerLink}>
                Política de Privacidade
              </Link>
            </Text>
            <Text style={footerText}>
              Medlibre · CNPJ 65.628.534/0001-02 · institucional@medlibre.com.br
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
};

export default BetaConversion1;

// ─── Styles ───────────────────────────────────────────────────────────────────

const bodyFont = '"Lexend Deca", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const headingFont = '"Archivo Black", Georgia, serif';

const main: React.CSSProperties = {
  backgroundColor: brand.bgLight,
  fontFamily: bodyFont,
};

const container: React.CSSProperties = {
  backgroundColor: brand.white,
  margin: "40px auto",
  maxWidth: "600px",
  borderRadius: "12px",
  overflow: "hidden",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 6px 16px rgba(0,0,0,0.06)",
};

// Header — white background to match logo
const header: React.CSSProperties = {
  backgroundColor: brand.white,
  padding: "24px 40px",
};

const logoImg: React.CSSProperties = {
  display: "block",
};

// Sunflower Gold accent bar
const goldBar: React.CSSProperties = {
  backgroundColor: brand.gold,
  height: "4px",
  lineHeight: "4px",
  fontSize: "4px",
};

// Hero
const heroSection: React.CSSProperties = {
  padding: "40px 40px 32px",
  backgroundColor: brand.white,
};

const h1: React.CSSProperties = {
  fontFamily: headingFont,
  color: brand.fg,
  fontSize: "26px",
  fontWeight: 900,
  lineHeight: "1.3",
  margin: "0 0 16px",
  letterSpacing: "-0.3px",
};

const h2: React.CSSProperties = {
  fontFamily: headingFont,
  color: brand.fg,
  fontSize: "17px",
  fontWeight: 900,
  margin: "0 0 12px",
};

const h2Pearl: React.CSSProperties = {
  ...h2,
  color: brand.indigo,
};

const h2Indigo: React.CSSProperties = {
  fontFamily: headingFont,
  color: brand.white,
  fontSize: "17px",
  fontWeight: 900,
  margin: "0 0 12px",
};

const lead: React.CSSProperties = {
  fontFamily: bodyFont,
  color: "#4A4740",
  fontSize: "15px",
  lineHeight: "1.75",
  margin: "0",
};

const divider: React.CSSProperties = {
  borderColor: brand.muted,
  margin: "0",
};

// Stats — Pearl Beige section
const statsSection: React.CSSProperties = {
  padding: "32px 40px",
  backgroundColor: brand.muted,
};

const statsRow: React.CSSProperties = {
  marginTop: "16px",
};

const statCard: React.CSSProperties = {
  display: "inline-block",
  width: "30%",
  backgroundColor: brand.white,
  border: `1px solid rgba(237,185,46,0.3)`,
  borderRadius: "12px",
  padding: "16px 8px",
  textAlign: "center",
  margin: "0 1.5%",
  verticalAlign: "top",
};

const statNumber: React.CSSProperties = {
  fontFamily: headingFont,
  color: brand.gold,
  fontSize: "26px",
  fontWeight: 900,
  margin: "0 0 4px",
  lineHeight: "1",
};

const statLabel: React.CSSProperties = {
  fontFamily: bodyFont,
  color: brand.mutedFg,
  fontSize: "11px",
  margin: "0",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

// Regular white sections
const lightSection: React.CSSProperties = {
  padding: "32px 40px",
  backgroundColor: brand.white,
};

const bodyText: React.CSSProperties = {
  fontFamily: bodyFont,
  color: brand.fg,
  fontSize: "15px",
  lineHeight: "1.8",
  margin: "0 0 14px",
};

// Dark Indigo story section
const indigoSection: React.CSSProperties = {
  padding: "36px 40px",
  backgroundColor: brand.indigo,
};

const bodyTextIndigo: React.CSSProperties = {
  fontFamily: bodyFont,
  color: "rgba(246,245,244,0.85)",
  fontSize: "15px",
  lineHeight: "1.8",
  margin: "0 0 14px",
};

// CTA
const ctaSection: React.CSSProperties = {
  padding: "8px 40px 40px",
  textAlign: "center",
  backgroundColor: brand.white,
};

const ctaButton: React.CSSProperties = {
  backgroundColor: brand.gold,
  borderRadius: "12px",
  color: brand.fg,
  fontFamily: headingFont,
  fontSize: "15px",
  fontWeight: 900,
  textDecoration: "none",
  padding: "14px 36px",
  display: "inline-block",
  letterSpacing: "0.01em",
};

// Sign-off
const signoffSection: React.CSSProperties = {
  padding: "24px 40px 32px",
  backgroundColor: brand.white,
};

const signoffText: React.CSSProperties = {
  fontFamily: bodyFont,
  color: brand.fg,
  fontSize: "15px",
  lineHeight: "1.75",
  margin: "0",
};

// Footer
const footer: React.CSSProperties = {
  backgroundColor: brand.fg,
  padding: "24px 40px",
};

const footerText: React.CSSProperties = {
  fontFamily: bodyFont,
  color: "rgba(246,245,244,0.45)",
  fontSize: "11px",
  lineHeight: "1.6",
  margin: "0 0 6px",
  textAlign: "center",
};

const footerLink: React.CSSProperties = {
  color: "rgba(246,245,244,0.55)",
  textDecoration: "underline",
};
