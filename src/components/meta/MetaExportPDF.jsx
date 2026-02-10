import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export default function MetaExportPDF({ unitName, period, onExport }) {
  const [exporting, setExporting] = React.useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Header
      pdf.setFontSize(20);
      pdf.text(`Meta Ads Dashboard - ${unitName}`, 15, 20);
      
      pdf.setFontSize(10);
      pdf.text(`Período: ${period.start.toLocaleDateString('pt-BR')} - ${period.end.toLocaleDateString('pt-BR')}`, 15, 28);
      pdf.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 15, 34);
      
      // Capture dashboard sections
      const sections = document.querySelectorAll('[data-pdf-section]');
      let yOffset = 45;
      
      for (const section of sections) {
        const canvas = await html2canvas(section, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth - 30;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        if (yOffset + imgHeight > pageHeight - 20) {
          pdf.addPage();
          yOffset = 15;
        }
        
        pdf.addImage(imgData, 'PNG', 15, yOffset, imgWidth, imgHeight);
        yOffset += imgHeight + 10;
      }
      
      pdf.save(`meta-dashboard-${unitName}-${new Date().toISOString().split('T')[0]}.pdf`);
      if (onExport) onExport('pdf');
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      alert('Erro ao gerar PDF. Tente novamente.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={exporting}
      className="gap-2"
      variant="outline"
    >
      <Download className="w-4 h-4" />
      {exporting ? 'Gerando PDF...' : 'Exportar PDF'}
    </Button>
  );
}