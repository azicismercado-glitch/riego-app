// Genera la "Conformidad Técnica" con el diseño institucional del CFI
// (franjas onduladas, logo, texto narrativo), a partir del texto que el
// técnico de CFI redacta/edita en la app antes de firmar. Es un documento
// distinto del PDF completo del diagnóstico (ver pdfDiagnostico.js): este
// es el que efectivamente confirma lo aprobado, para compartir hacia afuera.
const PDFDocument = require('pdfkit');
const zlib = require('zlib');

const NAVY = '#1C2443', CYAN = '#00A7E1', INK = '#1A1A1A';
const BAND_H = 85, WAVE_AMP = 16;

function pngDecodeOk(buf) {
  try {
    if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return false;
    let offset = 8;
    const idatParts = [];
    while (offset + 8 <= buf.length) {
      const len = buf.readUInt32BE(offset);
      const type = buf.toString('ascii', offset + 4, offset + 8);
      const dataStart = offset + 8;
      if (dataStart + len > buf.length) return false;
      if (type === 'IDAT') idatParts.push(buf.slice(dataStart, dataStart + len));
      if (type === 'IEND') break;
      offset = dataStart + len + 4;
    }
    if (!idatParts.length) return false;
    zlib.inflateSync(Buffer.concat(idatParts));
    return true;
  } catch (e) { return false; }
}

function topBand(doc) {
  const w = doc.page.width;
  const grad = doc.linearGradient(0, 0, w, 0);
  grad.stop(0, NAVY).stop(1, CYAN);
  doc.save();
  doc.path(
    `M0,0 L${w},0 L${w},${BAND_H - WAVE_AMP} ` +
    `C${w * 0.72},${BAND_H + WAVE_AMP} ${w * 0.5},${BAND_H - WAVE_AMP * 1.3} ${w * 0.32},${BAND_H} ` +
    `C${w * 0.14},${BAND_H + WAVE_AMP} ${w * 0.04},${BAND_H - WAVE_AMP} 0,${BAND_H - WAVE_AMP * 0.5} Z`
  ).fill(grad);
  doc.restore();
}

function bottomBand(doc) {
  const w = doc.page.width, h = doc.page.height, topY = h - BAND_H;
  const grad = doc.linearGradient(0, topY, w, topY);
  grad.stop(0, CYAN).stop(1, NAVY);
  doc.save();
  doc.path(
    `M0,${h} L${w},${h} L${w},${topY + WAVE_AMP} ` +
    `C${w * 0.72},${topY - WAVE_AMP} ${w * 0.5},${topY + WAVE_AMP * 1.3} ${w * 0.32},${topY} ` +
    `C${w * 0.14},${topY - WAVE_AMP} ${w * 0.04},${topY + WAVE_AMP} 0,${topY + WAVE_AMP * 0.5} Z`
  ).fill(grad);
  doc.restore();
}

