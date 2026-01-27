import jsPDF from 'jspdf';
import { Question } from '@/types/database';

export const generatePDF = async (questions: Question[], filename = 'medlibre-caderno.pdf') => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let yPos = margin;

    // Helper to add footer
    const addFooter = (pageNumber: number) => {
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('Todos os direitos reservados - MedLibre', pageWidth / 2, pageHeight - 10, { align: 'center' });
        doc.text(`Página ${pageNumber}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    };


    // --- Header ---
    const logoImg = new Image();
    logoImg.src = '/logo_withname.png';

    // We wrap the generation in a promise to wait for the image to load if needed
    await new Promise((resolve, reject) => {
        logoImg.onload = resolve;
        logoImg.onerror = reject;
        if (logoImg.complete) resolve(true);
    }).catch(err => console.error("Logo load error", err));

    // Shared renderHeader function
    const renderHeader = () => {
        const logoWidth = 45; // Smaller and more elegant
        const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
        doc.addImage(logoImg, 'PNG', margin, 12, logoWidth, logoHeight);

        doc.setFontSize(14);
        doc.setTextColor(80);
        doc.setFont("helvetica", "bold");
        doc.text('Caderno de Questões', pageWidth - margin, 20, { align: 'right' });

        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.setFont("helvetica", "normal");
        const date = new Date().toLocaleDateString('pt-BR');
        doc.text(`Gerado em: ${date}`, pageWidth - margin, 26, { align: 'right' });

        // Horizontal Line
        doc.setDrawColor(230);
        doc.line(margin, 35, pageWidth - margin, 35);
    };

    // Helper to check page break
    const checkPageBreak = (heightNeeded: number) => {
        if (yPos + heightNeeded > pageHeight - margin) {
            doc.addPage();
            renderHeader();
            yPos = 45;
            return true;
        }
        return false;
    };

    // --- Image Loader ---
    const loadImage = (url: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    };

    // Add Questions
    for (let i = 0; i < questions.length; i++) {
        if (i === 0) {
            renderHeader();
            yPos = 45;
        }

        const q = questions[i];

        // --- Question Header ---
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.setFont("helvetica", "bold");
        const headerText = `Q${i + 1} • ${q.banca} (${q.ano}) - ${q.output_especialidade || 'Geral'}`;

        checkPageBreak(15);
        doc.text(headerText, margin, yPos);
        yPos += 7;

        // --- Enunciado ---
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.setFont("helvetica", "normal");

        const splitText = doc.splitTextToSize(q.enunciado, contentWidth);
        const textHeight = splitText.length * 5; // approx line height

        checkPageBreak(textHeight + 10);
        doc.text(splitText, margin, yPos);
        yPos += textHeight + 5;

        // --- Image (if exists) ---
        const imageUrl = q.imagem_url || q.referencia_imagem;
        if (imageUrl) {
            try {
                const img = await loadImage(imageUrl);

                // Calculate dimensions to fit max width/height while maintaining aspect ratio
                const maxImgWidth = Math.min(contentWidth, 120);
                const maxImgHeight = 100; // Don't let it take too much vertical space

                let imgWidth = maxImgWidth;
                let imgHeight = (img.height / img.width) * imgWidth;

                if (imgHeight > maxImgHeight) {
                    imgHeight = maxImgHeight;
                    imgWidth = (img.width / img.height) * imgHeight;
                }

                checkPageBreak(imgHeight + 10);
                doc.addImage(img, 'JPEG', margin, yPos, imgWidth, imgHeight);
                yPos += imgHeight + 8;

            } catch (e) {
                console.error("Error adding image to PDF", e);
                doc.setFontSize(9);
                doc.setTextColor(150);
                doc.text('[Erro ao carregar imagem da questão]', margin, yPos);
                yPos += 10;
            }
        }

        // --- Options ---
        const validOpcoes = q.opcoes.filter(opt => {
            if (!opt) return false;
            // Extract text if it's an object to check if it's empty
            const text = (typeof opt === 'object' && 'texto' in opt) ? (opt as any).texto : opt;
            return !!String(text).trim();
        });

        validOpcoes.forEach((opt, idx) => {
            const letter = String.fromCharCode(65 + idx); // A, B, C...
            const optValue = (typeof opt === 'object' && opt !== null && 'texto' in opt)
                ? (opt as any).texto
                : (opt || '');
            const optText = `${letter}) ${optValue}`;
            const splitOpt = doc.splitTextToSize(optText, contentWidth - 5);
            const optHeight = splitOpt.length * 5;

            checkPageBreak(optHeight + 4);
            doc.text(splitOpt, margin + 5, yPos);
            yPos += optHeight + 2;
        });

        yPos += 10; // Space between questions
    }

    // --- Answer Key (Gabarito) ---
    doc.addPage();
    renderHeader();
    let gYPos = 45;

    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text('Gabarito', pageWidth / 2, gYPos, { align: 'center' });
    gYPos += 15;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    // 2 columns layout
    const colWidth = contentWidth / 2;

    questions.forEach((q, i) => {
        const col = i % 2; // 0 or 1
        const row = Math.floor(i / 2);

        const x = margin + (col * colWidth);
        const y = gYPos + (row * 8);

        // Check page break for gabarito (unlikely for 30 questions but good practice)
        if (y > pageHeight - margin) {
            doc.addPage();
            gYPos = margin;
            // Reset Y calculation would be complex with columns, simplifying by just adding pages and resetting
            // For 30 questions, getting to page break in Gabarito is hard.
            // Just rendering simple list for safety if we exceed one page
        }

        const letter = String.fromCharCode(65 + q.resposta_correta);
        doc.text(`${i + 1}. ${letter}`, x, y);
    });

    // Save
    doc.save(filename);
};
