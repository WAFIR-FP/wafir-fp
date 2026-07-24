function drawFingerprintScene(ctx) {
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

    const fonts = [
        '10pt no-real-font-123',
        '11pt Arial',
        '20pt Arial',
        "12pt 'Courier New'",
    ];

    fonts.forEach((font, index) => {
        ctx.font = font;
        ctx.fillStyle = `rgba(${index * 50}, ${255 - index * 50}, ${(index * 30) % 255}, 0.8)`;
        ctx.fillText(`Test ${index}`, 10 + index * 70, 55);
    });
}

export { drawFingerprintScene }
