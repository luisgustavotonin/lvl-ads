import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Printer } from 'lucide-react';
import html2canvas from 'html2canvas';

export default function MetaExportPDF({ unitName, period }) {
  const [open, setOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewImages, setPreviewImages] = useState([]);
  const [printing, setPrinting] = useState(false);

  const captureAll = async () => {
    setPreviewing(true);
    setPreviewImages([]);
    const sections = document.querySelectorAll('[data-pdf-section]');
    const images = [];
    for (const section of sections) {
      const canvas = await html2canvas(section, { scale: 1.5, useCORS: true });
      images.push(canvas.toDataURL('image/png'));
    }
    setPreviewImages(images);
    setPreviewing(false);
    setOpen(true);
  };

  const handlePrint = () => {
    setPrinting(true);
    const printWindow = window.open('', '_blank');
    const html = `
      <html>
        <head>
          <title>Relatório - ${unitName}</title>
          <style>
            body { margin: 0; padding: 16px; background: white; }
            img { width: 100%; display: block; margin-bottom: 24px; page-break-inside: avoid; }
            @media print { img { page-break-after: auto; } }
          </style>
        </head>
        <body>
          ${previewImages.map(src => `<img src="${src}" />`).join('')}
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    setPrinting(false);
  };

  const handleDownload = () => {
    import('jspdf').then(({ jsPDF }) => {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = pageWidth - margin * 2;

      previewImages.forEach((imgData, i) => {
        if (i > 0) pdf.addPage();
        const img = new Image();
        img.src = imgData;
        const ratio = img.naturalHeight / img.naturalWidth;
        const imgH = Math.min(imgWidth * ratio, pageHeight - margin * 2);
        pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgH);
      });

      pdf.save(`relatorio-${unitName}-${new Date().toISOString().split('T')[0]}.pdf`);
    });
  };

  return (
    <>
      <Button
        onClick={captureAll}
        disabled={previewing}
        className="gap-2"
        variant="outline"
      >
        <Download className="w-4 h-4" />
        {previewing ? 'Carregando…' : 'Exportar PDF'}
      </Button>

      {/* Preview Modal */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 bg-white border-b shrink-0">
            <h2 className="text-base font-semibold text-gray-900">Pré-visualização do Relatório — {unitName}</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={printing} className="gap-2">
                <Printer className="w-4 h-4" /> Imprimir
              </Button>
              <Button size="sm" onClick={handleDownload} className="gap-2 bg-blue-600 hover:bg-blue-700">
                <Download className="w-4 h-4" /> Baixar PDF
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Scrollable preview */}
          <div className="flex-1 overflow-y-auto bg-gray-800 p-6">
            <div className="max-w-4xl mx-auto space-y-4">
              {previewImages.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`Seção ${i + 1}`}
                  className="w-full rounded shadow-lg bg-white"
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}