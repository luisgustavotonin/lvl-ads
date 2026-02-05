import React, { useRef } from 'react';
import { X, Printer, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PdfExportModal({ 
  open, 
  onClose, 
  unit, 
  period, 
  children,
  isGenerating = false 
}) {
  const printRef = useRef(null);

  if (!open) return null;

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

  const handleDownload = () => {
    handlePrint();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-[95vw] h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Preview do Relatório</h2>
            <p className="text-sm text-gray-500">
              {unit?.name} • {period?.start && period?.end && (
                `${format(period.start, "dd 'de' MMMM", { locale: ptBR })} a ${format(period.end, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={handlePrint}
              disabled={isGenerating}
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </Button>
            <Button 
              className="gap-2 bg-blue-600 hover:bg-blue-700"
              onClick={handleDownload}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Baixar PDF
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Preview content */}
        <div className="flex-1 overflow-auto bg-gray-100 p-8">
          <div 
            ref={printRef}
            className="max-w-5xl mx-auto bg-white rounded-lg shadow-sm"
          >
            {/* Report Cover */}
            <div className="p-12 text-center border-b border-gray-100">
              {unit?.logo_url ? (
                <img 
                  src={unit.logo_url} 
                  alt={unit.name} 
                  className="w-24 h-24 mx-auto mb-6 rounded-xl object-contain"
                />
              ) : (
                <div 
                  className="w-24 h-24 mx-auto mb-6 rounded-xl flex items-center justify-center text-3xl font-bold text-white"
                  style={{ backgroundColor: unit?.color || '#3B82F6' }}
                >
                  {unit?.name?.charAt(0)?.toUpperCase()}
                </div>
              )}
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Relatório de {unit?.name || 'Mídia Paga'}
              </h1>
              <p className="text-gray-500">
                Análise de performance publicitária
              </p>
              <p className="text-sm text-gray-400 mt-4">
                {period?.start && period?.end && (
                  `Período: ${format(period.start, "dd/MM/yyyy")} a ${format(period.end, "dd/MM/yyyy")}`
                )}
              </p>
            </div>

            {/* Report Content */}
            <div className="p-8">
              {children}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 text-center text-sm text-gray-400">
              Relatório gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")} • Unified Ads Insights
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}