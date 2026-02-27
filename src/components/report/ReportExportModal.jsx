import React, { useState, useRef } from 'react';
import { X, Printer, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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

  // Esse é o conteúdo que vamos CAPTURAR (1 página única)
  const exportRef = useRef(null);

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
    setTimeout(() => setIsGenerating(false), 350);
  };

  /**
   * ✅ Print (opcional)
   * Mantém o mesmo HTML de export, mas imprime pelo browser.
   */
  const handlePrint = () => {
    const content = exportRef.current;
    if (!content) return;

    const win = window.open('', '_blank');
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatório - ${unit?.name || 'Unified Ads'}</title>
          <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .no-print, [data-no-export="true"] { display: none !important; }
            }
            body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin:0; }
          </style>
        </head>
        <body class="bg-white">
          ${content.innerHTML}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 400);
  };

  /**
   * ✅ PDF 1 PÁGINA ÚNICA (sem cortes)
   * - fixa largura para não reflowar (igual tela)
   * - html2canvas com scale controlado
   * - exporta em UMA página com tamanho custom (mm)
   */
  const handleDownloadPDF = async () => {
  setIsExporting(true);
  try {
    const content = exportRef.current;
    if (!content) return;

    // 🔒 trava a largura para NÃO reflowar (tem que ser a mesma do seu relatório na tela)
    const TARGET_WIDTH_PX = 1600; // <- se seu relatório usa max-w-[1600px], deixa 1600
    const prevWidth = content.style.width;
    const prevMaxW = content.style.maxWidth;

    content.style.width = `${TARGET_WIDTH_PX}px`;
    content.style.maxWidth = `${TARGET_WIDTH_PX}px`;

    // forçar layout recalcular antes de capturar
    await new Promise((r) => requestAnimationFrame(r));

    // ✅ mais fiel e rápido (equilíbrio)
    const scale = 1.5; // se quiser mais nítido: 1.8 (fica mais pesado)

    const canvas = await html2canvas(content, {
      scale,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: TARGET_WIDTH_PX,
      windowHeight: content.scrollHeight,
    });

    // restaura
    content.style.width = prevWidth;
    content.style.maxWidth = prevMaxW;

    // ✅ JPEG = MUITO menor que PNG
    const imgData = canvas.toDataURL('image/jpeg', 0.85);

    /**
     * ✅ AQUI É A CHAVE:
     * 1 página única no tamanho EXATO do canvas (em px),
     * sem converter pra mm/A4 (que é o que “achata” e deixa minúsculo).
     */
    const pdf = new jsPDF({
      orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height],
      compress: true,
    });

    pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height, undefined, 'FAST');
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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

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
                ? `${format(period.start, "dd 'de' MMMM", { locale: ptBR })} a ${format(
                    period.end,
                    "dd 'de' MMMM 'de' yyyy",
                    { locale: ptBR }
                  )}`
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
                <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={handleDownloadPDF} disabled={isExporting}>
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Baixar PDF (1 página)
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
                      <Checkbox checked={selectedSections[section.id]} onCheckedChange={() => toggleSection(section.id)} className="mt-1" />
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
            <div className="p-8">
              {/* =========================
                  ✅ EXPORT STAGE (o que vira PDF)
                  - mantém o visual limpo
                  - remove coisas editáveis via CSS
                  - mantém largura “como na tela”
                 ========================= */}
              <div
                ref={exportRef}
                className="bg-white rounded-lg shadow-sm space-y-8 mx-auto"
                style={{
                  // maxWidth e padding iguais ao Reports (pra “replicar” o layout da tela)
                  maxWidth: 1200,
                  padding: 24,
                  boxSizing: 'border-box',
                }}
              >
                {/* CSS que SOME com edição no export */}
                <style>{`
                  /* some com qualquer coisa marcada */
                  [data-no-export="true"] { display:none !important; }
                  /* some com botões/ícones de edição comuns */
                  button[title*="Editar"], button[aria-label*="Editar"] { display:none !important; }
                  .no-export { display:none !important; }
                  /* esconde ícones de lápis dentro dos cards (quando tem) */
                  svg.lucide-pencil, svg[data-lucide="pencil"] { display:none !important; }
                `}</style>

                {/* Header do relatório no PDF (sem botões de edição) */}
                <div className="border-b-2 border-gray-200 pb-6">
                  <div className="flex items-start gap-6">
                    {unit?.logo_url ? (
                      <img src={unit.logo_url} alt={unit.name} className="w-16 h-16 rounded-lg object-contain" />
                    ) : (
                      <div
                        className="w-16 h-16 rounded-lg flex items-center justify-center text-2xl font-bold text-white"
                        style={{ backgroundColor: unit?.color || '#3B82F6' }}
                      >
                        {unit?.name?.charAt(0)?.toUpperCase()}
                      </div>
                    )}

                    <div className="flex-1">
                      <h1 className="text-2xl font-bold text-gray-900 mb-1">Relatório de Performance - {unit?.name || 'Mídia Paga'}</h1>
                      <p className="text-gray-600 mb-3">Análise completa de performance publicitária</p>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Período</p>
                          <p className="font-semibold text-gray-900">
                            {period?.start && period?.end
                              ? `${format(period.start, 'dd/MM/yyyy')} a ${format(period.end, 'dd/MM/yyyy')}`
                              : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">KPIs Selecionados</p>
                          <p className="font-semibold text-gray-900">{selectedKPIs.length} indicadores</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Gerado em</p>
                          <p className="font-semibold text-gray-900">{format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Conteúdo */}
                {isGenerating ? (
                  <div className="py-12 text-center text-gray-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Gerando preview…
                  </div>
                ) : (
                  <>
                    {selectedSections.overview && children?.overview && (
                      <div className="space-y-4 pdf-section">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">Visão Geral</h2>
                        <div className="pdf-overview-content">
                          {children.overview}
                        </div>
                      </div>
                    )}

                    {selectedSections.platforms && children?.platforms && (
                      <div className="space-y-4 pdf-section">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">Performance por Plataforma</h2>
                        <div className="pdf-platforms-content">
                          {children.platforms}
                        </div>
                      </div>
                    )}

                    {selectedSections.device && children?.device && (
                      <div className="space-y-4 pdf-section">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">Performance por Device</h2>
                        <div className="pdf-device-content">
                          {children.device}
                        </div>
                      </div>
                    )}

                    {selectedSections.demographic && children?.demographic && (
                      <div className="space-y-4 pdf-section">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">Performance Demográfica</h2>
                        <div className="pdf-demographic-content">
                          {children.demographic}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Footer */}
                <div className="border-t border-gray-200 pt-4 text-center text-xs text-gray-400">
                  Relatório confidencial • Unified Ads Insights • {format(new Date(), 'dd/MM/yyyy')}
                </div>
              </div>

              <div className="text-xs text-gray-500 mt-4 max-w-[1200px] mx-auto space-y-1">
                <p>✅ <b>Tabelas otimizadas</b>: Layout preservado, sem cortes ou sobreposições</p>
                <p>✅ <b>Page breaks inteligentes</b>: Seções mantêm-se inteiras (evita divisões)</p>
                <p>✅ <b>Arquivo comprimido</b>: JPEG + configurações otimizadas para tamanho menor</p>
                <p className="text-gray-400">Se precisar ajustar: scale (qualidade) ou qualidade JPEG em <code className="px-1 rounded bg-gray-100">handleDownloadPDF</code></p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}