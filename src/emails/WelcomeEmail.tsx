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
  gold: "#EDB92E",
  indigo: "#293452",
  bgLight: "#F6F5F4",
  fg: "#212329",
  muted: "#F6E4BC",
  white: "#FFFFFF",
  mutedFg: "#7A6A4A",
};

interface WelcomeEmailProps {
  firstName?: string;
  trialEndsAt?: string; // ex: "28 de abril de 2026"
  appUrl?: string;
}

export const WelcomeEmail = ({
  firstName = "Estudante",
  trialEndsAt = "28 de abril de 2026",
  appUrl = "https://www.medlibre.com.br",
}: WelcomeEmailProps) => {
  const previewText =
    "Seu 1 mês de Premium grátis já começou. Veja o que você pode fazer agora.";

  return (
    <Html lang="pt-BR">
      <Head>
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
              alt="MedLibre"
              width={160}
              style={logoImg}
            />
          </Section>

          {/* Gold accent bar */}
          <Section style={goldBar} />

          {/* ── Hero ── */}
          <Section style={heroSection}>
            <Heading as="h1" style={h1}>
              Bem-vindo ao MedLibre,
              <br />
              {firstName}.
            </Heading>
            <Text style={lead}>
              Obrigado por se cadastrar. Sua conta está confirmada e você já
              tem acesso completo ao{" "}
              <strong style={{ color: brand.indigo }}>
                Premium por 1 mês gratuito
              </strong>{" "}
              — sem precisar de cartão de crédito.
            </Text>
          </Section>

          <Hr style={divider} />

          {/* ── Premium trial block ── */}
          <Section style={indigoSection}>
            <Heading as="h2" style={h2Indigo}>
              Seu mês Premium já começou.
            </Heading>
            <Text style={bodyTextIndigo}>
              Você tem acesso irrestrito a todas as funcionalidades Premium
              até{" "}
              <strong style={{ color: brand.gold }}>{trialEndsAt}</strong>.
              Nenhuma cobrança será feita durante esse período.
            </Text>
            <Section style={trialBadge}>
              <Text style={trialBadgeLabel}>PERÍODO DE TESTE</Text>
              <Text style={trialBadgeValue}>30 dias grátis</Text>
              <Text style={trialBadgeSub}>válido até {trialEndsAt}</Text>
            </Section>
          </Section>

          {/* ── Features ── */}
          <Section style={lightSection}>
            <Heading as="h2" style={h2}>
              O que você pode fazer agora
            </Heading>

            <Section style={featureCard}>
              <Text style={featureTitle}>Algoritmo de repetição espaçada (FSRS)</Text>
              <Text style={featureDesc}>
                O sistema aprende o que você está prestes a esquecer e monta
                uma fila de revisões personalizada. Cada questão que você
                responde calibra o algoritmo para o seu perfil de memória.
              </Text>
            </Section>

            <Section style={featureCard}>
              <Text style={featureTitle}>Estudo Direcionado</Text>
              <Text style={featureDesc}>
                Filtre questões por especialidade, banca e tema. Concentre seu
                tempo exatamente onde precisa melhorar — sem desperdício.
              </Text>
            </Section>

            <Section style={featureCard}>
              <Text style={featureTitle}>Painel de desempenho</Text>
              <Text style={featureDesc}>
                Acompanhe sua taxa de acerto por área e veja sua evolução ao
                longo do tempo. Identifique os pontos cegos antes da prova.
              </Text>
            </Section>

            <Section style={{ ...featureCard, borderBottom: "none", marginBottom: 0 }}>
              <Text style={featureTitle}>Exportar PDF</Text>
              <Text style={featureDesc}>
                Salve qualquer lista de questões em PDF para estudar offline
                ou revisar no dia anterior à prova. Exclusivo Premium.
              </Text>
            </Section>
          </Section>

          {/* ── CTA ── */}
          <Section style={ctaSection}>
            <Button style={ctaButton} href={`${appUrl}/app`}>
              Começar a estudar →
            </Button>
          </Section>

          <Hr style={divider} />

          {/* ── Sign-off ── */}
          <Section style={signoffSection}>
            <Text style={signoffText}>
              Qualquer dúvida, basta responder este e-mail.
              <br />
              <br />
              Com gratidão,
              <br />
              <strong>A equipe MedLibre</strong>
              <br />
              <em style={{ color: brand.mutedFg }}>
                Feito para quem quer passar na residência.
              </em>
            </Text>
          </Section>

          {/* ── Footer ── */}
          <Section style={footer}>
            <Text style={footerText}>
              Você está recebendo este e-mail porque criou uma conta no MedLibre.
            </Text>
            <Text style={footerText}>
              <Link href={`${appUrl}/privacidade`} style={footerLink}>
                Política de Privacidade
              </Link>
              {" · "}
              <Link href={`${appUrl}/support`} style={footerLink}>
                Suporte
              </Link>
            </Text>
            <Text style={footerText}>
              MedLibre Treinamento Ltda · CNPJ 65.628.534/0001-02 · institucional@medlibre.com.br
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
};

export default WelcomeEmail;

// ─── Styles ───────────────────────────────────────────────────────────────────

const bodyFont =
  '"Lexend Deca", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
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

const header: React.CSSProperties = {
  backgroundColor: brand.white,
  padding: "24px 40px",
};

const logoImg: React.CSSProperties = {
  display: "block",
};

const goldBar: React.CSSProperties = {
  backgroundColor: brand.gold,
  height: "4px",
  lineHeight: "4px",
  fontSize: "4px",
};

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
  margin: "0 0 20px",
};

const h2Indigo: React.CSSProperties = {
  fontFamily: headingFont,
  color: brand.white,
  fontSize: "20px",
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

const indigoSection: React.CSSProperties = {
  padding: "36px 40px",
  backgroundColor: brand.indigo,
};

const bodyTextIndigo: React.CSSProperties = {
  fontFamily: bodyFont,
  color: "rgba(246,245,244,0.85)",
  fontSize: "15px",
  lineHeight: "1.8",
  margin: "0 0 24px",
};

const trialBadge: React.CSSProperties = {
  backgroundColor: "rgba(237,185,46,0.12)",
  border: "1px solid rgba(237,185,46,0.4)",
  borderRadius: "12px",
  padding: "20px 24px",
  textAlign: "center",
};

const trialBadgeLabel: React.CSSProperties = {
  fontFamily: bodyFont,
  fontSize: "10px",
  color: brand.gold,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  margin: "0 0 6px",
};

const trialBadgeValue: React.CSSProperties = {
  fontFamily: headingFont,
  fontSize: "32px",
  color: brand.white,
  margin: "0 0 4px",
  lineHeight: "1",
};

const trialBadgeSub: React.CSSProperties = {
  fontFamily: bodyFont,
  fontSize: "12px",
  color: "rgba(246,245,244,0.55)",
  margin: "0",
};

const lightSection: React.CSSProperties = {
  padding: "32px 40px",
  backgroundColor: brand.white,
};

const featureCard: React.CSSProperties = {
  borderBottom: `1px solid ${brand.muted}`,
  paddingBottom: "16px",
  marginBottom: "16px",
};

const featureTitle: React.CSSProperties = {
  fontFamily: headingFont,
  color: brand.indigo,
  fontSize: "14px",
  fontWeight: 900,
  margin: "0 0 6px",
  letterSpacing: "0.01em",
};

const featureDesc: React.CSSProperties = {
  fontFamily: bodyFont,
  color: brand.fg,
  fontSize: "14px",
  lineHeight: "1.75",
  margin: "0",
};

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
