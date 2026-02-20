import React from 'react';
import { X, Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export default function PDFPreviewModal({ isOpen, onClose, unitName, period }) {
  const [exporting, setExporting] = React.useState(false);
  const previewRef = React.useRef(null);

  if (!isOpen) return null;

  const handleDownloadPDF = async () => {
    setExporting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      pdf.setFontSize(18);
      pdf.text(`Relatório — ${unitName}`, margin, 20);
      pdf.setFontSize(10);
      pdf.text(
        `Período: ${period.start.toLocaleDateString('pt-BR')} — ${period.end.toLocaleDateString('pt-BR')}`,
        margin, 28
      );

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
    const sections = Array.from(document.querySelectorAll('[data-pdf-section]'));
    const html = sections.map(s => s.outerHTML).join('<hr style="margin:24px 0"/>');
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Relatório — ${unitName}</title>
      <style>
        body { font-family: sans-serif; padding: 24px; }
        @media print { body { padding: 0; } }
      </style>
      </head><body>
      <h2 style="margin-bottom:4px">Relatório — ${unitName}</h2>
      <p style="color:#888;margin-bottom:24px">
        ${period.start.toLocaleDateString('pt-BR')} — ${period.end.toLocaleDateString('pt-BR')}
      </p>
      ${html}
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  // Capture the report page content for preview
  const reportSections = document.querySelectorAll('[data-pdf-section]');

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.7)' }}>
      {/* Toolbar top */}
      <div className="flex items-center justify-between bg-gray-900 text-white px-6 py-3 flex-shrink-0">
        <div className="text-sm font-medium truncate">
          Visualizar Relatório — <span className="font-bold">{unitName}</span>
          &nbsp;|&nbsp;
          {period.start.toLocaleDateString('pt-BR')} - {period.end.toLocaleDateString('pt-BR')}
        </div>
        <button onClick={onClose} className="text-white/60 hover:text-white ml-4">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Preview area — shows actual page content */}
      <div className="flex-1 overflow-auto bg-gray-200" ref={previewRef}>
        <div className="max-w-5xl mx-auto my-6 px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
            {/* Header info */}
            <div className="border-b pb-4">
              <h2 className="text-2xl font-bold text-gray-900">Relatório — {unitName}</h2>
              <p className="text-gray-500 text-sm mt-1">
                {period.start.toLocaleDateString('pt-BR')} — {period.end.toLocaleDateString('pt-BR')}
              </p>
            </div>

            {/* Live sections from page */}
            {Array.from(reportSections).map((section, i) => (
              <div
                key={i}
                className="border rounded-lg overflow-hidden"
                dangerouslySetInnerHTML={{ __html: section.outerHTML }}
              />
            ))}

            {reportSections.length === 0 && (
              <p className="text-gray-400 text-center py-12">Nenhuma seção encontrada para exportar.</p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0 shadow-lg">
        <Button variant="outline" className="gap-2" onClick={handlePrint}>
          <Printer className="w-4 h-4" />
          Imprimir
        </Button>
        <Button className="gap-2 bg-blue-600 hover:bg-blue-700" disabled={exporting} onClick={handleDownloadPDF}>
          <Download className="w-4 h-4" />
          {exporting ? 'Gerando PDF...' : 'Baixar PDF'}
        </Button>
      </div>
    </div>
  );
}