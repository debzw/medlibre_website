import React from 'react';

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Política de Privacidade</h1>
      <p className="text-sm text-muted-foreground mb-8">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

      <div className="space-y-6 text-foreground/90 leading-relaxed">
        <section>
          <h2 className="text-2xl font-semibold mb-3 text-primary">1. Introdução</h2>
          <p>
            Bem-vindo ao MedLibre. Nós nos levamos a sério a sua privacidade e a proteção dos seus dados pessoais. 
            Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e compartilhamos suas informações 
            ao utilizar nossa plataforma, em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-primary">2. Dados que Coletamos</h2>
          <p className="mb-2">Coletamos os seguintes tipos de informações:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Dados de Cadastro:</strong> Nome, e-mail e imagem de perfil (quando fornecida via Google).</li>
            <li><strong>Dados de Uso:</strong> Estatísticas de estudo, desempenho em questões, histórico de acessos e preferências de estudo.</li>
            <li><strong>Dados Técnicos:</strong> Endereço IP, tipo de navegador, sistema operacional e interações com a plataforma.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-primary">3. Finalidade do Tratamento</h2>
          <p className="mb-2">Utilizamos seus dados para:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Fornecer e personalizar nossos serviços.</li>
            <li>Gerar relatórios de desempenho e guias de estudo personalizados.</li>
            <li>Enviar comunicações importantes sobre sua conta ou atualizações da plataforma.</li>
            <li>Melhorar a segurança e prevenir fraudes.</li>
            <li>Cumprir obrigações legais e regulatórias.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-primary">4. Compartilhamento de Dados</h2>
          <p>
            Não vendemos seus dados pessoais. Podemos compartilhar informações com prestadores de serviços terceiros 
            estritamente para a operação da plataforma (ex: hospedagem, autenticação via Google, processamento de pagamentos), 
            sempre exigindo conformidade com a LGPD.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-primary">5. Cookies</h2>
          <p>
            Utilizamos cookies para melhorar sua experiência, lembrar suas preferências e analisar o tráfego. 
            Você pode gerenciar suas preferências de cookies através das configurações do seu navegador ou do nosso banner de consentimento.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-primary">6. Seus Direitos (LGPD)</h2>
          <p className="mb-2">Você tem direito a:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Confirmar a existência de tratamento de dados.</li>
            <li>Acessar seus dados.</li>
            <li>Corrigir dados incompletos, inexatos ou desatualizados.</li>
            <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários.</li>
            <li>Revogar seu consentimento a qualquer momento.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-primary">7. Segurança</h2>
          <p>
            Adotamos medidas técnicas e administrativas aptas a proteger seus dados pessoais de acessos não autorizados 
            e de situações acidentais ou ilícitas de destruição, perda, alteração, comunicação ou difusão.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-primary">8. Contato</h2>
          <p>
            Para exercer seus direitos ou tirar dúvidas sobre esta Política de Privacidade, entre em contato conosco pelo e-mail: 
            <a href="mailto:medlibre64@gmail.com" className="text-primary hover:underline ml-1">medlibre64@gmail.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
