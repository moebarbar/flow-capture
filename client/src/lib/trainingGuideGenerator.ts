import jsPDF from "jspdf";
import type { Guide, Step } from "@shared/schema";

export async function generateTrainingGuide(
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
    pdf.setFillColor(99, 102, 241);
    pdf.rect(0, 0, pageWidth, 12, "F");
    pdf.setFontSize(9);
    pdf.setTextColor(255, 255, 255);
    pdf.text("TRAINING GUIDE", margin, 8);
    pdf.text(guide.title, pageWidth - margin, 8, { align: "right" });
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
      yPos = 25;
      return true;
    }
    return false;
  };

  // Title Page
  addHeader();
  
  yPos = 50;
  pdf.setFontSize(28);
  pdf.setTextColor(99, 102, 241);
  pdf.setFont("helvetica", "bold");
  pdf.text("Training Guide", pageWidth / 2, yPos, { align: "center" });
  
  yPos += 20;
  pdf.setFontSize(22);
  pdf.setTextColor(30, 30, 30);
  const titleLines = pdf.splitTextToSize(guide.title, contentWidth - 20);
  titleLines.forEach((line: string) => {
    pdf.text(line, pageWidth / 2, yPos, { align: "center" });
    yPos += 10;
  });

  yPos += 15;
  pdf.setFontSize(14);
  pdf.setTextColor(100, 100, 100);
  pdf.setFont("helvetica", "normal");
  pdf.text("Learn step-by-step how to complete this task", pageWidth / 2, yPos, { align: "center" });

  yPos += 30;
  
  // Quick Info Box
  pdf.setFillColor(243, 244, 246);
  pdf.roundedRect(margin + 20, yPos, contentWidth - 40, 35, 3, 3, "F");
  
  yPos += 12;
  pdf.setFontSize(11);
  pdf.setTextColor(60, 60, 60);
  pdf.setFont("helvetica", "bold");
  pdf.text("Quick Info", pageWidth / 2, yPos, { align: "center" });
  
  yPos += 8;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Total Steps: ${sortedSteps.length}`, pageWidth / 2, yPos, { align: "center" });
  
  yPos += 6;
  pdf.text(`Estimated Time: ${Math.max(2, sortedSteps.length * 2)} minutes`, pageWidth / 2, yPos, { align: "center" });

  // What You'll Learn Section
  yPos += 30;
  pdf.setFontSize(16);
  pdf.setTextColor(99, 102, 241);
  pdf.setFont("helvetica", "bold");
  pdf.text("What You'll Learn", margin, yPos);
  
  yPos += 10;
  pdf.setFontSize(11);
  pdf.setTextColor(60, 60, 60);
  pdf.setFont("helvetica", "normal");
  
  if (guide.description) {
    const descLines = pdf.splitTextToSize(guide.description, contentWidth);
    descLines.forEach((line: string) => {
      pdf.text(line, margin, yPos);
      yPos += 6;
    });
  } else {
    pdf.text("This guide will walk you through each step of the process.", margin, yPos);
    yPos += 6;
  }

  // Steps Section - New Page
  pdf.addPage();
  addHeader();
  yPos = 25;

  pdf.setFontSize(18);
  pdf.setTextColor(99, 102, 241);
  pdf.setFont("helvetica", "bold");
  pdf.text("Follow These Steps", margin, yPos);
  yPos += 15;

  // Process each step
  for (let i = 0; i < sortedSteps.length; i++) {
    const step = sortedSteps[i];
    const stepNumber = i + 1;

    // Estimate height needed for this step
    let stepHeight = 45;
    if (step.imageUrl) stepHeight += 75;
    
    checkPageBreak(stepHeight);

    // Step number badge with action highlight
    pdf.setFillColor(99, 102, 241);
    pdf.circle(margin + 8, yPos + 3, 8, "F");
    pdf.setFontSize(12);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.text(String(stepNumber), margin + 8, yPos + 5, { align: "center" });

    // Action keyword (DO THIS)
    pdf.setFontSize(9);
    pdf.setTextColor(34, 197, 94);
    pdf.setFont("helvetica", "bold");
    pdf.text("DO THIS:", margin + 20, yPos - 2);

    // Step title/action
    pdf.setFontSize(13);
    pdf.setTextColor(30, 30, 30);
    pdf.setFont("helvetica", "bold");
    
    const actionText = step.title || `Step ${stepNumber}`;
    const actionLines = pdf.splitTextToSize(actionText, contentWidth - 25);
    actionLines.forEach((line: string, idx: number) => {
      pdf.text(line, margin + 20, yPos + 5 + idx * 6);
    });
    yPos += 5 + actionLines.length * 6 + 3;

    // Description with simple language
    if (step.description) {
      pdf.setFontSize(10);
      pdf.setTextColor(80, 80, 80);
      pdf.setFont("helvetica", "normal");
      
      const descLines = pdf.splitTextToSize(step.description, contentWidth - 25);
      descLines.slice(0, 4).forEach((line: string) => {
        checkPageBreak(6);
        pdf.text(line, margin + 20, yPos);
        yPos += 5;
      });
      yPos += 3;
    }

    // Screenshot with highlight box
    if (step.imageUrl) {
      checkPageBreak(70);
      
      try {
        const img = await loadImage(step.imageUrl);
        const imgWidth = contentWidth - 30;
        const imgHeight = 55;
        
        // Light border around screenshot
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.5);
        pdf.roundedRect(margin + 15, yPos, imgWidth, imgHeight, 2, 2, "S");
        
        pdf.addImage(img, "PNG", margin + 16, yPos + 1, imgWidth - 2, imgHeight - 2);
        yPos += imgHeight + 8;
      } catch (e) {
        console.warn("Failed to load screenshot:", e);
        yPos += 5;
      }
    }

    // Tip box for certain steps
    if (step.description && step.description.toLowerCase().includes("click")) {
      checkPageBreak(15);
      pdf.setFillColor(254, 243, 199);
      pdf.roundedRect(margin + 15, yPos, contentWidth - 30, 12, 2, 2, "F");
      pdf.setFontSize(9);
      pdf.setTextColor(146, 64, 14);
      pdf.setFont("helvetica", "italic");
      pdf.text("Tip: Look for the highlighted area in the screenshot above", margin + 20, yPos + 7);
      yPos += 18;
    }

    yPos += 8;
  }

  // Completion page
  checkPageBreak(60);
  
  yPos += 10;
  pdf.setFillColor(220, 252, 231);
  pdf.roundedRect(margin, yPos, contentWidth, 40, 3, 3, "F");
  
  yPos += 15;
  pdf.setFontSize(16);
  pdf.setTextColor(22, 101, 52);
  pdf.setFont("helvetica", "bold");
  pdf.text("You Did It!", pageWidth / 2, yPos, { align: "center" });
  
  yPos += 10;
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.text("You've completed all the steps in this guide.", pageWidth / 2, yPos, { align: "center" });
  
  yPos += 7;
  pdf.setFontSize(10);
  pdf.setTextColor(34, 197, 94);
  pdf.text("Need help? Contact your team lead or administrator.", pageWidth / 2, yPos, { align: "center" });

  // Add footers to all pages
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    addFooter(i, totalPages);
  }

  // Download
  const filename = `${guide.title.replace(/[^a-zA-Z0-9]/g, "_")}_Training_Guide.pdf`;
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
