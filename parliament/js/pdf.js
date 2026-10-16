// PDF viewing and text extraction with the vendored pdf.js build.

let libPromise;
function lib() {
  if (!libPromise) {
    libPromise = import('/parliament/vendor/pdfjs/pdf.min.mjs').then((L) => {
      L.GlobalWorkerOptions.workerSrc = '/parliament/vendor/pdfjs/pdf.worker.min.mjs';
      return L;
    });
  }
  return libPromise;
}

async function open(source) {
  const L = await lib();
  const params = source instanceof ArrayBuffer || ArrayBuffer.isView(source) ? { data: source } : { url: source };
  return L.getDocument({ ...params, isEvalSupported: false }).promise;
}

/** Read the text and page count of a PDF File. */
export async function readPdf(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const doc = await open(buf);
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let text = '';
    for (const item of content.items) {
      text += item.str;
      if (item.hasEOL) text += '\n';
    }
    pages.push(text.trim());
  }
  await doc.destroy();
  return { pages: doc.numPages, text: pages.join('\n\n') };
}

/** Render every page of a PDF into a container, drawing pages as they scroll into view. */
export async function mountViewer(container, url) {
  container.innerHTML = '<div class="pdf-loading">Unrolling the document</div>';
  let doc;
  try {
    doc = await open(url);
  } catch (e) {
    container.innerHTML = '<p class="pdf-error">The original document could not be displayed here. Use the download button instead.</p>';
    return () => {};
  }
  container.innerHTML = '';
  const first = await doc.getPage(1);
  const base = first.getViewport({ scale: 1 });
  const sheets = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const sheet = document.createElement('figure');
    sheet.className = 'pdf-page';
    sheet.style.aspectRatio = `${base.width} / ${base.height}`;
    sheet.innerHTML = `<canvas></canvas><figcaption>Page ${i} of ${doc.numPages}</figcaption>`;
    sheet.dataset.page = i;
    container.append(sheet);
    sheets.push(sheet);
  }
  const drawn = new Map();
  async function draw(sheet) {
    const n = Number(sheet.dataset.page);
    const width = sheet.clientWidth;
    if (!width || drawn.get(n) === width) return;
    drawn.set(n, width);
    const page = await doc.getPage(n);
    const vp1 = page.getViewport({ scale: 1 });
    const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
    const vp = page.getViewport({ scale: (width / vp1.width) * ratio });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    sheet.querySelector('canvas').replaceWith(canvas);
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) draw(e.target);
  }, { rootMargin: '600px 0px' });
  sheets.forEach((s) => io.observe(s));
  let t;
  const onResize = () => {
    clearTimeout(t);
    t = setTimeout(() => sheets.forEach((s) => {
      const r = s.getBoundingClientRect();
      if (r.bottom > -600 && r.top < innerHeight + 600) draw(s);
      else drawn.delete(Number(s.dataset.page));
    }), 200);
  };
  addEventListener('resize', onResize);
  return () => {
    io.disconnect();
    removeEventListener('resize', onResize);
    doc.destroy();
  };
}
