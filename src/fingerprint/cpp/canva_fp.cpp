#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

#ifdef __EMSCRIPTEN__
EM_JS(int, get_canva_fingerprint, (char *buf, int buf_len), {

  function writeToBuffer(value) {
    var len = lengthBytesUTF8(value) + 1;
    if (buf && buf_len > 0) {
      stringToUTF8(value, buf, buf_len);
    }
    return len;
  }

  var doc = null;
  if (typeof document !== 'undefined') {
    doc = document;
  } else if (typeof window !== 'undefined' && window.document) {
    doc = window.document;
  }

  if (!doc) {
    return writeToBuffer('Objeto document não disponível.');
  }

  try {
    var canvas = doc.createElement('canvas');
    canvas.width = 280;
    canvas.height = 60;

    var ctx = canvas.getContext('2d');
    if (!ctx) {
      return writeToBuffer('Falha ao obter o contexto 2d para uso da API Canvas 2D.');
    }

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);

    ctx.fillStyle = '#069';
    ctx.font = '11pt Arial';
    ctx.fillText('Cwm fjordbank glyphs vext quiz, 😃', 2, 15);

    ctx.fillStyle = 'rgba(100, 150, 200, 0.5)';
    ctx.fillRect(0, 20, 280, 20);

    ctx.strokeStyle = 'rgb(120, 186, 176)';
    ctx.beginPath();
    ctx.moveTo(20, 40);
    ctx.bezierCurveTo(20, 50, 200, 50, 200, 40);
    ctx.stroke();

    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(255, 125, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(50, 50, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    var fonts = [
      '10pt no-real-font-123',
      '11pt Arial',
      '20pt Arial',
      "12pt 'Courier New'"
    ];

    for (var i = 0; i < fonts.length; i++) {
      ctx.font = fonts[i];
      ctx.fillStyle = 'rgba(' + (i * 50) + ', ' + (255 - i * 50) + ', ' + ((i * 30) % 255) + ', 0.8)';
      ctx.fillText('Test ' + i, 10 + i * 70, 55);
    }

    return writeToBuffer(canvas.toDataURL());
  } catch (err) {
    var message = 'CanvasFingerprintError: ';
    if (err && err.message) {
      message += err.message;
    } else {
      message += 'unknown';
    }
    return writeToBuffer(message);
  }
});
#endif