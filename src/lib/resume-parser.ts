/**
 * Client-side resume text extraction
 * Extracts text content from PDF and DOCX files
 */

export async function extractTextFromFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  if (extension === 'pdf') {
    return extractTextFromPDF(file);
  } else if (extension === 'docx') {
    return extractTextFromDOCX(file);
  } else {
    throw new Error(`Unsupported file type: ${extension}`);
  }
}

/**
 * Extract text from PDF using basic parsing
 * For complex PDFs, we'll rely on the AI to make sense of the extracted text
 */
async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  
  // Convert bytes to string for text extraction
  let text = '';
  
  // Try to decode as UTF-8 first
  try {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const content = decoder.decode(bytes);
    
    // Extract text between BT (begin text) and ET (end text) markers
    // Also look for Tj and TJ operators which contain text
    const textMatches = content.match(/\(([^)]+)\)/g);
    if (textMatches) {
      text = textMatches
        .map(match => match.slice(1, -1))
        .join(' ')
        .replace(/\\r|\\n/g, '\n')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    // If no text found via parentheses, try stream extraction
    if (!text) {
      const streamMatches = content.match(/stream\s*([\s\S]*?)\s*endstream/g);
      if (streamMatches) {
        text = streamMatches
          .map(match => {
            const inner = match.replace(/stream\s*/, '').replace(/\s*endstream/, '');
            // Extract readable ASCII characters
            return inner.replace(/[^\x20-\x7E\n]/g, ' ');
          })
          .join('\n')
          .replace(/\s+/g, ' ')
          .trim();
      }
    }
  } catch {
    // If UTF-8 decoding fails, try Latin1
    let content = '';
    for (let i = 0; i < bytes.length; i++) {
      content += String.fromCharCode(bytes[i]);
    }
    
    // Extract printable ASCII and common characters
    text = content
      .replace(/[^\x20-\x7E\n]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  // Clean up the extracted text
  text = cleanExtractedText(text);
  
  if (!text || text.length < 50) {
    throw new Error('Could not extract text from PDF. Please paste your resume content manually or try a different file format.');
  }
  
  return text;
}

/**
 * Extract text from DOCX by parsing its XML structure
 */
async function extractTextFromDOCX(file: File): Promise<string> {
  // DOCX is a ZIP file containing XML documents
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  
  // Find the document.xml content within the ZIP
  // Look for the word/document.xml entry
  let text = '';
  
  try {
    // Convert to string and look for XML content
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const content = decoder.decode(bytes);
    
    // Extract text between <w:t> tags (Word text elements)
    const textMatches = content.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
    if (textMatches) {
      text = textMatches
        .map(match => {
          const innerMatch = match.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
          return innerMatch ? innerMatch[1] : '';
        })
        .filter(Boolean)
        .join(' ');
    }
    
    // Also look for paragraph breaks
    text = text.replace(/<\/w:p>/g, '\n');
    
    // Clean up
    text = text
      .replace(/<[^>]+>/g, '') // Remove any remaining XML tags
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    throw new Error('Could not parse DOCX file structure.');
  }
  
  text = cleanExtractedText(text);
  
  if (!text || text.length < 50) {
    throw new Error('Could not extract text from DOCX. Please paste your resume content manually or try a different file format.');
  }
  
  return text;
}

/**
 * Clean up extracted text
 */
function cleanExtractedText(text: string): string {
  return text
    // Normalize whitespace
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n +/g, '\n')
    .replace(/ +\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    // Remove non-printable characters except newlines
    .replace(/[^\x20-\x7E\n]/g, ' ')
    // Final cleanup
    .replace(/\s+/g, ' ')
    .replace(/\n /g, '\n')
    .trim();
}

/**
 * Fallback: Read file as plain text
 */
export async function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
