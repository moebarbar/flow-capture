import jsPDF from "jspdf";
import type { Guide, Step } from "@shared/schema";

export async function generateKnowledgeBaseArticle(
  guide: Guide,
  steps: Step[],
  workspace?: { name: string; logoUrl?: string | null } | null,
  tags?: string[]
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
  const docId = `KB-${String(guide.id).padStart(5, "0")}`;
  const version = "1.0";
  const effectiveDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Set PDF metadata for searchability
  pdf.setProperties({
    title: guide.title,
    subject: `Knowledge Base Article: ${guide.title}`,
    author: workspace?.name || "FlowCapture",
    keywords: tags?.join(", ") || guide.title,
    creator: "FlowCapture Knowledge Base",
  });

  const addHeader = () => {
    pdf.setFillColor(30, 41, 59);
    pdf.rect(0, 0, pageWidth, 14, "F");
    pdf.setFontSize(9);
    pdf.setTextColor(255, 255, 255);
    pdf.text("KNOWLEDGE BASE ARTICLE", margin, 9);
    pdf.text(docId, pageWidth - margin, 9, { align: "right" });
  };

  const addFooter = (pageNum: number, totalPages: number) => {
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`${docId} | Version ${version}`, margin, pageHeight - 8);
    pdf.text(
      `Page ${pageNum} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: "right" }
    );
  };

  const checkPageBreak = (neededHeight: number): boolean => {
    if (yPos + neededHeight > pageHeight - 25) {
      pdf.addPage();
      addHeader();
      yPos = 28;
      return true;
    }
    return false;
  };

  const addSectionHeader = (title: string, level: 1 | 2 | 3 = 1) => {
    const sizes = { 1: 16, 2: 13, 3: 11 };
    const spacing = { 1: 12, 2: 10, 3: 8 };
    
    checkPageBreak(20);
    yPos += level === 1 ? 8 : 4;
    
    pdf.setFontSize(sizes[level]);
    pdf.setTextColor(30, 41, 59);
    pdf.setFont("helvetica", "bold");
    pdf.text(title, margin, yPos);
    yPos += spacing[level];
    
    if (level === 1) {
      pdf.setDrawColor(99, 102, 241);
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPos - 4, margin + 40, yPos - 4);
    }
  };

  const addParagraph = (text: string, indent: number = 0) => {
    pdf.setFontSize(10);
    pdf.setTextColor(60, 60, 60);
    pdf.setFont("helvetica", "normal");
    
    const lines = pdf.splitTextToSize(text, contentWidth - indent);
    lines.forEach((line: string) => {
      checkPageBreak(6);
      pdf.text(line, margin + indent, yPos);
      yPos += 5;
    });
    yPos += 2;
  };

  // === COVER PAGE ===
  addHeader();
  
  yPos = 45;
  
  // Document classification badge
  pdf.setFillColor(243, 244, 246);
  pdf.roundedRect(margin, yPos, 50, 8, 2, 2, "F");
  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  pdf.text("INTERNAL DOCUMENTATION", margin + 3, yPos + 5.5);
  
  yPos += 20;
  
  // Title
  pdf.setFontSize(24);
  pdf.setTextColor(30, 41, 59);
  pdf.setFont("helvetica", "bold");
  const titleLines = pdf.splitTextToSize(guide.title, contentWidth);
  titleLines.forEach((line: string) => {
    pdf.text(line, margin, yPos);
    yPos += 12;
  });
  
  yPos += 10;
  
  // Metadata table
  pdf.setFillColor(249, 250, 251);
  pdf.roundedRect(margin, yPos, contentWidth, 40, 3, 3, "F");
  
  const metaStartY = yPos + 8;
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(60, 60, 60);
  
  const metaItems = [
    ["Document ID:", docId],
    ["Version:", version],
    ["Effective Date:", effectiveDate],
    ["Department:", workspace?.name || "General"],
  ];
  
  metaItems.forEach((item, idx) => {
    const col = idx % 2 === 0 ? margin + 5 : margin + contentWidth / 2;
    const row = metaStartY + Math.floor(idx / 2) * 12;
    pdf.setFont("helvetica", "bold");
    pdf.text(item[0], col, row);
    pdf.setFont("helvetica", "normal");
    pdf.text(item[1], col + 30, row);
  });
  
  yPos += 50;

  // === EXECUTIVE SUMMARY ===
  addSectionHeader("1. Executive Summary");
  
  const summaryText = guide.description 
    ? `This knowledge base article provides comprehensive documentation for "${guide.title}". ${guide.description}`
    : `This knowledge base article provides comprehensive documentation for the "${guide.title}" procedure. The following sections outline the complete workflow, including prerequisites, step-by-step instructions, and supplementary guidance for successful execution.`;
  
  addParagraph(summaryText);
  
  yPos += 5;
  
  // Quick reference box
  pdf.setFillColor(239, 246, 255);
  pdf.roundedRect(margin, yPos, contentWidth, 20, 2, 2, "F");
  pdf.setFontSize(9);
  pdf.setTextColor(30, 64, 175);
  pdf.setFont("helvetica", "bold");
  pdf.text("Quick Reference", margin + 5, yPos + 7);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Total Steps: ${sortedSteps.length}  |  Estimated Duration: ${Math.max(5, sortedSteps.length * 3)} minutes`, margin + 5, yPos + 14);
  
  yPos += 28;

  // === PREREQUISITES ===
  addSectionHeader("2. Prerequisites & Requirements");
  addParagraph("Before proceeding with this procedure, ensure the following conditions are met:");
  
  const prerequisites = [
    "Appropriate system access permissions have been granted",
    "Required applications and tools are installed and accessible",
    "Relevant stakeholders have been notified as necessary",
  ];
  
  prerequisites.forEach((prereq) => {
    checkPageBreak(8);
    pdf.setFillColor(99, 102, 241);
    pdf.circle(margin + 3, yPos - 1.5, 1.5, "F");
    pdf.setFontSize(10);
    pdf.setTextColor(60, 60, 60);
    pdf.setFont("helvetica", "normal");
    pdf.text(prereq, margin + 8, yPos);
    yPos += 7;
  });
  
  yPos += 5;

  // === PROCEDURE ===
  pdf.addPage();
  addHeader();
  yPos = 28;
  
  addSectionHeader("3. Procedure");
  addParagraph("Follow the steps below to complete this procedure. Each step includes detailed instructions and visual references where applicable.");
  
  yPos += 5;

  for (let i = 0; i < sortedSteps.length; i++) {
    const step = sortedSteps[i];
    const stepNumber = i + 1;

    let stepHeight = 40;
    if (step.imageUrl) stepHeight += 60;
    
    checkPageBreak(stepHeight);

    // Step header
    addSectionHeader(`3.${stepNumber} ${step.title || `Step ${stepNumber}`}`, 2);
    
    // Step description
    if (step.description) {
      addParagraph(step.description, 5);
    }

    // Screenshot
    if (step.imageUrl) {
      checkPageBreak(55);
      
      try {
        const img = await loadImage(step.imageUrl);
        const imgWidth = contentWidth - 20;
        const imgHeight = 45;
        
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(margin + 10, yPos, imgWidth, imgHeight, 2, 2, "S");
        
        pdf.addImage(img, "PNG", margin + 11, yPos + 1, imgWidth - 2, imgHeight - 2);
        
        // Figure caption
        yPos += imgHeight + 4;
        pdf.setFontSize(8);
        pdf.setTextColor(120, 120, 120);
        pdf.setFont("helvetica", "italic");
        pdf.text(`Figure 3.${stepNumber}: ${step.title || `Step ${stepNumber}`}`, margin + 10, yPos);
        yPos += 8;
      } catch (e) {
        console.warn("Failed to load screenshot:", e);
        yPos += 5;
      }
    }

    yPos += 5;
  }

  // === KEYWORDS SECTION ===
  checkPageBreak(40);
  yPos += 10;
  
  addSectionHeader("4. Search Keywords");
  
  pdf.setFillColor(249, 250, 251);
  pdf.roundedRect(margin, yPos, contentWidth, 25, 2, 2, "F");
  
  const keywords = tags?.length 
    ? tags 
    : [guide.title, ...sortedSteps.slice(0, 5).map(s => s.title).filter(Boolean)];
  
  pdf.setFontSize(9);
  pdf.setTextColor(60, 60, 60);
  pdf.setFont("helvetica", "bold");
  pdf.text("Keywords:", margin + 5, yPos + 8);
  pdf.setFont("helvetica", "normal");
  
  const keywordText = keywords.slice(0, 10).join(", ");
  const keywordLines = pdf.splitTextToSize(keywordText, contentWidth - 30);
  keywordLines.forEach((line: string, idx: number) => {
    pdf.text(line, margin + 25, yPos + 8 + idx * 5);
  });
  
  yPos += 35;

  // === REVISION HISTORY ===
  checkPageBreak(35);
  
  addSectionHeader("5. Revision History");
  
  pdf.setFillColor(249, 250, 251);
  pdf.roundedRect(margin, yPos, contentWidth, 18, 2, 2, "F");
  
  pdf.setFontSize(8);
  pdf.setTextColor(80, 80, 80);
  pdf.setFont("helvetica", "bold");
  pdf.text("Version", margin + 5, yPos + 6);
  pdf.text("Date", margin + 35, yPos + 6);
  pdf.text("Description", margin + 75, yPos + 6);
  
  pdf.setFont("helvetica", "normal");
  pdf.text("1.0", margin + 5, yPos + 13);
  pdf.text(effectiveDate, margin + 35, yPos + 13);
  pdf.text("Initial publication", margin + 75, yPos + 13);

  // Add footers to all pages
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    addFooter(i, totalPages);
  }

  // Download
  const filename = `${guide.title.replace(/[^a-zA-Z0-9]/g, "_")}_KB_Article.pdf`;
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
