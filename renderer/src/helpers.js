/**
 * Genera un Identificador de URL único y limpio a partir de un nombre.
 * @param {string} name - El nombre base para la URL.
 * @returns {string} - El identificador de URL generado.
 */
export const generateUrlId = (name) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
    return name.toLowerCase()
        .replace(/[áéíóúñü]/g, match => ({
            'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n', 'ü': 'u'
        })[match])
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') + '-' + timestamp;
};

/**
 * Dibuja una imagen en un canvas, ajustándola al contenedor y centrada.
 * @param {HTMLImageElement} img - La imagen a dibujar.
 * @param {HTMLCanvasElement} canvas - El canvas principal.
 * @param {number} zoomFactor - El factor de zoom actual.
 * @returns {{width: number, height: number, x: number, y: number}} - Las dimensiones y offset de la imagen dibujada.
 */
export const displayImage = (img, canvas, zoomFactor) => {
    const ctx = canvas.getContext('2d');

    const rect = canvas.getBoundingClientRect();
    const containerWidth = Math.max(1, Math.floor(rect.width));
    const containerHeight = Math.max(1, Math.floor(rect.height));

    const scaleX = containerWidth / img.width;
    const scaleY = containerHeight / img.height;
    const scale = Math.min(scaleX, scaleY) * zoomFactor;

    const displayWidth = img.width * scale;
    const displayHeight = img.height * scale;

    const offsetX = (containerWidth - displayWidth) / 2;
    const offsetY = (containerHeight - displayHeight) / 2;

    canvas.width = containerWidth;
    canvas.height = containerHeight;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, offsetX, offsetY, displayWidth, displayHeight);

    return { width: displayWidth, height: displayHeight, x: offsetX, y: offsetY };
};