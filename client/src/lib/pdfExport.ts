import jsPDF from 'jspdf';

interface Step {
  id: number;
  order: number;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
}

interface Guide {
  id: number;
  title: string;
  description: string | null;
}

export async function exportGuideToPdf(guide: Guide, steps: Step[]): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  
  let yPosition = margin;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(24);
  pdf.setTextColor(33, 33, 33);
  
  const titleLines = pdf.splitTextToSize(guide.title, contentWidth);
  pdf.text(titleLines, margin, yPosition);
  yPosition += titleLines.length * 10 + 5;

  if (guide.description) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.setTextColor(100, 100, 100);
    const descLines = pdf.splitTextToSize(guide.description, contentWidth);
    pdf.text(descLines, margin, yPosition);
    yPosition += descLines.length * 6 + 10;
  }

  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

  for (let i = 0; i < sortedSteps.length; i++) {
    const step = sortedSteps[i];
    
    const stepHeight = step.imageUrl ? 100 : 30;
    if (yPosition + stepHeight > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(33, 33, 33);
    
    const stepTitle = `Step ${step.order}: ${step.title || 'Untitled'}`;
    pdf.text(stepTitle, margin, yPosition);
    yPosition += 8;

    if (step.description) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(80, 80, 80);
      const stepDescLines = pdf.splitTextToSize(step.description, contentWidth);
      pdf.text(stepDescLines, margin, yPosition);
      yPosition += stepDescLines.length * 5 + 5;
    }

    if (step.imageUrl && !step.imageUrl.startsWith('https://placehold')) {
      try {
        const imgData = await loadImageAsBase64(step.imageUrl);
        if (imgData) {
          const imgWidth = contentWidth;
          const imgHeight = imgWidth * 0.6;
          
          if (yPosition + imgHeight > pageHeight - margin) {
            pdf.addPage();
            yPosition = margin;
          }
          
          pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
          yPosition += imgHeight + 10;
        }
      } catch (error) {
        console.warn(`Failed to load image for step ${step.order}:`, error);
        yPosition += 5;
      }
    }

    yPosition += 5;
  }

  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  const sanitizedTitle = guide.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  pdf.save(`${sanitizedTitle}.pdf`);
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    // Handle data URLs directly
    if (url.startsWith('data:')) {
      resolve(url);
      return;
    }

    // For relative URLs (our own storage), try loading directly
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    const timeoutId = setTimeout(() => {
      console.warn(`Image load timeout for: ${url}`);
      resolve(null);
    }, 10000); // 10 second timeout
    
    img.onload = () => {
      clearTimeout(timeoutId);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 800;
        canvas.height = img.naturalHeight || 600;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve(null);
        }
      } catch (e) {
        console.warn(`Canvas error for image: ${url}`, e);
        resolve(null);
      }
    };
    
    img.onerror = () => {
      clearTimeout(timeoutId);
      console.warn(`Failed to load image: ${url}`);
      resolve(null);
    };
    
    // Use the URL directly - for our object storage URLs they should work
    img.src = url;
  });
}
