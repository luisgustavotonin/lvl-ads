import React, { useState, useRef } from 'react';
import { X, Printer, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { base44 } from '@/api/base44Client';

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
    creatives: true,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const exportRef = useRef(null);

  const sections = [
    { id: 'overview', label: 'Visão Geral', description: 'KPIs, Funil e Gráficos Diários' },
    { id: 'platforms', label: 'Plataformas', description: 'Performance por Plataforma' },
    { id: 'device', label: 'Dispositivos', description: 'Performance por Dispositivo' },
    { id: 'demographic', label: 'Idade e Gênero', description: 'Performance Demográfica' },
    { id: 'creatives', label: 'Criativos', description: 'Galeria de Criativos e Performance' },
  ];

  const toggleSection = (id) =>
    setSelectedSections((prev) => ({ ...prev, [id]: !prev[id] }));

  const selectAllSections = () =>
    setSelectedSections({ overview: true, platforms: true, device: true, demographic: true, creatives: true });

  const handleNextStep = () => {
    setStep('preview');
    setIsGenerating(true);
    setTimeout(() => setIsGenerating(false), 500);
  };

  const handlePrint = () => {
    const content = exportRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Relatório - ${unit?.name || 'Unified Ads'}</title>
      <style>body{font-family:system-ui,Arial,sans-serif;margin:0;} @media print{body{-webkit-print-color-adjust:exact;}}</style>
      </head><body>${content.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); win.close(); }, 400);
  };

  const handleDownloadPDF = async () => {
    setIsExporting(true);
    try {
      const content = exportRef.current;
      if (!content) return;

      // — Collect ALL images and proxy them to base64 —
      const imgElements = Array.from(content.querySelectorAll('img[src]'));
      const uniqueUrls = [...new Set(
        imgElements.map((img) => img.getAttribute('src'))
          .filter((src) => src && !src.startsWith('data:'))
      )];

      const imgMap = {};
      if (uniqueUrls.length > 0) {
        await Promise.allSettled(
          uniqueUrls.map(async (url) => {
            try {
              const res = await base44.functions.invoke('proxyImage', { url });
              if (res?.data?.dataUrl) imgMap[url] = res.data.dataUrl;
            } catch {}
          })
        );
      }

      // — Fix layout for full capture —
      const TARGET_W = 1400;
      const prevWidth = content.style.width;
      const prevMaxW = content.style.maxWidth;
      const prevOverflow = content.style.overflow;
      content.style.width = `${TARGET_W}px`;
      content.style.maxWidth = `${TARGET_W}px`;
      content.style.overflow = 'visible';

      // Scroll container to top
      const scrollBox = content.closest('.overflow-auto');
      if (scrollBox) scrollBox.scrollTop = 0;

      await new Promise((r) => setTimeout(r, 800));

      const totalHeight = content.scrollHeight + 60;

      const canvas = await html2canvas(content, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: TARGET_W,
        windowHeight: totalHeight,
        height: totalHeight,
        imageTimeout: 0,
        onclone: (clonedDoc) => {
          // Replace img src with base64
          clonedDoc.querySelectorAll('img[src]').forEach((img) => {
            const orig = img.getAttribute('src');
            if (imgMap[orig]) {
              img.src = imgMap[orig];
              img.crossOrigin = undefined;
            }
          });
          // Fix table cells: no wrap
          clonedDoc.querySelectorAll('th, td').forEach((cell) => {
            cell.style.whiteSpace = 'nowrap';
            cell.style.overflow = 'visible';
          });
          // First column can wrap (name)
          clonedDoc.querySelectorAll('td:first-child').forEach((cell) => {
            cell.style.whiteSpace = 'normal';
            cell.style.maxWidth = '260px';
          });
        },
      });

      // Restore
      content.style.width = prevWidth;
      content.style.maxWidth = prevMaxW;
      content.style.overflow = prevOverflow;

      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
        compress: true,
      });
      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height, undefined, 'FAST');
      pdf.save(`relatorio-${(unit?.name || 'unidade').replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      onExport();
    } catch (err) {
      console.error('PDF error:', err);
      alert('Erro ao gerar PDF. Tente novamente.');
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
                ? `${format(period.start, "dd 'de' MMMM", { locale: ptBR })} a ${format(period.end, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`
                : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {step === 'preview' && (
              <>
                <Button variant="outline" className="gap-2" onClick={handlePrint} disabled={isExporting}>
                  <Printer className="w-4 h-4" /> Imprimir
                </Button>
                <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={handleDownloadPDF} disabled={isExporting}>
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {isExporting ? 'Gerando PDF...' : 'Baixar PDF'}
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

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllSections} className="text-xs">
                    Selecionar Todas
                  </Button>
                </div>

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
                  <Button variant="outline" onClick={onClose}>Cancelar</Button>
                  <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleNextStep}>Continuar</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8">
              <div
                ref={exportRef}
                className="bg-white rounded-lg shadow-sm mx-auto"
                style={{ maxWidth: 1200, padding: 32, boxSizing: 'border-box' }}
              >
                {/* Global CSS for PDF rendering */}
                <style>{`
                  [data-no-export="true"] { display: none !important; }
                  button[title*="Editar"], button[aria-label*="Editar"] { display: none !important; }
                  .no-export { display: none !important; }
                  svg.lucide-pencil { display: none !important; }

                  table { table-layout: auto; width: 100%; border-collapse: collapse; }
                  table th, table td { white-space: nowrap; overflow: visible; text-overflow: clip; vertical-align: middle; }
                  table td:first-child { white-space: normal; max-width: 260px; word-break: break-word; }
                  table thead tr { background-color: #f8fafc; }
                  table tbody tr:nth-child(even) { background-color: #f8fafc; }
                  table tbody tr { border-bottom: 1px solid #e5e7eb; }

                  .pdf-section + .pdf-section { margin-top: 40px; }
                `}</style>

                {/* PDF Header */}
                <div className="flex items-start gap-6 pb-6 mb-6 border-b-2 border-gray-200">
                  {unit?.logo_url ? (
                    <img src={unit.logo_url} alt={unit.name} className="w-16 h-16 rounded-lg object-contain flex-shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: unit?.color || '#3B82F6' }}>
                      {unit?.name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900 mb-1">
                      Relatório de Performance – {unit?.name || 'Mídia Paga'}
                    </h1>
                    <p className="text-gray-500 text-sm mb-3">Análise completa de performance publicitária</p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Período</p>
                        <p className="font-semibold text-gray-900">
                          {period?.start && period?.end
                            ? `${format(period.start, 'dd/MM/yyyy')} a ${format(period.end, 'dd/MM/yyyy')}`
                            : '—'}
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

                {/* Sections */}
                {isGenerating ? (
                  <div className="py-16 text-center text-gray-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" /> Gerando preview…
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
                    {selectedSections.overview && children?.overview && (
                      <div className="pdf-section">
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 20, paddingBottom: 8, borderBottom: '2px solid #e5e7eb' }}>
                          Visão Geral
                        </h2>
                        {children.overview}
                      </div>
                    )}
                    {selectedSections.platforms && children?.platforms && (
                      <div className="pdf-section">
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 20, paddingBottom: 8, borderBottom: '2px solid #e5e7eb' }}>
                          Performance por Plataforma
                        </h2>
                        {children.platforms}
                      </div>
                    )}
                    {selectedSections.device && children?.device && (
                      <div className="pdf-section">
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 20, paddingBottom: 8, borderBottom: '2px solid #e5e7eb' }}>
                          Performance por Dispositivo
                        </h2>
                        {children.device}
                      </div>
                    )}
                    {selectedSections.demographic && children?.demographic && (
                      <div className="pdf-section">
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 20, paddingBottom: 8, borderBottom: '2px solid #e5e7eb' }}>
                          Performance Demográfica
                        </h2>
                        {children.demographic}
                      </div>
                    )}
                    {selectedSections.creatives && children?.creatives && (
                      <div className="pdf-section">
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 20, paddingBottom: 8, borderBottom: '2px solid #e5e7eb' }}>
                          Criativos
                        </h2>
                        {children.creatives}
                      </div>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div style={{ marginTop: 48, paddingTop: 16, borderTop: '1px solid #e5e7eb', textAlign: 'center', fontSize: 11, color: '#9ca3af' }}>
                  Relatório confidencial • Unified Ads Insights • {format(new Date(), 'dd/MM/yyyy')}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}