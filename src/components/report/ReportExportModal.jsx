import React, { useState, useRef } from 'react';
import { X, Printer, Download, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
  onExport = () => {}
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
    setTimeout(() => setIsGenerating(false), 1000);
  };

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
            body { font-family: 'Inter', system-ui, sans-serif; }
            .pdf-header { page-break-after: avoid; }
            .pdf-section { page-break-inside: avoid; }
          </style>
        </head>
        <body class="bg-white p-8">
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const handleDownloadPDF = async () => {
    setIsExporting(true);
    try {
      const printContent = printRef.current;
      if (!printContent) return;

      const canvas = await html2canvas(printContent, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = pageWidth - margin * 2;

      const imgData = canvas.toDataURL('image/png');
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let position = margin;
      let heightLeft = imgHeight;

      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - margin * 2;
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
              {unit?.name} • {period?.start && period?.end && (
                `${format(period.start, "dd 'de' MMMM", { locale: ptBR })} a ${format(period.end, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {step === 'preview' && (
              <>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handlePrint}
                  disabled={isExporting}
                >
                  <Printer className="w-4 h-4" />
                  Imprimir
                </Button>
                <Button
                  className="gap-2 bg-blue-600 hover:bg-blue-700"
                  onClick={handleDownloadPDF}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
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
                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={handleNextStep}
                  >
                    Continuar
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8">
              <div
                ref={printRef}
                className="max-w-5xl mx-auto bg-white rounded-lg shadow-sm space-y-8"
              >
                {/* Report Header */}
                <div className="pdf-header border-b-2 border-gray-200 pb-8">
                  <div className="flex items-start gap-6 mb-6">
                    {unit?.logo_url ? (
                      <img
                        src={unit.logo_url}
                        alt={unit.name}
                        className="w-20 h-20 rounded-lg object-contain"
                      />
                    ) : (
                      <div
                        className="w-20 h-20 rounded-lg flex items-center justify-center text-2xl font-bold text-white"
                        style={{ backgroundColor: unit?.color || '#3B82F6' }}
                      >
                        {unit?.name?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1">
                      <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Relatório de Performance - {unit?.name || 'Mídia Paga'}
                      </h1>
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
                          <p className="font-semibold text-gray-900">
                            {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Report Content */}
                {selectedSections.overview && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-900">Visão Geral</h2>
                    {children && children.overview ? (
                      children.overview
                    ) : (
                      <div className="text-gray-500">Seção em carregamento...</div>
                    )}
                  </div>
                )}

                {selectedSections.platforms && children?.platforms && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-900">Performance por Plataforma</h2>
                    {children.platforms}
                  </div>
                )}

                {selectedSections.device && children?.device && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-900">Performance por Device</h2>
                    {children.device}
                  </div>
                )}

                {selectedSections.demographic && children?.demographic && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-900">Performance Demográfica</h2>
                    {children.demographic}
                  </div>
                )}

                {/* Footer */}
                <div className="border-t border-gray-200 pt-4 text-center text-xs text-gray-400">
                  Relatório confidencial • Unified Ads Insights • {format(new Date(), "dd/MM/yyyy")}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}