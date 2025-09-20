import { useState, useRef, useEffect } from 'react';
import { Brush, RotateCcw, ZoomIn, ZoomOut, Save, Loader2, Wand2 } from 'lucide-react';

const WebInpaintingTool = ({
    currentImage,
    currentImagePath,
    onImageEdited,
    displayCanvas
}) => {
    const [isInpaintingMode, setIsInpaintingMode] = useState(false);
    const [brushSize, setBrushSize] = useState(20);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [undoStack, setUndoStack] = useState([]);

    const overlayCanvasRef = useRef(null);
    const maskCanvasRef = useRef(null);

    // Configurar canvas overlay cuando se activa el modo inpainting
    useEffect(() => {
        if (isInpaintingMode && displayCanvas && overlayCanvasRef.current) {
            const overlay = overlayCanvasRef.current;
            const mask = maskCanvasRef.current;

            // Sincronizar tamaños
            overlay.width = displayCanvas.width;
            overlay.height = displayCanvas.height;
            mask.width = displayCanvas.width;
            mask.height = displayCanvas.height;

            // Limpiar máscaras
            const maskCtx = mask.getContext('2d');
            maskCtx.fillStyle = 'black';
            maskCtx.fillRect(0, 0, mask.width, mask.height);

            // Guardar estado actual para undo
            saveCurrentState();
        }
    }, [isInpaintingMode, displayCanvas]);

    const saveCurrentState = () => {
        if (!displayCanvas) return;
        const imageData = displayCanvas.toDataURL();
        setUndoStack(prev => [...prev, imageData]);
    };

    const handleMouseDown = (e) => {
        if (!isInpaintingMode) return;
        setIsDrawing(true);
        drawOnMask(e);
    };

    const handleMouseMove = (e) => {
        if (!isDrawing || !isInpaintingMode) return;
        drawOnMask(e);
    };

    const handleMouseUp = async () => {
        if (!isDrawing || !isInpaintingMode) return;
        setIsDrawing(false);

        // Auto-procesar inpainting
        await processWebInpainting();
    };

    const drawOnMask = (e) => {
        const overlay = overlayCanvasRef.current;
        const mask = maskCanvasRef.current;
        if (!overlay || !mask) return;

        const rect = overlay.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (overlay.width / rect.width);
        const y = (e.clientY - rect.top) * (overlay.height / rect.height);

        // Dibujar en el overlay (visual)
        const overlayCtx = overlay.getContext('2d');
        overlayCtx.globalCompositeOperation = 'source-over';
        overlayCtx.fillStyle = 'rgba(255, 0, 0, 0.5)'; // Rojo semi-transparente
        overlayCtx.beginPath();
        overlayCtx.arc(x, y, brushSize / 2, 0, 2 * Math.PI);
        overlayCtx.fill();

        // Dibujar en la máscara (para procesamiento)
        const maskCtx = mask.getContext('2d');
        maskCtx.fillStyle = 'white';
        maskCtx.beginPath();
        maskCtx.arc(x, y, brushSize / 2, 0, 2 * Math.PI);
        maskCtx.fill();
    };

    // Inpainting usando Canvas API y algoritmos JavaScript
    const processWebInpainting = async () => {
        const mainCanvas = displayCanvas;
        const maskCanvas = maskCanvasRef.current;

        if (!mainCanvas || !maskCanvas) return;

        setIsProcessing(true);

        try {
            // Obtener datos de imagen y máscara
            const mainCtx = mainCanvas.getContext('2d');
            const imageData = mainCtx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);

            const maskCtx = maskCanvas.getContext('2d');
            const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);

            // Procesar inpainting en Web Worker (no bloquea UI)
            const processedImageData = await processInpaintingWebWorker(imageData, maskData);

            // Aplicar resultado
            mainCtx.putImageData(processedImageData, 0, 0);

            setHasUnsavedChanges(true);
            clearOverlays();

        } catch (error) {
            console.error('Error en inpainting web:', error);
            alert('Error procesando el inpainting');
        } finally {
            setIsProcessing(false);
        }
    };

    // Procesar inpainting usando Web Worker para no bloquear UI
    const processInpaintingWebWorker = (imageData, maskData) => {
        return new Promise((resolve, reject) => {
            // Si no hay Web Workers disponibles, usar procesamiento directo
            if (typeof Worker === 'undefined') {
                resolve(processInpaintingDirect(imageData, maskData));
                return;
            }

            // Crear Web Worker inline
            const workerCode = `
        self.onmessage = function(e) {
          const { imageData, maskData } = e.data;
          const result = processInpainting(imageData, maskData);
          self.postMessage(result);
        };
        
        function processInpainting(imageData, maskData) {
          const width = imageData.width;
          const height = imageData.height;
          const data = new Uint8ClampedArray(imageData.data);
          
          // Simple inpainting por difusión
          const iterations = 5;
          
          for (let iter = 0; iter < iterations; iter++) {
            for (let y = 1; y < height - 1; y++) {
              for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                const maskIdx = (y * width + x) * 4;
                
                // Si este pixel necesita inpainting (máscara blanca)
                if (maskData.data[maskIdx] > 128) {
                  let r = 0, g = 0, b = 0, count = 0;
                  
                  // Promediar vecinos válidos
                  for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                      if (dx === 0 && dy === 0) continue;
                      
                      const nx = x + dx;
                      const ny = y + dy;
                      const nIdx = (ny * width + nx) * 4;
                      const nMaskIdx = (ny * width + nx) * 4;
                      
                      // Solo usar vecinos que no necesitan inpainting
                      if (maskData.data[nMaskIdx] < 128) {
                        r += data[nIdx];
                        g += data[nIdx + 1];
                        b += data[nIdx + 2];
                        count++;
                      }
                    }
                  }
                  
                  if (count > 0) {
                    data[idx] = r / count;
                    data[idx + 1] = g / count;
                    data[idx + 2] = b / count;
                  }
                }
              }
            }
          }
          
          return new ImageData(data, width, height);
        }
      `;

            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const worker = new Worker(URL.createObjectURL(blob));

            worker.onmessage = (e) => {
                resolve(e.data);
                worker.terminate();
                URL.revokeObjectURL(blob);
            };

            worker.onerror = (error) => {
                reject(error);
                worker.terminate();
            };

            worker.postMessage({ imageData, maskData });
        });
    };

    // Fallback para procesamiento directo (sin Web Worker)
    const processInpaintingDirect = (imageData, maskData) => {
        const width = imageData.width;
        const height = imageData.height;
        const data = new Uint8ClampedArray(imageData.data);

        // Algoritmo de inpainting simple por difusión
        const iterations = 8;

        for (let iter = 0; iter < iterations; iter++) {
            const newData = new Uint8ClampedArray(data);

            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = (y * width + x) * 4;
                    const maskIdx = idx;

                    // Si este pixel necesita inpainting
                    if (maskData.data[maskIdx] > 128) {
                        let r = 0, g = 0, b = 0, count = 0;

                        // Obtener promedio de vecinos válidos
                        const neighbors = [
                            [-1, -1], [-1, 0], [-1, 1],
                            [0, -1], [0, 1],
                            [1, -1], [1, 0], [1, 1]
                        ];

                        neighbors.forEach(([dx, dy]) => {
                            const nx = x + dx;
                            const ny = y + dy;

                            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                const nIdx = (ny * width + nx) * 4;
                                const nMaskIdx = nIdx;

                                // Solo usar píxeles que no necesitan inpainting
                                if (maskData.data[nMaskIdx] < 128) {
                                    r += data[nIdx];
                                    g += data[nIdx + 1];
                                    b += data[nIdx + 2];
                                    count++;
                                }
                            }
                        });

                        if (count > 0) {
                            newData[idx] = Math.round(r / count);
                            newData[idx + 1] = Math.round(g / count);
                            newData[idx + 2] = Math.round(b / count);
                            newData[idx + 3] = 255; // Alpha
                        }
                    }
                }
            }

            data.set(newData);
        }

        return new ImageData(data, width, height);
    };

    const clearOverlays = () => {
        const overlay = overlayCanvasRef.current;
        const mask = maskCanvasRef.current;

        if (overlay) {
            const ctx = overlay.getContext('2d');
            ctx.clearRect(0, 0, overlay.width, overlay.height);
        }

        if (mask) {
            const ctx = mask.getContext('2d');
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, mask.width, mask.height);
        }
    };

    const undoChanges = () => {
        if (undoStack.length === 0 || !displayCanvas) return;

        const lastState = undoStack[undoStack.length - 1];
        setUndoStack(prev => prev.slice(0, -1));

        const img = new Image();
        img.onload = () => {
            const ctx = displayCanvas.getContext('2d');
            ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
            ctx.drawImage(img, 0, 0);
            setHasUnsavedChanges(false);
        };
        img.src = lastState;

        clearOverlays();
    };

    const saveChanges = async () => {
        if (!hasUnsavedChanges || !displayCanvas || !currentImagePath) return;

        try {
            const editedImageData = displayCanvas.toDataURL('image/png');
            const result = await window.electronAPI.saveEditedImage(currentImagePath, editedImageData);

            if (result.success) {
                setHasUnsavedChanges(false);
                setUndoStack([]);
                if (onImageEdited) {
                    onImageEdited(currentImagePath);
                }
                console.log('Imagen guardada exitosamente');
            } else {
                alert('Error al guardar: ' + result.error);
            }
        } catch (error) {
            console.error('Error guardando:', error);
            alert('Error al guardar la imagen');
        }
    };

    const exitInpaintingMode = () => {
        if (hasUnsavedChanges) {
            const shouldSave = confirm('¿Guardar cambios antes de salir?');
            if (shouldSave) {
                saveChanges();
            } else if (undoStack.length > 0) {
                undoChanges();
            }
        }

        setIsInpaintingMode(false);
        setUndoStack([]);
        setHasUnsavedChanges(false);
        clearOverlays();
    };

    if (!displayCanvas) return null;

    return (
        <>
            {/* Canvas overlay para mostrar trazos */}
            <canvas
                ref={overlayCanvasRef}
                className={`absolute inset-0 pointer-events-${isInpaintingMode ? 'auto' : 'none'} ${isInpaintingMode ? 'cursor-crosshair' : ''
                    }`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => setIsDrawing(false)}
                style={{
                    zIndex: isInpaintingMode ? 10 : 0,
                    opacity: isInpaintingMode ? 1 : 0
                }}
            />

            {/* Canvas para máscara (invisible) */}
            <canvas
                ref={maskCanvasRef}
                className="absolute inset-0 pointer-events-none"
                style={{ display: 'none' }}
            />

            {/* Indicador de procesamiento */}
            {isProcessing && (
                <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center z-20">
                    <div className="bg-gray-800 rounded-lg p-4 flex items-center gap-3">
                        <Loader2 className="animate-spin text-blue-400" size={24} />
                        <span className="text-white">Aplicando borrado inteligente...</span>
                    </div>
                </div>
            )}

            {/* Panel de controles */}
            {isInpaintingMode && (
                <div className="absolute top-4 left-4 bg-gray-800 bg-opacity-95 rounded-lg p-3 shadow-lg z-15">
                    <div className="flex items-center gap-2 mb-3">
                        <Wand2 size={16} className="text-purple-400" />
                        <span className="text-sm font-medium text-white">Borrado Generativo</span>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs text-gray-300">Pincel:</span>
                        <input
                            type="range"
                            min="5"
                            max="80"
                            value={brushSize}
                            onChange={(e) => setBrushSize(parseInt(e.target.value))}
                            className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-xs text-gray-300 w-8">{brushSize}px</span>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={undoChanges}
                            disabled={undoStack.length === 0}
                            className="flex items-center gap-1 px-2 py-1 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs text-white"
                            title="Deshacer"
                        >
                            <RotateCcw size={12} />
                            Deshacer
                        </button>

                        <button
                            onClick={saveChanges}
                            disabled={!hasUnsavedChanges}
                            className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs text-white"
                            title="Guardar"
                        >
                            <Save size={12} />
                            Guardar
                        </button>

                        <button
                            onClick={exitInpaintingMode}
                            className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs text-white"
                            title="Salir"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="text-xs text-gray-300 mt-2">
                        {hasUnsavedChanges ? (
                            <span className="text-yellow-400">⚠ Cambios sin guardar</span>
                        ) : (
                            <span>Pinta sobre áreas a eliminar</span>
                        )}
                    </div>
                </div>
            )}

            {/* Botón para activar modo */}
            {!isInpaintingMode && (
                <button
                    onClick={() => setIsInpaintingMode(true)}
                    className="absolute bottom-4 right-4 flex items-center gap-2 bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg shadow-lg z-10 transition-colors"
                    title="Activar borrado generativo"
                >
                    <Wand2 size={18} />
                    <span className="text-sm font-medium">Borrado IA</span>
                </button>
            )}
        </>
    );
};

export default WebInpaintingTool;