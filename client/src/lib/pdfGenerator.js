import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Renders an HTML string to a hidden DOM element, converts it to a canvas,
 * and downloads it as a multi-page PDF. This completely bypasses the need for 
 * Puppeteer on the backend.
 */
export async function htmlStringToPdfDownload(htmlString, filename, opts = {}) {
  const { fitToOnePage = false, letterScale = 1 } = opts;
  const container = document.createElement('div');
  // 794px width is exactly 210mm at 96 DPI (A4 width)
  container.style.width = '794px';
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.background = '#ffffff';
  container.innerHTML = htmlString;
  document.body.appendChild(container);

  try {
    // Wait a tiny bit for DOM to settle
    await new Promise(r => setTimeout(r, 100));

    // Wait for images to load
    const imgs = container.querySelectorAll('img');
    await Promise.all(Array.from(imgs).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    }));

    if (fitToOnePage) {
      const pageWrap = container.querySelector('.letter-page-wrap') || container.firstElementChild;
      if (pageWrap) {
        const h = pageWrap.scrollHeight || pageWrap.offsetHeight;
        // 1123px is A4 height at 96 DPI
        if (h > 1123) {
          const fitScale = Math.max(0.55, 1123 / h);
          pageWrap.style.transform = `scale(${fitScale})`;
          pageWrap.style.transformOrigin = 'top left';
          pageWrap.style.width = `${794 / fitScale}px`;
        }
      }
    }

    const canvas = await html2canvas(container, {
      scale: 2, // High resolution
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);

    // A4 size in mm
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // Calculate total height of the canvas in mm
    const totalImgHeightInMm = (canvas.height * pdfWidth) / canvas.width;
    
    // If fitToOnePage, force exactly 1 page
    if (fitToOnePage || totalImgHeightInMm <= pdfHeight + 3) {
      const renderHeight = fitToOnePage ? Math.min(totalImgHeightInMm, pdfHeight) : totalImgHeightInMm;
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, renderHeight);
    } else {
      let heightLeft = totalImgHeightInMm;
      let position = 0;

      // First page
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, totalImgHeightInMm);
      heightLeft -= pdfHeight;

      // Add subsequent pages if the content is longer than one A4 page
      while (heightLeft > 0) {
        position = heightLeft - totalImgHeightInMm;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, totalImgHeightInMm);
        heightLeft -= pdfHeight;
      }
    }

    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
