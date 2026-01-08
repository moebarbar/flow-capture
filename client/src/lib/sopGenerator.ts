import jsPDF from 'jspdf';

interface Step {
  id: number;
  order: number;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  actionType?: string;
  url?: string;
}

interface Guide {
  id: number;
  title: string;
  description: string | null;
}

interface Workspace {
  name: string;
  logoUrl?: string | null;
}

interface SOPOptions {
  includeScreenshots?: boolean;
  includePurpose?: boolean;
  includeScope?: boolean;
}

const COLORS = {
  primary: [99, 102, 241] as [number, number, number],
  dark: [33, 33, 33] as [number, number, number],
  secondary: [100, 100, 100] as [number, number, number],
  light: [150, 150, 150] as [number, number, number],
  border: [200, 200, 200] as [number, number, number],
  accent: [245, 245, 250] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

export async function generateSOP(
  guide: Guide, 
  steps: Step[], 
  workspace?: Workspace | null,
  options: SOPOptions = {}
): Promise<void> {
  const {
    includeScreenshots = true,
    includePurpose = true,
    includeScope = true,
  } = options;

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

  const addHeader = (pageNum: number, totalPages: number) => {
    pdf.setFillColor(...COLORS.primary);
    pdf.rect(0, 0, pageWidth, 12, 'F');
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...COLORS.white);
    pdf.text('STANDARD OPERATING PROCEDURE', margin, 8);
    
    if (workspace?.name) {
      pdf.text(workspace.name.toUpperCase(), pageWidth - margin, 8, { align: 'right' });
    }
  };

  const addFooter = (pageNum: number, totalPages: number) => {
    pdf.setDrawColor(...COLORS.border);
    pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...COLORS.light);
    
    const date = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    pdf.text(`Generated: ${date}`, margin, pageHeight - 10);
    pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  };

  const checkPageBreak = (requiredHeight: number): boolean => {
    if (yPosition + requiredHeight > pageHeight - 25) {
      pdf.addPage();
      yPosition = 25;
      return true;
    }
    return false;
  };

  pdf.setFillColor(...COLORS.primary);
  pdf.rect(0, 0, pageWidth, 80, 'F');
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12);
  pdf.setTextColor(...COLORS.white);
  pdf.text('STANDARD OPERATING PROCEDURE', margin, 35);
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(28);
  const titleLines = pdf.splitTextToSize(guide.title, contentWidth);
  pdf.text(titleLines, margin, 50);
  
  yPosition = 95;

  pdf.setFillColor(...COLORS.accent);
  pdf.rect(margin, yPosition, contentWidth, 35, 'F');
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(...COLORS.secondary);
  
  const docId = `SOP-${guide.id.toString().padStart(4, '0')}`;
  const version = '1.0';
  const effectiveDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  pdf.text(`Document ID: ${docId}`, margin + 5, yPosition + 10);
  pdf.text(`Version: ${version}`, margin + 5, yPosition + 18);
  pdf.text(`Effective Date: ${effectiveDate}`, margin + 5, yPosition + 26);
  
  if (workspace?.name) {
    pdf.text(`Department: ${workspace.name}`, pageWidth / 2 + 10, yPosition + 10);
  }
  pdf.text(`Total Steps: ${steps.length}`, pageWidth / 2 + 10, yPosition + 18);
  
  yPosition += 50;

  if (includePurpose) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(...COLORS.primary);
    pdf.text('1. PURPOSE', margin, yPosition);
    yPosition += 8;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(...COLORS.dark);
    
    const purpose = guide.description || 
      `This Standard Operating Procedure provides step-by-step instructions for completing the "${guide.title}" workflow. Following these procedures ensures consistency, quality, and compliance with organizational standards.`;
    
    const purposeLines = pdf.splitTextToSize(purpose, contentWidth);
    pdf.text(purposeLines, margin, yPosition);
    yPosition += purposeLines.length * 5 + 12;
  }

  if (includeScope) {
    checkPageBreak(30);
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(...COLORS.primary);
    pdf.text('2. SCOPE', margin, yPosition);
    yPosition += 8;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(...COLORS.dark);
    
    const scope = `This procedure applies to all personnel responsible for executing the "${guide.title}" process. It covers all steps from initiation to completion.`;
    
    const scopeLines = pdf.splitTextToSize(scope, contentWidth);
    pdf.text(scopeLines, margin, yPosition);
    yPosition += scopeLines.length * 5 + 12;
  }

  checkPageBreak(20);
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(...COLORS.primary);
  const procedureSection = includePurpose && includeScope ? '3' : includePurpose || includeScope ? '2' : '1';
  pdf.text(`${procedureSection}. PROCEDURE`, margin, yPosition);
  yPosition += 12;

  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

  for (let i = 0; i < sortedSteps.length; i++) {
    const step = sortedSteps[i];
    
    const estimatedHeight = includeScreenshots && step.imageUrl ? 90 : 35;
    checkPageBreak(estimatedHeight);
    
    pdf.setFillColor(...COLORS.primary);
    pdf.circle(margin + 4, yPosition - 1, 4, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(...COLORS.white);
    pdf.text(step.order.toString(), margin + 4, yPosition + 1, { align: 'center' });
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(...COLORS.dark);
    
    const stepTitle = step.title || `Step ${step.order}`;
    pdf.text(stepTitle, margin + 12, yPosition);
    yPosition += 7;
    
    if (step.description) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(...COLORS.secondary);
      
      const bulletPoint = '\u2022';
      const descLines = pdf.splitTextToSize(step.description, contentWidth - 15);
      
      for (const line of descLines) {
        checkPageBreak(6);
        if (line === descLines[0]) {
          pdf.text(`${bulletPoint}  ${line}`, margin + 12, yPosition);
        } else {
          pdf.text(`   ${line}`, margin + 12, yPosition);
        }
        yPosition += 5;
      }
      yPosition += 3;
    }
    
    if (includeScreenshots && step.imageUrl && !step.imageUrl.startsWith('https://placehold')) {
      try {
        const imgData = await loadImageAsBase64(step.imageUrl);
        if (imgData) {
          const imgWidth = contentWidth - 10;
          const imgHeight = imgWidth * 0.5;
          
          checkPageBreak(imgHeight + 10);
          
          pdf.setDrawColor(...COLORS.border);
          pdf.setLineWidth(0.5);
          pdf.roundedRect(margin + 5, yPosition, imgWidth, imgHeight, 2, 2, 'S');
          
          pdf.addImage(imgData, 'PNG', margin + 6, yPosition + 1, imgWidth - 2, imgHeight - 2);
          yPosition += imgHeight + 8;
        }
      } catch (error) {
        console.warn(`Failed to load image for step ${step.order}:`, error);
      }
    }
    
    yPosition += 5;
  }

  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    addHeader(i, totalPages);
    addFooter(i, totalPages);
  }

  const sanitizedTitle = guide.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  pdf.save(`SOP_${sanitizedTitle}.pdf`);
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (url.startsWith('data:')) {
      resolve(url);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    const timeoutId = setTimeout(() => {
      console.warn(`Image load timeout for: ${url}`);
      resolve(null);
    }, 10000);
    
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
    
    img.src = url;
  });
}
