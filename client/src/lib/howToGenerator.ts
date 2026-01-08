import jsPDF from "jspdf";
import type { Guide, Step } from "@shared/schema";

export async function generateHowToGuide(
  guide: Guide,
  steps: Step[],
  workspace?: { name: string; logoUrl?: string | null } | null
): Promise<void> {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

  const addHeader = () => {
    pdf.setFillColor(59, 130, 246);
    pdf.rect(0, 0, pageWidth, 10, "F");
    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);
    pdf.text("HOW-TO GUIDE", margin, 7);
    if (workspace?.name) {
      pdf.text(workspace.name, pageWidth - margin, 7, { align: "right" });
    }
  };

  const addFooter = (pageNum: number, totalPages: number) => {
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    pdf.text(
      `Page ${pageNum} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: "center" }
    );
  };

  const checkPageBreak = (neededHeight: number): boolean => {
    if (yPos + neededHeight > pageHeight - 25) {
      pdf.addPage();
      addHeader();
      yPos = 22;
      return true;
    }
    return false;
  };

  // === COVER PAGE ===
  addHeader();
  
  yPos = 40;
  
  // Title
  pdf.setFontSize(26);
  pdf.setTextColor(30, 41, 59);
  pdf.setFont("helvetica", "bold");
  pdf.text("How To:", margin, yPos);
  
  yPos += 14;
  pdf.setFontSize(20);
  const titleLines = pdf.splitTextToSize(guide.title, contentWidth);
  titleLines.forEach((line: string) => {
    pdf.text(line, margin, yPos);
    yPos += 10;
  });

  yPos += 15;
  
  // Quick summary box
  pdf.setFillColor(239, 246, 255);
  pdf.roundedRect(margin, yPos, contentWidth, 30, 3, 3, "F");
  
  yPos += 10;
  pdf.setFontSize(11);
  pdf.setTextColor(30, 64, 175);
  pdf.setFont("helvetica", "bold");
  pdf.text("What you'll learn:", margin + 8, yPos);
  
  yPos += 7;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  const summaryText = guide.description || `Complete ${guide.title} in ${sortedSteps.length} simple steps.`;
  const summaryLines = pdf.splitTextToSize(summaryText, contentWidth - 16);
  summaryLines.slice(0, 2).forEach((line: string) => {
    pdf.text(line, margin + 8, yPos);
    yPos += 5;
  });
  
  yPos += 15;

  // Time estimate
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text(`Estimated time: ${Math.max(2, sortedSteps.length * 2)} minutes`, margin, yPos);
  pdf.text(`Steps: ${sortedSteps.length}`, margin + 80, yPos);
  
  yPos += 20;

  // Divider
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.3);
  pdf.line(margin, yPos, pageWidth - margin, yPos);
  
  yPos += 15;

  // === STEPS ===
  for (let i = 0; i < sortedSteps.length; i++) {
    const step = sortedSteps[i];
    const stepNumber = i + 1;

    let stepHeight = 50;
    if (step.imageUrl) stepHeight += 70;
    
    checkPageBreak(stepHeight);

    // Step number with circle
    pdf.setFillColor(59, 130, 246);
    pdf.circle(margin + 6, yPos + 2, 6, "F");
    pdf.setFontSize(12);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.text(String(stepNumber), margin + 6, yPos + 4, { align: "center" });

    // Step title - clear instruction
    pdf.setFontSize(13);
    pdf.setTextColor(30, 41, 59);
    pdf.setFont("helvetica", "bold");
    
    const stepTitle = step.title || `Step ${stepNumber}`;
    const titleLines = pdf.splitTextToSize(stepTitle, contentWidth - 20);
    titleLines.forEach((line: string, idx: number) => {
      pdf.text(line, margin + 16, yPos + 3 + idx * 6);
    });
    yPos += 3 + titleLines.length * 6 + 4;

    // Description with clear language
    if (step.description) {
      pdf.setFontSize(10);
      pdf.setTextColor(70, 70, 70);
      pdf.setFont("helvetica", "normal");
      
      const descLines = pdf.splitTextToSize(step.description, contentWidth - 16);
      descLines.slice(0, 4).forEach((line: string) => {
        checkPageBreak(6);
        pdf.text(line, margin + 16, yPos);
        yPos += 5;
      });
      yPos += 3;
    }

    // Screenshot with button/element callout
    if (step.imageUrl) {
      checkPageBreak(65);
      
      try {
        const img = await loadImage(step.imageUrl);
        const imgWidth = contentWidth - 10;
        const imgHeight = 50;
        
        // Image container with subtle border
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.5);
        pdf.roundedRect(margin + 5, yPos, imgWidth, imgHeight, 2, 2, "S");
        
        pdf.addImage(img, "PNG", margin + 6, yPos + 1, imgWidth - 2, imgHeight - 2);
        
        // Arrow pointer indicator
        yPos += imgHeight + 3;
        
        // "Look for" callout if there's a selector or action
        if (step.selector || step.actionType === 'click') {
          pdf.setFillColor(254, 243, 199);
          pdf.roundedRect(margin + 5, yPos, imgWidth, 10, 2, 2, "F");
          pdf.setFontSize(9);
          pdf.setTextColor(146, 64, 14);
          pdf.setFont("helvetica", "bold");
          
          let calloutText = "Look for: ";
          if (step.actionType === 'click') {
            calloutText += "Click the highlighted button in the screenshot above";
          } else if (step.actionType === 'input') {
            calloutText += "Enter your information in the highlighted field";
          } else {
            calloutText += "Follow the highlighted area in the screenshot";
          }
          
          pdf.text(calloutText, margin + 10, yPos + 6.5);
          yPos += 14;
        } else {
          yPos += 5;
        }
      } catch (e) {
        console.warn("Failed to load screenshot:", e);
        yPos += 5;
      }
    }

    // URL reference if available
    if (step.url) {
      checkPageBreak(10);
      pdf.setFontSize(8);
      pdf.setTextColor(59, 130, 246);
      pdf.setFont("helvetica", "normal");
      const displayUrl = step.url.length > 60 ? step.url.substring(0, 57) + "..." : step.url;
      pdf.text(`Page: ${displayUrl}`, margin + 16, yPos);
      yPos += 8;
    }

    yPos += 8;
  }

  // === COMPLETION ===
  checkPageBreak(45);
  
  yPos += 5;
  pdf.setFillColor(220, 252, 231);
  pdf.roundedRect(margin, yPos, contentWidth, 35, 3, 3, "F");
  
  yPos += 12;
  pdf.setFontSize(14);
  pdf.setTextColor(22, 101, 52);
  pdf.setFont("helvetica", "bold");
  pdf.text("You're all done!", pageWidth / 2, yPos, { align: "center" });
  
  yPos += 8;
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`You've completed all ${sortedSteps.length} steps successfully.`, pageWidth / 2, yPos, { align: "center" });
  
  yPos += 7;
  pdf.setFontSize(9);
  pdf.setTextColor(34, 197, 94);
  pdf.text("Need help? Contact your administrator.", pageWidth / 2, yPos, { align: "center" });

  // Add footers to all pages
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    addFooter(i, totalPages);
  }

  // Download
  const filename = `${guide.title.replace(/[^a-zA-Z0-9]/g, "_")}_How_To_Guide.pdf`;
  pdf.save(filename);
}

async function loadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}
