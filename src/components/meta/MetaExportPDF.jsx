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
      const margin = 15;
      
      // Página 1: KPIs
      pdf.setFontSize(20);
      pdf.text(`Relatório - ${unitName}`, margin, 20);
      pdf.setFontSize(10);
      pdf.text(`Período: ${period.start.toLocaleDateString('pt-BR')} - ${period.end.toLocaleDateString('pt-BR')}`, margin, 28);
      
      const kpiSection = document.querySelector('[data-pdf-section]:first-of-type');
      if (kpiSection) {
        const canvas = await html2canvas(kpiSection, { scale: 1.5 });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth - (margin * 2);
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', margin, 35, imgWidth, imgHeight);
      }
      
      // Página 2: Funil (metade superior) + 2 gráficos (metade inferior)
      pdf.addPage();
      
      const funnelSection = document.querySelectorAll('[data-pdf-section]')[1];
      if (funnelSection) {
        const canvas = await html2canvas(funnelSection, { scale: 1.5 });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth - (margin * 2);
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const maxHeight = (pageHeight / 2) - margin;
        const finalHeight = Math.min(imgHeight, maxHeight);
        pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, finalHeight);
      }
      
      // 2 gráficos lado a lado (Investimento e Impressões)
      const chartSections = document.querySelectorAll('[data-pdf-section]');
      const investChart = chartSections[2]; // Investimento
      const impressChart = chartSections[3]; // Impressões
      
      const halfWidth = (pageWidth - (margin * 3)) / 2;
      const yPosCharts = (pageHeight / 2) + 5;
      
      if (investChart) {
        const canvas = await html2canvas(investChart, { scale: 1.2 });
        const imgData = canvas.toDataURL('image/png');
        const imgHeight = (canvas.height * halfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', margin, yPosCharts, halfWidth, imgHeight);
      }
      
      if (impressChart) {
        const canvas = await html2canvas(impressChart, { scale: 1.2 });
        const imgData = canvas.toDataURL('image/png');
        const imgHeight = (canvas.height * halfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', margin + halfWidth + margin, yPosCharts, halfWidth, imgHeight);
      }
      
      // Página 3: 4 gráficos (Alcance, CTR, Conversas, Custo)
      pdf.addPage();
      
      const reachChart = chartSections[4];
      const ctrChart = chartSections[5];
      const convChart = chartSections[6];
      const costChart = chartSections[7];
      
      const chartHeight = (pageHeight - (margin * 3)) / 2;
      
      if (reachChart) {
        const canvas = await html2canvas(reachChart, { scale: 1.2 });
        const imgData = canvas.toDataURL('image/png');
        const imgHeight = (canvas.height * halfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', margin, margin, halfWidth, Math.min(imgHeight, chartHeight));
      }
      
      if (ctrChart) {
        const canvas = await html2canvas(ctrChart, { scale: 1.2 });
        const imgData = canvas.toDataURL('image/png');
        const imgHeight = (canvas.height * halfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', margin + halfWidth + margin, margin, halfWidth, Math.min(imgHeight, chartHeight));
      }
      
      if (convChart) {
        const canvas = await html2canvas(convChart, { scale: 1.2 });
        const imgData = canvas.toDataURL('image/png');
        const imgHeight = (canvas.height * halfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', margin, margin + chartHeight + margin, halfWidth, Math.min(imgHeight, chartHeight));
      }
      
      if (costChart) {
        const canvas = await html2canvas(costChart, { scale: 1.2 });
        const imgData = canvas.toDataURL('image/png');
        const imgHeight = (canvas.height * halfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', margin + halfWidth + margin, margin + chartHeight + margin, halfWidth, Math.min(imgHeight, chartHeight));
      }
      
      // Páginas seguintes: Tabelas (Campanhas, Conjuntos, Anúncios)
      const tables = Array.from(chartSections).slice(8);
      for (const table of tables) {
        pdf.addPage();
        const canvas = await html2canvas(table, { scale: 1.5 });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth - (margin * 2);
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        let yOffset = margin;
        if (imgHeight > pageHeight - (margin * 2)) {
          // Se a tabela for muito alta, dividir em páginas
          const maxHeight = pageHeight - (margin * 2);
          pdf.addImage(imgData, 'PNG', margin, yOffset, imgWidth, maxHeight);
        } else {
          pdf.addImage(imgData, 'PNG', margin, yOffset, imgWidth, imgHeight);
        }
      }
      
      pdf.save(`relatorio-${unitName}-${new Date().toISOString().split('T')[0]}.pdf`);
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