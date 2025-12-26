
import { ArticleMetadata } from '../types';

declare global {
  interface Window {
    loadPyodide: any;
  }
}

let pyodide: any = null;
let pyodideReadyPromise: Promise<void> | null = null;

// Embedded python script to ensure it's available without file fetching issues in this env
const PYTHON_SCRIPT = `
import io
import json
import re
from pypdf import PdfReader

def parse_pdf(file_bytes_list, file_name):
    try:
        # Convert JS list/proxy to bytes
        data = bytes(file_bytes_list)
        stream = io.BytesIO(data)
        reader = PdfReader(stream)
        
        # Extract Metadata
        info = reader.metadata if reader.metadata else {}
        
        # Extract Text from first 3 pages for heuristics
        full_text = ""
        max_pages = min(len(reader.pages), 3)
        for i in range(max_pages):
            try:
                page_text = reader.pages[i].extract_text()
                if page_text:
                    full_text += page_text + "\\n\\n"
            except:
                pass
        
        # Heuristics
        
        # Title
        title = info.title
        try:
            if title:
                title = title.strip()
                if title.lower() in ['untitled', 'microsoft word'] or len(title) < 3:
                    title = None
        except:
            title = None
        
        if not title:
            # Fallback to filename
            title = file_name.rsplit('.', 1)[0]
            
        # Authors
        authors = []
        try:
            author_str = info.author
            if author_str and author_str.strip():
                # Split by comma or semicolon
                parts = re.split(r'[;,]', author_str)
                authors = [p.strip() for p in parts if p.strip()]
        except:
            pass
            
        if not authors:
            authors = ["Unknown Author"]
            
        # Year
        year = "Unknown"
        try:
            creation_date = info.creation_date
            if creation_date:
                # Format usually D:YYYYMMDD...
                match = re.search(r'D:(\\d{4})', str(creation_date))
                if match:
                    year = match.group(1)
        except:
            pass
        
        if year == "Unknown":
            # Search text for 19xx or 20xx
            match = re.search(r'\\b(19|20)\\d{2}\\b', full_text)
            if match:
                year = match.group(0)
                
        # Keywords
        keywords = []
        try:
            kw_str = info.keywords
            if kw_str and isinstance(kw_str, str) and kw_str.strip():
                parts = re.split(r'[;,]', kw_str)
                keywords = [k.strip() for k in parts if k.strip()]
        except:
            pass
            
        # Categories (Subject)
        categories = ["Uncategorized"]
        try:
            subject = info.subject
            if subject and subject.strip():
                categories = [subject.strip()]
        except:
            pass
            
        # Abstract
        abstract = ""
        # Look for Abstract header
        match = re.search(r'(?:abstract|summary)[:\\s.\\n]+([\\s\\S]{50,1500}?)(?=(?:introduction|keywords|conclusion|references|1\\.)|\\n\\n\\n)', full_text, re.IGNORECASE)
        
        if match:
            abstract = re.sub(r'\\s+', ' ', match.group(1)).strip()
        else:
            # First significant paragraph
            clean_text = re.sub(r'\\s+', ' ', full_text).strip()
            abstract = clean_text[:400] + "..." if len(clean_text) > 400 else clean_text

        return json.dumps({
            "title": title,
            "authors": authors,
            "year": year,
            "categories": categories,
            "keywords": keywords,
            "abstract": abstract
        })

    except Exception as e:
        return json.dumps({"error": str(e)})
`;

const installWithRetry = async (micropip: any, pkg: string, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Installing ${pkg} (Attempt ${i + 1}/${retries})...`);
      await micropip.install(pkg);
      console.log(`${pkg} installed successfully.`);
      return;
    } catch (err) {
      console.warn(`Attempt ${i + 1} failed to install ${pkg}.`, err);
      if (i === retries - 1) {
        console.error(`Failed to install ${pkg} after ${retries} attempts.`);
        throw err;
      }
      // Linear backoff: 1s, 2s, 3s...
      await new Promise(r => setTimeout(r, (i + 1) * 1000));
    }
  }
};

export const initPyodide = async () => {
  if (pyodideReadyPromise) return pyodideReadyPromise;

  pyodideReadyPromise = (async () => {
    if (!window.loadPyodide) {
      throw new Error("Pyodide script not loaded. Check internet connection.");
    }
    
    console.log("Loading Pyodide...");
    pyodide = await window.loadPyodide();
    
    // Load SSL which is sometimes needed for network operations
    console.log("Loading SSL...");
    await pyodide.loadPackage("ssl");

    console.log("Loading Micropip...");
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    
    // Unpin version to allow latest compatible wheel resolution
    await installWithRetry(micropip, "pypdf");
    
    console.log("Loading Parser Script...");
    await pyodide.runPythonAsync(PYTHON_SCRIPT);
    console.log("Python Backend Ready");
  })();

  return pyodideReadyPromise;
};

export const parsePdfWithPython = async (file: File | Blob, fileName: string): Promise<ArticleMetadata> => {
  await initPyodide();
  
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  const parsePdf = pyodide.globals.get('parse_pdf');
  
  const resultJson = parsePdf(uint8Array, fileName);
  const result = JSON.parse(resultJson);
  
  if (result.error) {
    throw new Error(result.error);
  }
  
  return result as ArticleMetadata;
};
