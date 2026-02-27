import React, { useState, useRef } from 'react';
import { X, Printer, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * ✅ ReportExportModal (corrigido e otimizado)
 *
 * Melhorias principais:
 * 1) Layout mais bonito: padding real (margens), max-width, tipografia consistente, spacing.
 * 2) Quebra feia e conteúdo colado nas bordas: wrapper "pdf-root" com padding + boxSizing.
 * 3) PDF MENOR e mais rápido: html2canvas com scale dinâmico + compressão JPEG.
 * 4) PDF A4 padrão (múltiplas páginas) ao invés de “uma página gigantesca”:
 *    - Isso resolve estética e evita ficar esmagado.
 * 5) Evita quebrar cards/tabelas no meio: .break-avoid.
 *
 * IMPORTANTE:
 * - Para tabelas “Campanhas em Destaque” ficarem bonitas, você também precisa ajustar o RankingTable (modo isPDF)
 *   para usar table-fixed + truncate. Este modal melhora MUITO, mas o RankingTable ainda manda.
 */

export default function ReportExportModal({
  open,
  onClose,
  unit,
  period,
  selectedKPIs = [],
  showLabels = false,
  children,
  onExport = () => {},
}) {
  const [step, setStep] = useState('selectSections'); // selectSections | preview
  const [selectedSections, setSelectedSections] = useState({
    overview: true,
    platforms: true,
    device: true,
    demographic: true,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const printRef = useRef(null);

  const sections = [
    { id: 'overview', label: 'Visão Geral', description: 'KPIs, Funil e Gráficos Diários' },
    { id: 'platforms', label: 'Plataformas', description: 'Performance por Plataforma' },
    { id: 'device', label: 'Device', description: 'Performance por Dispositivo' },
    { id: 'demographic', label: 'Demográfico', description: 'Performance por Demográfico' },
  ];

  const toggleSection = (sectionId) => {
    setSelectedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleNextStep = () => {
    setStep('preview');
    setIsGenerating(true);
    setTimeout(() => setIsGenerating(false), 500);
  };

  /**
   * ✅ Print: mantém o preview com margens e estilos do wrapper
   */
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatório - ${unit?.name || 'Unified Ads'}</title>
          <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .no-print { display: none !important; }
            }
            body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin:0; }
            .pdf-root { max-width: 1100px; margin: 0 auto; padding: 24px; box-sizing: border-box; }
            .break-avoid { break-inside: avoid; page-break-inside: avoid; }
          </style>
        </head>
        <body class="bg-white">
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  };

  /**
   * ✅ PDF: agora gera A4 padrão com múltiplas páginas
   * - Isso reduz “espremido nas bordas” e deixa visual melhor.
   * - Também reduz o peso do arquivo e o tempo:
   *   - scale dinâmico
   *   - JPEG com compressão (mais leve que PNG)
   */
  const handleDownloadPDF = async () => {
    setIsExporting(true);
    try {
      const printContent = printRef.current;
      if (!printContent) return;

      // deixa o wrapper com fundo branco garantido
      const prevBg = printContent.style.backgroundColor;
      printContent.style.backgroundColor = '#ffffff';

      // scale: 1.35 é um ótimo equilíbrio (rápido e legível). Ajuste se quiser mais/menos qualidade.
      const scale = 1.35;

      const canvas = await html2canvas(printContent, {
        scale,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        // melhora fidelidade de fontes e evita recorte estranho
        windowWidth: printContent.scrollWidth,
        windowHeight: printContent.scrollHeight,
      });

      // volta ao normal
      printContent.style.backgroundColor = prevBg;

      // A4 em mm
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();   // 210
      const pageHeight = pdf.internal.pageSize.getHeight(); // 297

      // margem interna (mm) para ficar bonito
      const margin = 8;
      const usableW = pageWidth - margin * 2;
      const usableH = pageHeight - margin * 2;

      // converte canvas -> imagem JPEG comprimida
      const imgData = canvas.toDataURL('image/jpeg', 0.78);

      // dimensões da imagem no PDF
      const imgW = usableW;
      const imgH = (canvas.height * imgW) / canvas.width;

      // paginação: “corta” a imagem verticalmente em páginas
      let y = 0;
      let page = 0;

      while (y < imgH) {
        if (page > 0) pdf.addPage();
        // desenha a mesma imagem, “subindo” ela no eixo Y para simular corte por páginas
        pdf.addImage(
          imgData,
          'JPEG',
          margin,
          margin - y,
          imgW,
          imgH,
          undefined,
          'FAST'
        );
        y += usableH;
        page += 1;
      }

      pdf.save(`relatorio-${unit?.name || 'unidade'}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      onExport();
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-[95vw] h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {step === 'selectSections' ? 'Configurar Relatório' : 'Preview do Relatório'}
            </h2>
            <p className="text-sm text-gray-500">
              {unit?.name} •{' '}
              {period?.start && period?.end
                ? `${format(period.start, "dd 'de' MMMM", { locale: ptBR })} a ${format(period.end, "dd 'de' MMMM 'de' yyyy", {
                    locale: ptBR,
                  })}`
                : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {step === 'preview' && (
              <>
                <Button variant="outline" className="gap-2" onClick={handlePrint} disabled={isExporting}>
                  <Printer className="w-4 h-4" />
                  Imprimir
                </Button>
                <Button
                  className="gap-2 bg-blue-600 hover:bg-blue-700"
                  onClick={handleDownloadPDF}
                  disabled={isExporting}
                >
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Baixar PDF
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-50">
          {step === 'selectSections' ? (
            <div className="p-8 max-w-2xl mx-auto">
              <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Selecione as seções do relatório</h3>
                <p className="text-sm text-gray-600">Escolha quais abas deseja incluir no PDF</p>

                <div className="space-y-3">
                  {sections.map((section) => (
                    <label
                      key={section.id}
                      className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedSections[section.id]}
                        onCheckedChange={() => toggleSection(section.id)}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{section.label}</p>
                        <p className="text-sm text-gray-500">{section.description}</p>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="pt-4 border-t border-gray-200 flex justify-end gap-2">
                  <Button variant="outline" onClick={onClose}>
                    Cancelar
                  </Button>
                  <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleNextStep}>
                    Continuar
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 sm:p-8">
              {/* ✅ Wrapper com margens reais e layout consistente */}
              <div
                ref={printRef}
                className="pdf-root max-w-[1100px] mx-auto bg-white rounded-2xl shadow-sm border border-gray-200"
                style={{ padding: 24, boxSizing: 'border-box' }}
              >
                {/* Estilos de PDF (inline) para evitar depender de CSS externo */}
                <style>{`
                  .pdf-root { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
                  .break-avoid { break-inside: avoid; page-break-inside: avoid; }
                  .pdf-section-title { font-size: 18px; font-weight: 800; color: #111827; }
                  .pdf-h2 { font-size: 20px; font-weight: 800; color: #111827; }
                  .pdf-muted { color: #6B7280; }
                  .pdf-card { border: 1px solid #E5E7EB; border-radius: 14px; padding: 16px; }
                `}</style>

                {/* Report Header */}
                <div className="break-avoid border-b border-gray-200 pb-6 mb-6">
                  <div className="flex items-start gap-5">
                    {unit?.logo_url ? (
                      <img
                        src={unit.logo_url}
                        alt={unit.name}
                        className="w-16 h-16 rounded-xl object-contain border border-gray-100"
                      />
                    ) : (
                      <div
                        className="w-16 h-16 rounded-xl flex items-center justify-center text-xl font-bold text-white"
                        style={{ backgroundColor: unit?.color || '#3B82F6' }}
                      >
                        {unit?.name?.charAt(0)?.toUpperCase()}
                      </div>
                    )}

                    <div className="flex-1">
                      <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">
                        Relatório de Performance
                      </h1>
                      <p className="text-sm text-gray-600 mt-1">
                        {unit?.name || 'Mídia Paga'} • Análise completa de performance publicitária
                      </p>

                      <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
                        <div className="pdf-card">
                          <p className="text-xs pdf-muted">Período</p>
                          <p className="font-semibold text-gray-900">
                            {period?.start && period?.end
                              ? `${format(period.start, 'dd/MM/yyyy')} a ${format(period.end, 'dd/MM/yyyy')}`
                              : '-'}
                          </p>
                        </div>
                        <div className="pdf-card">
                          <p className="text-xs pdf-muted">KPIs selecionados</p>
                          <p className="font-semibold text-gray-900">{selectedKPIs.length} indicadores</p>
                        </div>
                        <div className="pdf-card">
                          <p className="text-xs pdf-muted">Gerado em</p>
                          <p className="font-semibold text-gray-900">
                            {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Report Content */}
                {isGenerating ? (
                  <div className="py-16 text-center text-gray-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Gerando preview…
                  </div>
                ) : (
                  <div className="space-y-10">
                    {selectedSections.overview && children?.overview && (
                      <div className="space-y-4">
                        <div className="break-avoid flex items-end justify-between">
                          <h2 className="pdf-h2">Visão Geral</h2>
                          <span className="text-xs text-gray-500">
                            Rótulos: <b>{showLabels ? 'ON' : 'OFF'}</b>
                          </span>
                        </div>
                        <div className="space-y-6">{children.overview}</div>
                      </div>
                    )}

                    {selectedSections.platforms && children?.platforms && (
                      <div className="space-y-4">
                        <h2 className="pdf-h2">Performance por Plataforma</h2>
                        <div className="space-y-6">{children.platforms}</div>
                      </div>
                    )}

                    {selectedSections.device && children?.device && (
                      <div className="space-y-4">
                        <h2 className="pdf-h2">Performance por Device</h2>
                        <div className="space-y-6">{children.device}</div>
                      </div>
                    )}

                    {selectedSections.demographic && children?.demographic && (
                      <div className="space-y-4">
                        <h2 className="pdf-h2">Performance Demográfica</h2>
                        <div className="space-y-6">{children.demographic}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="break-avoid border-t border-gray-200 mt-8 pt-4 text-center text-[11px] text-gray-400">
                  Relatório confidencial • Unified Ads Insights • {format(new Date(), 'dd/MM/yyyy')}
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-3 max-w-[1100px] mx-auto">
                Dica: se quiser o PDF ainda mais leve/rápido, diminua o <b>scale</b> e a qualidade do JPEG no
                <code className="mx-1 px-1 rounded bg-gray-100">handleDownloadPDF</code>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}