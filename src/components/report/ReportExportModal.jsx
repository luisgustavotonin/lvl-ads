import React, { useState, useRef, useCallback } from 'react';
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

  const toggleSection = useCallback((sectionId) => {
    setSelectedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  }, []);

  const handleNextStep = useCallback(() => {
    setStep('preview');
    setIsGenerating(true);
    setTimeout(() => setIsGenerating(false), 350);
  }, []);

  // -----------------------------
  // Helpers
  // -----------------------------
  const safeFileName = (name) =>
    String(name || 'unidade')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\- ]+/g, '')
      .replace(/\s+/g, '-')
      .trim();

  const waitForFonts = async () => {
    try {
      if (document.fonts?.ready) await document.fonts.ready;
    } catch {}
  };

  const waitForImages = async (root) => {
    try {
      const imgs = Array.from(root.querySelectorAll('img'));
      await Promise.allSettled(
        imgs.map(async (img) => {
          if (img.complete) return;
          await new Promise((res, rej) => {
            img.onload = res;
            img.onerror = rej;
          });
        })
      );
    } catch {}
  };

  const copyStylesTo = (targetDoc) => {
    // Copia os estilos reais do app (Tailwind v3 + css do Base44 etc.)
    const nodes = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'));
    nodes.forEach((n) => targetDoc.head.appendChild(n.cloneNode(true)));
  };

  // Cria um “palco” offscreen (wrapper com overflow hidden) e clona o conteúdo dentro,
  // movendo o clone para cima (translateY), para capturar em páginas sem depender de recorte nativo do html2canvas.
  const renderSliceCanvas = async ({
    sourceEl,
    pageWidthPx,
    sliceHeightPx,
    offsetYPx,
    scale,
  }) => {
    const stage = document.createElement('div');
    stage.style.position = 'fixed';
    stage.style.left = '-100000px';
    stage.style.top = '0';
    stage.style.width = `${pageWidthPx}px`;
    stage.style.height = `${sliceHeightPx}px`;
    stage.style.overflow = 'hidden';
    stage.style.background = '#ffffff';
    stage.style.zIndex = '2147483647';

    // clone
    const clone = sourceEl.cloneNode(true);

    // garante que o clone respeite a largura que você vê no preview
    clone.style.width = `${pageWidthPx}px`;
    clone.style.maxWidth = `${pageWidthPx}px`;
    clone.style.overflow = 'visible';

    // move para mostrar a “fatia” correta
    clone.style.transform = `translateY(-${offsetYPx}px)`;
    clone.style.transformOrigin = 'top left';

    stage.appendChild(clone);
    document.body.appendChild(stage);

    // Espera um “tick” pro browser aplicar layout
    await new Promise((r) => setTimeout(r, 0));

    const canvas = await html2canvas(stage, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 0,
      onclone: (clonedDocument) => {
        // remove itens que não devem exportar
        clonedDocument
          .querySelectorAll('[data-no-export="true"], .no-export, .no-print, [data-no-print="true"]')
          .forEach((el) => (el.style.display = 'none'));

        // evita cortes por overflow hidden
        clonedDocument.querySelectorAll('[style*="overflow: hidden"], .overflow-hidden').forEach((el) => {
          el.style.overflow = 'visible';
        });

        // desliga animações/transições
        clonedDocument.querySelectorAll('*').forEach((el) => {
          el.style.animation = 'none';
          el.style.transition = 'none';
        });

        // tabelas sem truncate
        clonedDocument.querySelectorAll('td, th, td span, td a').forEach((el) => {
          el.style.whiteSpace = 'normal';
          el.style.overflow = 'visible';
          el.style.textOverflow = 'unset';
          el.style.wordBreak = 'break-word';
          el.style.maxWidth = 'none';
        });

        // alguns charts/SVGs cortam com overflow hidden
        clonedDocument.querySelectorAll('svg, canvas, .recharts-wrapper, .recharts-surface').forEach((el) => {
          el.style.overflow = 'visible';
        });
      },
    });

    document.body.removeChild(stage);
    return canvas;
  };

  // -----------------------------
  // PRINT (corrigido: sem Tailwind CDN)
  // -----------------------------
  const handlePrint = useCallback(async () => {
    const content = exportRef.current;
    if (!content) return;

    const win = window.open('', '_blank');
    if (!win) return;

    win.document.open();
    win.document.write(`<!DOCTYPE html><html><head><title>Relatório - ${unit?.name || 'Unified Ads'}</title></head><body></body></html>`);
    win.document.close();

    copyStylesTo(win.document);

    const extra = win.document.createElement('style');
    extra.textContent = `
      @page { size: A4 landscape; margin: 10mm; }
      @media print {
        body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .no-print, [data-no-export="true"], [data-no-print="true"] { display: none !important; }
        * { animation: none !important; transition: none !important; }
        .pdf-section, .card, .chart, .funnel, table { break-inside: avoid; page-break-inside: avoid; }
      }
      body { margin: 0; background: #fff; font-family: Inter, system-ui, -apple-system, sans-serif; }
    `;
    win.document.head.appendChild(extra);

    const clone = content.cloneNode(true);
    win.document.body.appendChild(clone);

    await waitForFonts();
    await new Promise((r) => setTimeout(r, 350));

    win.focus();
    win.print();
    win.close();
  }, [unit?.name]);

  // -----------------------------
  // PDF (A4 landscape, margem 1cm, paginado, sem travar)
  // -----------------------------
  const handleDownloadPDF = useCallback(async () => {
    setIsExporting(true);

    try {
      const content = exportRef.current;
      if (!content) return;

      // PDF A4 landscape com ~1cm de margem
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
      const pageWmm = pdf.internal.pageSize.getWidth();   // 297
      const pageHmm = pdf.internal.pageSize.getHeight();  // 210
      const marginMm = 10; // ~1cm
      const innerWmm = pageWmm - marginMm * 2;
      const innerHmm = pageHmm - marginMm * 2;

      // Largura “fixa” do preview (pra ficar igual à tela)
      const TARGET_WIDTH_PX = 1200;

      // Congela layout para não reflowar
      const prevWidth = content.style.width;
      const prevMaxW = content.style.maxWidth;
      const prevOverflow = content.style.overflow;

      content.style.width = `${TARGET_WIDTH_PX}px`;
      content.style.maxWidth = `${TARGET_WIDTH_PX}px`;
      content.style.overflow = 'visible';

      await waitForFonts();
      await waitForImages(content);
      await new Promise((r) => setTimeout(r, 250));

      // Tamanho da fatia (em px) equivalente ao retângulo imprimível do A4
      // sliceHeight = (innerH/innerW) * TARGET_WIDTH
      const sliceHeightPx = Math.floor((innerHmm / innerWmm) * TARGET_WIDTH_PX);

      // Altura total do conteúdo (o que dá problema quando tenta canvas gigante)
      const totalHeightPx = Math.max(content.scrollHeight, content.offsetHeight);

      // Scale moderado para não estourar memória
      const scale = 2;

      let offsetY = 0;
      let pageIndex = 0;

      while (offsetY < totalHeightPx) {
        const remaining = totalHeightPx - offsetY;
        const currentSliceHeight = Math.min(sliceHeightPx, remaining);

        const canvas = await renderSliceCanvas({
          sourceEl: content,
          pageWidthPx: TARGET_WIDTH_PX,
          sliceHeightPx: currentSliceHeight,
          offsetYPx: offsetY,
          scale,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.92);

        if (pageIndex > 0) pdf.addPage();

        // Coloca a imagem dentro do retângulo imprimível (com margens)
        // Mantém proporção usando innerWmm
        const imgWmm = innerWmm;
        const imgHmm = (canvas.height / canvas.width) * imgWmm;

        pdf.addImage(imgData, 'JPEG', marginMm, marginMm, imgWmm, imgHmm, undefined, 'FAST');

        offsetY += currentSliceHeight;
        pageIndex += 1;

        // respiro para o browser
        await new Promise((r) => setTimeout(r, 20));
      }

      // restaura layout
      content.style.width = prevWidth;
      content.style.maxWidth = prevMaxW;
      content.style.overflow = prevOverflow;

      const fileUnit = safeFileName(unit?.name || 'unidade');
      pdf.save(`relatorio-${fileUnit}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      onExport();
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
    } finally {
      setIsExporting(false);
    }
  }, [unit?.name, onExport]);

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

            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
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
                <style>{`
                  /* Remove botões/elementos marcados para não exportar */
                  [data-no-export="true"], .no-export { display:none !important; }

                  /* KPI cards sem borda no PDF */
                  .kpi-pdf-card {
                    border: none !important;
                    box-shadow: none !important;
                    background-color: #f9fafb !important;
                    border-radius: 8px !important;
                  }
                  .kpi-pdf-card > * { background-color: transparent !important; }

                  /* Funil: garantir cores */
                  .funnel-stage {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                  }

                  /* Tabelas: texto sem corte */
                  table { width: 100%; table-layout: auto !important; }
                  td, th {
                    white-space: normal !important;
                    word-break: break-word !important;
                    overflow: visible !important;
                    text-overflow: unset !important;
                    max-width: none !important;
                    padding: 6px 8px;
                    font-size: 11px;
                  }
                  td span, td a {
                    white-space: normal !important;
                    overflow: visible !important;
                    text-overflow: unset !important;
                  }

                  /* Seções: evita quebra “feia” no print */
                  .pdf-section {
                    page-break-inside: avoid;
                    break-inside: avoid;
                    margin-bottom: 24px;
                  }
                `}</style>

                {/* Header do relatório */}
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
                      <h1 className="text-2xl font-bold text-gray-900 mb-1">
                        Relatório de Performance - {unit?.name || 'Mídia Paga'}
                      </h1>
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
                          <p className="font-semibold text-gray-900">
                            {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

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
                        <h2 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                          Performance por Plataforma
                        </h2>
                        {children.platforms}
                      </div>
                    )}

                    {selectedSections.device && children?.device && (
                      <div className="pdf-section">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                          Performance por Device
                        </h2>
                        {children.device}
                      </div>
                    )}

                    {selectedSections.demographic && children?.demographic && (
                      <div className="pdf-section">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                          Performance Demográfica
                        </h2>
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