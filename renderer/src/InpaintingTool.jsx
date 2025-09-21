import { useState, useRef, useEffect } from 'react';
import { Wand2, Eraser, Undo2, Save } from 'lucide-react';
import { performAdvancedInpainting } from './helpers';

const InpaintingTool = ({
    mainCanvasRef,
    currentImage,
    currentImagePath,
    onImageSaved,
    zoomFactor,
    displayOffset,
    displaySize
}) => {
    const [isInpaintingMode, setIsInpaintingMode] = useState(false);
    const [brushSize, setBrushSize] = useState(80);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [originalImageData, setOriginalImageData] = useState(null);
    const [currentImageData, setCurrentImageData] = useState(null);
    const [maskAccumulated, setMaskAccumulated] = useState(null);

    const overlayCanvasRef = useRef(null);
    const maskCanvasRef = useRef(null);

    // Configurar canvas cuando entra en modo inpainting
    useEffect(() => {
        if (isInpaintingMode && mainCanvasRef.current && currentImage) {
            const mainCanvas = mainCanvasRef.current;
            const overlay = overlayCanvasRef.current;
            const mask = maskCanvasRef.current;

            if (overlay && mask) {
                overlay.width = mainCanvas.width;
                overlay.height = mainCanvas.height;
                overlay.style.width = mainCanvas.style.width;
                overlay.style.height = mainCanvas.style.height;

                mask.width = currentImage.width;
                mask.height = currentImage.height;

                const overlayCtx = overlay.getContext('2d');
                overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

                const maskCtx = mask.getContext('2d');
                maskCtx.clearRect(0, 0, mask.width, mask.height);
                setMaskAccumulated(maskCtx.getImageData(0, 0, mask.width, mask.height));

                if (!originalImageData) {
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = currentImage.width;
                    tempCanvas.height = currentImage.height;
                    const tempCtx = tempCanvas.getContext('2d');
                    tempCtx.drawImage(currentImage, 0, 0);
                    const originalData = tempCtx.getImageData(0, 0, currentImage.width, currentImage.height);
                    setOriginalImageData(originalData);
                    setCurrentImageData(new ImageData(new Uint8ClampedArray(originalData.data), originalData.width, originalData.height));
                }
            }
        }
    }, [isInpaintingMode, currentImage]);

    const getImageCoordinates = (clientX, clientY) => {
        const canvas = mainCanvasRef.current;
        if (!canvas || !currentImage) return null;

        const rect = canvas.getBoundingClientRect();
        const mouseX = clientX - rect.left;
        const mouseY = clientY - rect.top;

        if (mouseX < displayOffset.x || mouseX > displayOffset.x + displaySize.width ||
            mouseY < displayOffset.y || mouseY > displayOffset.y + displaySize.height) {
            return null;
        }

        const scale = Math.min(rect.width / currentImage.width, rect.height / currentImage.height) * zoomFactor;
        const imageX = (mouseX - displayOffset.x) / scale;
        const imageY = (mouseY - displayOffset.y) / scale;

        return {
            imageX: Math.max(0, Math.min(currentImage.width - 1, imageX)),
            imageY: Math.max(0, Math.min(currentImage.height - 1, imageY)),
            canvasX: mouseX,
            canvasY: mouseY
        };
    };

    const drawOnMask = (e) => {
        const overlay = overlayCanvasRef.current;
        const mask = maskCanvasRef.current;
        if (!overlay || !mask || !maskAccumulated || !mainCanvasRef.current || !currentImage) return;

        const coords = getImageCoordinates(e.clientX, e.clientY);
        if (!coords) return;

        const { imageX, imageY, canvasX, canvasY } = coords;

        const overlayCtx = overlay.getContext('2d');
        overlayCtx.globalCompositeOperation = 'source-over';
        overlayCtx.fillStyle = 'rgba(255, 50, 50, 0.5)';
        overlayCtx.beginPath();
        const scaledBrushSize = brushSize * (mainCanvasRef.current.getBoundingClientRect().width / mainCanvasRef.current.width) * zoomFactor;
        overlayCtx.arc(canvasX, canvasY, scaledBrushSize / 2, 0, 2 * Math.PI);
        overlayCtx.fill();

        const maskCtx = mask.getContext('2d');
        maskCtx.fillStyle = 'rgba(255, 255, 255, 255)';
        maskCtx.beginPath();
        maskCtx.arc(imageX, imageY, brushSize / 2, 0, 2 * Math.PI);
        maskCtx.fill();

        setMaskAccumulated(maskCtx.getImageData(0, 0, mask.width, mask.height));
    };

    const processInpainting = async () => {
        if (!mainCanvasRef.current || !maskAccumulated || !currentImageData) return;
        setIsProcessing(true);
        try {
            const result = performAdvancedInpainting(currentImageData, maskAccumulated);
            setCurrentImageData(result);
            const mainCtx = mainCanvasRef.current.getContext('2d');
            mainCtx.clearRect(0, 0, mainCanvasRef.current.width, mainCanvasRef.current.height);

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = result.width;
            tempCanvas.height = result.height;
            tempCanvas.getContext('2d').putImageData(result, 0, 0);

            const img = new Image();
            img.onload = () => {
                onImageSaved(img); // Notify parent to update the image
                setHasUnsavedChanges(true);
            };
            img.src = tempCanvas.toDataURL();

            clearVisualOverlay();
        } catch (error) {
            console.error('Error en inpainting:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const saveInpaintingChanges = async () => {
        if (!hasUnsavedChanges || !currentImageData || !currentImagePath) return;
        try {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = currentImageData.width;
            tempCanvas.height = currentImageData.height;
            tempCanvas.getContext('2d').putImageData(currentImageData, 0, 0);
            const editedImageDataUrl = tempCanvas.toDataURL('image/jpeg', 0.98);
            const result = await window.electronAPI.saveEditedImage(currentImagePath, editedImageDataUrl);
            if (result.success) {
                setHasUnsavedChanges(false);
                setOriginalImageData(new ImageData(new Uint8ClampedArray(currentImageData.data), currentImageData.width, currentImageData.height));
                clearAllMasks();
                console.log('Imagen guardada exitosamente:', result.backupPath);
            } else {
                alert('Error al guardar: ' + result.error);
            }
        } catch (error) {
            console.error('Error guardando:', error);
        }
    };

    const clearVisualOverlay = () => overlayCanvasRef.current?.getContext('2d').clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);

    const clearAllMasks = () => {
        clearVisualOverlay();
        if (maskCanvasRef.current && currentImage) {
            const ctx = maskCanvasRef.current.getContext('2d');
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            setMaskAccumulated(ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height));
        }
    };

    const undoInpainting = () => {
        if (!originalImageData) return;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = originalImageData.width;
        tempCanvas.height = originalImageData.height;
        tempCanvas.getContext('2d').putImageData(originalImageData, 0, 0);
        const img = new Image();
        img.onload = () => {
            onImageSaved(img);
            setCurrentImageData(new ImageData(new Uint8ClampedArray(originalImageData.data), originalImageData.width, originalImageData.height));
            setHasUnsavedChanges(false);
            clearAllMasks();
        };
        img.src = tempCanvas.toDataURL();
    };

    const exitInpaintingMode = () => {
        if (hasUnsavedChanges) {
            if (confirm('¿Guardar cambios antes de salir?')) saveInpaintingChanges();
            else undoInpainting();
        }
        setIsInpaintingMode(false);
        setOriginalImageData(null);
        setCurrentImageData(null);
        setMaskAccumulated(null);
        setHasUnsavedChanges(false);
        clearAllMasks();
    };

    const handleMouseDown = (e) => { if (isInpaintingMode) { e.preventDefault(); setIsDrawing(true); drawOnMask(e); } };
    const handleMouseMove = (e) => { if (isDrawing && isInpaintingMode) { e.preventDefault(); drawOnMask(e); } };
    const handleMouseUp = async (e) => { if (isDrawing && isInpaintingMode) { e.preventDefault(); setIsDrawing(false); await processInpainting(); } };

    useEffect(() => {
        const canvas = mainCanvasRef.current;
        if (!canvas) return;
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp); // Use window for mouseup
        return () => {
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isInpaintingMode, isDrawing, maskAccumulated, currentImageData]);

    return (
        <>
            <canvas ref={overlayCanvasRef} className="absolute inset-0 pointer-events-none" />
            <canvas ref={maskCanvasRef} className="absolute inset-0 pointer-events-none" style={{ display: 'none' }} />

            {isProcessing && (
                <div className="absolute inset-4 bg-black bg-opacity-70 flex items-center justify-center rounded">
                    <div className="bg-gray-800 rounded-lg p-3 flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm">Procesando borrado...</span>
                    </div>
                </div>
            )}

            <div className="p-4 border-t border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => setIsInpaintingMode(!isInpaintingMode)} className={`p-2 rounded flex items-center gap-1 ${isInpaintingMode ? 'bg-purple-600 hover:bg-purple-500' : 'bg-gray-700 hover:bg-gray-600'}`} title="Borrado generativo">
                        <Wand2 size={16} />
                    </button>
                    {isInpaintingMode && (
                        <>
                            <input type="range" min="30" max="80" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-16 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer" title={`Tamaño pincel: ${brushSize}px`} />
                            <button onClick={clearAllMasks} className="p-2 bg-orange-600 hover:bg-orange-500 rounded" title="Limpiar máscara"><Eraser size={16} /></button>
                            <button onClick={undoInpainting} disabled={!hasUnsavedChanges} className="p-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded" title="Deshacer todo"><Undo2 size={16} /></button>
                            <button onClick={saveInpaintingChanges} disabled={!hasUnsavedChanges} className="p-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded" title="Guardar cambios"><Save size={16} /></button>
                            <button onClick={exitInpaintingMode} className="p-2 bg-gray-600 hover:bg-gray-500 rounded text-xs" title="Salir">✕</button>
                        </>
                    )}
                </div>
                {isInpaintingMode && (
                    <div className="text-xs text-gray-400 text-center">
                        {hasUnsavedChanges ? `⚠ Cambios sin guardar - Pincel: ${brushSize}px` : `Pincel: ${brushSize}px - Pinta sobre áreas a eliminar`}
                    </div>
                )}
            </div>
        </>
    );
};

export default InpaintingTool;