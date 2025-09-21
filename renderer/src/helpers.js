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
 * Algoritmo de inpainting avanzado con múltiples técnicas.
 * @param {ImageData} imageData - Los datos de la imagen a procesar.
 * @param {ImageData} maskData - La máscara que indica las áreas a rellenar.
 * @returns {ImageData} - Los datos de la imagen procesada.
 */
export const performAdvancedInpainting = (imageData, maskData) => {
    const width = imageData.width;
    const height = imageData.height;
    const data = new Uint8ClampedArray(imageData.data);

    // Crear máscara binaria más precisa
    const mask = new Uint8ClampedArray(width * height);
    for (let i = 0; i < maskData.data.length; i += 4) {
        const alpha = maskData.data[i + 3];
        const brightness = (maskData.data[i] + maskData.data[i + 1] + maskData.data[i + 2]) / 3;
        mask[i / 4] = (alpha > 128 && brightness > 100) ? 255 : 0;
    }

    // Fase 1: Propagación inicial desde los bordes hacia adentro
    const initialIterations = 15;
    for (let iter = 0; iter < initialIterations; iter++) {
        const newData = new Uint8ClampedArray(data);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                const pixelIdx = idx * 4;

                if (mask[idx] > 128) {
                    let r = 0, g = 0, b = 0, totalWeight = 0;
                    let validSamples = 0;

                    // Usar un kernel adaptativo más grande para mejor propagación
                    const kernelRadius = Math.min(8, Math.max(3, iter + 2));

                    for (let dy = -kernelRadius; dy <= kernelRadius; dy++) {
                        for (let dx = -kernelRadius; dx <= kernelRadius; dx++) {
                            if (dx === 0 && dy === 0) continue;

                            const nx = x + dx;
                            const ny = y + dy;
                            const distance = Math.sqrt(dx * dx + dy * dy);

                            if (nx >= 0 && nx < width && ny >= 0 && ny < height && distance <= kernelRadius) {
                                const neighborIdx = ny * width + nx;
                                const neighborPixelIdx = neighborIdx * 4;

                                // Solo usar píxeles válidos (no marcados para borrar) o ya procesados
                                if (mask[neighborIdx] < 128 || (iter > 3 && data[neighborPixelIdx] !== 0)) {
                                    // Peso basado en distancia inversa con falloff gaussiano
                                    const weight = Math.exp(-(distance * distance) / (kernelRadius * kernelRadius * 0.5));

                                    r += data[neighborPixelIdx] * weight;
                                    g += data[neighborPixelIdx + 1] * weight;
                                    b += data[neighborPixelIdx + 2] * weight;
                                    totalWeight += weight;
                                    validSamples++;
                                }
                            }
                        }
                    }

                    if (totalWeight > 0 && validSamples >= 4) {
                        newData[pixelIdx] = Math.round(r / totalWeight);
                        newData[pixelIdx + 1] = Math.round(g / totalWeight);
                        newData[pixelIdx + 2] = Math.round(b / totalWeight);
                        newData[pixelIdx + 3] = 255;
                    }
                }
            }
        }

        data.set(newData);
    }

    // Fase 2: Suavizado adaptativo para eliminar artefactos
    const smoothingIterations = 8;
    for (let iter = 0; iter < smoothingIterations; iter++) {
        const newData = new Uint8ClampedArray(data);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                const pixelIdx = idx * 4;

                if (mask[idx] > 128) {
                    let r = 0, g = 0, b = 0;
                    let sampleCount = 0;

                    // Usar un kernel más pequeño para suavizado
                    const smoothRadius = 2;

                    for (let dy = -smoothRadius; dy <= smoothRadius; dy++) {
                        for (let dx = -smoothRadius; dx <= smoothRadius; dx++) {
                            const nx = x + dx;
                            const ny = y + dy;

                            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                const neighborPixelIdx = (ny * width + nx) * 4;
                                const distance = Math.sqrt(dx * dx + dy * dy);

                                if (distance <= smoothRadius) {
                                    // Peso gaussiano para suavizado natural
                                    const weight = Math.exp(-(distance * distance) / (smoothRadius * smoothRadius * 0.3));

                                    r += data[neighborPixelIdx] * weight;
                                    g += data[neighborPixelIdx + 1] * weight;
                                    b += data[neighborPixelIdx + 2] * weight;
                                    sampleCount += weight;
                                }
                            }
                        }
                    }

                    if (sampleCount > 0) {
                        // Mezclar con el resultado anterior para transición suave
                        const blendFactor = 0.7;
                        const currentR = data[pixelIdx];
                        const currentG = data[pixelIdx + 1];
                        const currentB = data[pixelIdx + 2];
                        const newR = Math.round(r / sampleCount);
                        const newG = Math.round(g / sampleCount);
                        const newB = Math.round(b / sampleCount);

                        newData[pixelIdx] = Math.round(currentR * (1 - blendFactor) + newR * blendFactor);
                        newData[pixelIdx + 1] = Math.round(currentG * (1 - blendFactor) + newG * blendFactor);
                        newData[pixelIdx + 2] = Math.round(currentB * (1 - blendFactor) + newB * blendFactor);
                    }
                }
            }
        }

        data.set(newData);
    }

    // Fase 3: Corrección de bordes para transición natural
    const edgeIterations = 5;
    for (let iter = 0; iter < edgeIterations; iter++) {
        const newData = new Uint8ClampedArray(data);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                const pixelIdx = idx * 4;

                // Solo procesar píxeles en el borde de la máscara
                if (mask[idx] > 128) {
                    let hasValidNeighbor = false;

                    // Verificar si está en el borde
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const nx = x + dx;
                            const ny = y + dy;

                            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                const neighborIdx = ny * width + nx;
                                if (mask[neighborIdx] < 128) {
                                    hasValidNeighbor = true;
                                    break;
                                }
                            }
                        }
                        if (hasValidNeighbor) break;
                    }

                    if (hasValidNeighbor) {
                        // Aplicar filtro bilateral para preservar bordes
                        let r = 0, g = 0, b = 0, totalWeight = 0;

                        for (let dy = -2; dy <= 2; dy++) {
                            for (let dx = -2; dx <= 2; dx++) {
                                const nx = x + dx;
                                const ny = y + dy;

                                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                    const neighborPixelIdx = (ny * width + nx) * 4;
                                    const distance = Math.sqrt(dx * dx + dy * dy);

                                    if (distance <= 2) {
                                        const spatialWeight = Math.exp(-(distance * distance) / (2 * 0.8 * 0.8));

                                        r += data[neighborPixelIdx] * spatialWeight;
                                        g += data[neighborPixelIdx + 1] * spatialWeight;
                                        b += data[neighborPixelIdx + 2] * spatialWeight;
                                        totalWeight += spatialWeight;
                                    }
                                }
                            }
                        }

                        if (totalWeight > 0) {
                            newData[pixelIdx] = Math.round(r / totalWeight);
                            newData[pixelIdx + 1] = Math.round(g / totalWeight);
                            newData[pixelIdx + 2] = Math.round(b / totalWeight);
                        }
                    }
                }
            }
        }

        data.set(newData);
    }

    return new ImageData(data, width, height);
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