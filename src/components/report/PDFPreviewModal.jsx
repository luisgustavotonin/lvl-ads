import React, { useRef } from 'react';
import { X, Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export default function PDFPreviewModal({ isOpen, onClose, unitName, period }) {
  const [exporting, setExporting] = React.useState(false);

  if (!isOpen) return null;

  const handleDownloadPDF = async () => {
    setExporting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      pdf.setFontSize(20);
      pdf.text(`Relatório - ${unitName}`, margin, 20);
      pdf.setFontSize(10);
      pdf.text(`Período: ${period.start.toLocaleDateString('pt-BR')} - ${period.end.toLocaleDateString('pt-BR')}`, margin, 28);

      const sections = document.querySelectorAll('[data-pdf-section]');

      for (let i = 0; i < sections.length; i++) {
        if (i > 0) pdf.addPage();
        const canvas = await html2canvas(sections[i], { scale: 1.5, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth - margin * 2;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const startY = i === 0 ? 35 : margin;
        const maxH = pageHeight - startY - margin;
        pdf.addImage(imgData, 'PNG', margin, startY, imgWidth, Math.min(imgHeight, maxH));
      }

      pdf.save(`relatorio-${unitName}-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Erro ao gerar PDF.');
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-900 text-white px-6 py-3 flex-shrink-0">
        <div className="text-sm font-medium">
          Pré-visualização do Relatório — {unitName} | {period.start.toLocaleDateString('pt-BR')} - {period.end.toLocaleDateString('pt-BR')}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/20 gap-2"
            onClick={handlePrint}
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 gap-2"
            disabled={exporting}
            onClick={handleDownloadPDF}
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Gerando...' : 'Baixar PDF'}
          </Button>
          <button onClick={onClose} className="ml-2 text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8 space-y-8 print:shadow-none print:p-0">
          {/* Title */}
          <div className="border-b pb-4">
            <h1 className="text-2xl font-bold text-gray-900">Relatório — {unitName}</h1>
            <p className="text-gray-500 mt-1">
              Período: {period.start.toLocaleDateString('pt-BR')} — {period.end.toLocaleDateString('pt-BR')}
            </p>
          </div>

          {/* Capture all data-pdf-section elements by cloning */}
          <div className="space-y-8">
            {Array.from(document.querySelectorAll('[data-pdf-section]')).map((el, i) => (
              <div
                key={i}
                className="border border-gray-100 rounded-lg overflow-hidden"
                dangerouslySetInnerHTML={{ __html: el.outerHTML }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}