// Parsea el texto libre que el técnico de CFI escribió/editó: detecta líneas
// "Etiqueta: valor" (campos del encabezado), viñetas (•/-/●) y párrafos.
function parseInforme(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let para = [];
  const flush = () => { if (para.length) { blocks.push({ type: 'p', text: para.join(' ') }); para = []; } };
  for (let raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (/^conformidad t[ée]cnica$/i.test(line)) continue; // el título lo dibujamos nosotros
    if (/^(programa de apoyo|provincia de)/i.test(line)) { flush(); blocks.push({ type: 'subtitle', text: line }); continue; }
    if (/^[•\-●]\s*/.test(line)) { flush(); blocks.push({ type: 'bullet', text: line.replace(/^[•\-●]\s*/, '') }); continue; }
    // Título de sección ("La propuesta contempla:", "Objetivos específicos:",
    // etc.): termina en ":" y no tiene nada más en la misma línea — se
    // detecta por forma, no por una lista de frases a mano.
    if (/:\s*$/.test(line) && line.length < 100) { flush(); blocks.push({ type: 'heading', text: line.replace(/:\s*$/, '') }); continue; }
    const m = line.match(/^([A-ZÁÉÍÓÚÑa-záéíóúñ0-9 /.]{2,42}):\s*(.+)$/);
    if (m && m[1].length < 42) {
      flush();
      blocks.push({ type: 'field', label: m[1].trim(), value: m[2].trim() });
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}

function generarConformidadPDF({ informe, signer, signedAt, signatureImage }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = 56, right = doc.page.width - 56, W = right - left;
    const bottomLimit = () => doc.page.height - BAND_H - 25;
    doc.on('pageAdded', () => { topBand(doc); doc.y = BAND_H + 34; doc.x = left; });

    topBand(doc);
    doc.y = BAND_H + 34; doc.x = left;

    doc.font('Helvetica-Bold').fontSize(21).fillColor(NAVY).text('CONFORMIDAD TÉCNICA', left, doc.y, { width: W, align: 'center' });
    doc.moveDown(0.7);
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor(NAVY).lineWidth(1).stroke();
    doc.moveDown(0.6);

    // Pdfkit pagina solo cuando un .text() se queda sin lugar en la página —
    // y como acá las páginas no tienen margin (lo maneja todo el layout de
    // las franjas), esa paginación automática deja texto mal ubicado. Por
    // eso se mide la altura real de cada bloque ANTES de escribirlo y se
    // agrega la página a mano si no entra entero, para que pdfkit nunca
    // tenga que partir un bloque por su cuenta.
    function blockHeight(blk) {
      if (blk.type === 'subtitle') {
        doc.font('Helvetica-Bold').fontSize(10.5);
        return doc.heightOfString(blk.text, { width: W });
      }
      if (blk.type === 'heading') {
        doc.font('Helvetica-Bold').fontSize(11);
        return doc.heightOfString(blk.text, { width: W }) + 12; // + aire arriba
      }
      if (blk.type === 'field') {
        doc.font('Helvetica').fontSize(10);
        return doc.heightOfString(`${blk.label}: ${blk.value}`, { width: W });
      }
      if (blk.type === 'bullet') {
        doc.font('Helvetica').fontSize(10);
        return doc.heightOfString('•  ' + blk.text, { width: W - 10, lineGap: 1.5 });
      }
      doc.font('Helvetica').fontSize(10);
      return doc.heightOfString(blk.text, { width: W, lineGap: 1.5 }) + 16;
    }

    const blocks = parseInforme(informe);
    for (let idx = 0; idx < blocks.length; idx++) {
      const blk = blocks[idx];
      let h = blockHeight(blk);
      // Un título de sección nunca debería quedar solo al pie de la página:
      // si no entra junto con lo que sigue, se manda todo a la próxima.
      if (blk.type === 'heading' && blocks[idx + 1]) h += blockHeight(blocks[idx + 1]);
      if (doc.y + h > bottomLimit()) doc.addPage();
      if (blk.type === 'subtitle') {
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor(CYAN).text(blk.text, left, doc.y, { width: W });
      } else if (blk.type === 'heading') {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text(blk.text, left, doc.y, { width: W });
        doc.moveDown(0.15);
      } else if (blk.type === 'field') {
        // Si no hay valor, NO se usa continued:true — con texto vacío pdfkit
        // deja la línea "colgada" sin avanzar el cursor, y lo siguiente
        // queda pisado encima (las líneas sin valor ya se clasifican como
        // 'heading' más arriba, esto queda solo como resguardo).
        if (blk.value) {
          doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(`${blk.label}: `, left, doc.y, { width: W, continued: true });
          doc.font('Helvetica').text(blk.value);
        } else {
          doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(`${blk.label}:`, left, doc.y, { width: W });
        }
      } else if (blk.type === 'bullet') {
        doc.font('Helvetica').fontSize(10).fillColor(INK).text('•  ' + blk.text, left + 10, doc.y, { width: W - 10, lineGap: 1.5 });
      } else {
        doc.moveDown(0.3);
        doc.font('Helvetica').fontSize(10).fillColor(INK).text(blk.text, left, doc.y, { width: W, align: 'justify', lineGap: 1.5 });
        doc.moveDown(0.3);
      }
    }

    // -------- fecha y firma --------
    const fecha = signedAt ? new Date(signedAt).toLocaleDateString('es-AR') : new Date().toLocaleDateString('es-AR');
    if (doc.y > bottomLimit() - 130) doc.addPage();
    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text('Fecha: ', left, doc.y, { continued: true });
    doc.font('Helvetica').text(fecha);
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').text('Firma:');

    if (signatureImage) {
      try {
        const b64 = String(signatureImage).replace(/^data:image\/\w+;base64,/, '');
        const buf = Buffer.from(b64, 'base64');
        if (pngDecodeOk(buf)) {
          const imgY = doc.y + 2;
          doc.image(buf, left, imgY, { width: 140, height: 50, fit: [140, 50] });
          doc.y = imgY + 54;
        }
      } catch (e) { /* si la firma está corrupta, se omite sin romper el documento */ }
    } else {
      doc.moveDown(2.2);
    }

    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(signer || 'Equipo Técnico CFI', left, doc.y, { width: W });
    doc.font('Helvetica').fontSize(9).fillColor(INK).text('Equipo Técnico – Programa de Apoyo para la Tecnificación del Riego – CFI', left, doc.y, { width: W });

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      bottomBand(doc);
    }

    doc.end();
  });
}

module.exports = { generarConformidadPDF };
