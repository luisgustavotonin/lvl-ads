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
  const [step, setStep] = useState('selectSections');
  const [selectedSections, setSelectedSections] = useState({
    overview: true,
    platforms: true,
    device: true,
    demographic: true,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

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
            body { font-family: Inter, system-ui, -apple-system, sans-serif; margin:0; }
            /* Remove bordas dos cards de KPI no print */
            .kpi-pdf-card { border: none !important; box-shadow: none !important; background: #f9fafb !important; }
            td, th { white-space: normal !important; word-break: break-word !important; }
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

  const handleDownloadPDF = async () => {
    setIsExporting(true);
    try {
      const content = exportRef.current;
      if (!content) return;

      const TARGET_WIDTH_PX = 1200;
      const prevWidth = content.style.width;
      const prevMaxW = content.style.maxWidth;

      content.style.width = `${TARGET_WIDTH_PX}px`;
      content.style.maxWidth = `${TARGET_WIDTH_PX}px`;

      await new Promise((r) => setTimeout(r, 400));

      const canvas = await html2canvas(content, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: TARGET_WIDTH_PX,
        windowHeight: content.scrollHeight,
        allowTaint: true,
        imageTimeout: 0,
        onclone: (clonedDocument) => {
          const images = clonedDocument.querySelectorAll('img');
          images.forEach(img => img.style.maxWidth = '100%');
          // Remove truncate nas células de tabela
          const cells = clonedDocument.querySelectorAll('td, th');
          cells.forEach(cell => {
            cell.style.whiteSpace = 'normal';
            cell.style.overflow = 'visible';
            cell.style.textOverflow = 'unset';
          });
          const spans = clonedDocument.querySelectorAll('td span, td a');
          spans.forEach(s => {
            s.style.overflow = 'visible';
            s.style.textOverflow = 'unset';
            s.style.whiteSpace = 'normal';
          });
        }
      });

      content.style.width = prevWidth;
      content.style.maxWidth = prevMaxW;

      const imgData = canvas.toDataURL('image/jpeg', 0.93);

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
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white flex-shrink-0">
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
              <div
                ref={exportRef}
                className="bg-white mx-auto"
                style={{
                  maxWidth: 1200,
                  padding: 24,
                  boxSizing: 'border-box',
                }}
              >
                {/* CSS para PDF: remove bordas dos cards, corrige tabelas */}
                <style>{`
                  /* Remove botões de edição */
                  [data-no-export="true"],
                  .no-export { display:none !important; }

                  /* KPI cards sem borda no PDF */
                  .kpi-pdf-card {
                    border: none !important;
                    box-shadow: none !important;
                    background-color: #f9fafb !important;
                    border-radius: 8px !important;
                  }
                  .kpi-pdf-card > * {
                    background-color: transparent !important;
                  }

                  /* Funil: garantir que clip-path e cores apareçam */
                  .funnel-stage {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                  }

                  /* Tabelas: texto sem corte */
                  table {
                    width: 100%;
                    table-layout: auto !important;
                  }
                  td, th {
                    white-space: normal !important;
                    word-break: break-word !important;
                    overflow: visible !important;
                    text-overflow: unset !important;
                    max-width: none !important;
                    padding: 6px 8px;
                    font-size: 11px;
                  }
                  td span {
                    white-space: normal !important;
                    overflow: visible !important;
                    text-overflow: unset !important;
                  }

                  /* Seções */
                  .pdf-section {
                    page-break-inside: avoid;
                    break-inside: avoid;
                    margin-bottom: 24px;
                  }
                `}</style>

                {/* Header */}
                <div className="border-b-2 border-gray-200 pb-6 mb-6">
                  <div className="flex items-start gap-6">
                    {unit?.logo_url ? (
                      <img src={unit.logo_url} alt={unit.name} className="w-16 h-16 rounded-lg object-contain" />
                    ) : (
                      <div
                        className="w-16 h-16 rounded-lg flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: unit?.color || '#3B82F6' }}
                      >
                        {unit?.name?.charAt(0)?.toUpperCase()}
                      </div>
                    )}

                    <div className="flex-1">
                      <h1 className="text-2xl font-bold text-gray-900 mb-1">Relatório de Performance - {unit?.name || 'Mídia Paga'}</h1>
                      <p className="text-gray-500 text-sm mb-3">Análise completa de performance publicitária</p>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 text-xs">Período</p>
                          <p className="font-semibold text-gray-900">
                            {period?.start && period?.end
                              ? `${format(period.start, 'dd/MM/yyyy')} a ${format(period.end, 'dd/MM/yyyy')}`
                              : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">KPIs Selecionados</p>
                          <p className="font-semibold text-gray-900">{selectedKPIs.length} indicadores</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Gerado em</p>
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
                      <div className="pdf-section">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">Visão Geral</h2>
                        {children.overview}
                      </div>
                    )}

                    {selectedSections.platforms && children?.platforms && (
                      <div className="pdf-section">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">Performance por Plataforma</h2>
                        {children.platforms}
                      </div>
                    )}

                    {selectedSections.device && children?.device && (
                      <div className="pdf-section">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">Performance por Device</h2>
                        {children.device}
                      </div>
                    )}

                    {selectedSections.demographic && children?.demographic && (
                      <div className="pdf-section">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">Performance Demográfica</h2>
                        {children.demographic}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}