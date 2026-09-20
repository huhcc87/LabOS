/**
 * Client-side PDF export using jsPDF + html2canvas.
 * Captures a DOM element as a high-resolution image and embeds it into a PDF.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  filename = 'export.pdf',
) {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  const canvas = await html2canvas(element, { scale: 2, useCORS: true });
  const imgData = canvas.toDataURL('image/png');

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const ratio  = canvas.width / canvas.height;
  const imgW   = pageW - 20;                 // 10 mm margin each side
  const imgH   = imgW / ratio;

  let y = 10;
  if (imgH > pageH - 20) {
    // Multi-page: slice the canvas into A4-height chunks
    const sliceH = Math.floor(canvas.height * ((pageH - 20) / imgH));
    let sourceY  = 0;
    while (sourceY < canvas.height) {
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width  = canvas.width;
      sliceCanvas.height = Math.min(sliceH, canvas.height - sourceY);
      const ctx = sliceCanvas.getContext('2d')!;
      ctx.drawImage(canvas, 0, -sourceY);
      const sliceData = sliceCanvas.toDataURL('image/png');
      const sliceImgH = (sliceCanvas.height / canvas.width) * imgW;
      if (sourceY > 0) pdf.addPage();
      pdf.addImage(sliceData, 'PNG', 10, 10, imgW, sliceImgH);
      sourceY += sliceH;
    }
  } else {
    pdf.addImage(imgData, 'PNG', 10, y, imgW, imgH);
  }

  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/** Download a plain text string as a PDF (using jsPDF text API). */
export async function exportTextToPdf(text: string, title: string, filename = 'export.pdf') {
  const { default: jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 15;
  const maxW   = pageW - margin * 2;

  pdf.setFontSize(16);
  pdf.text(title, margin, 20);
  pdf.setFontSize(11);
  const lines = pdf.splitTextToSize(text, maxW);
  pdf.text(lines, margin, 32);
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
