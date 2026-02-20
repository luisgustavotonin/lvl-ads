import React from 'react';
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
    // Print only the page sections
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.7)' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-900 text-white px-6 py-3 flex-shrink-0">
        <div className="text-sm font-medium truncate">
          Exportar Relatório — <span className="font-bold">{unitName}</span>
          &nbsp;|&nbsp;
          {period.start.toLocaleDateString('pt-BR')} - {period.end.toLocaleDateString('pt-BR')}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
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
          <button onClick={onClose} className="ml-2 text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Info pane */}
      <div className="flex-1 flex items-center justify-center bg-gray-800/80">
        <div className="bg-white rounded-xl shadow-2xl p-10 max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
            <Download className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Exportar Relatório</h2>
          <p className="text-gray-500 text-sm">
            Clique em <strong>Baixar PDF</strong> para salvar o relatório ou em <strong>Imprimir</strong> para enviar para a impressora.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Button variant="outline" className="gap-2" onClick={handlePrint}>
              <Printer className="w-4 h-4" />
              Imprimir
            </Button>
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700" disabled={exporting} onClick={handleDownloadPDF}>
              <Download className="w-4 h-4" />
              {exporting ? 'Gerando...' : 'Baixar PDF'}
            </Button>
          </div>
          <p className="text-xs text-gray-400 pt-2">
            {unitName} — {period.start.toLocaleDateString('pt-BR')} até {period.end.toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>
    </div>
  );
}