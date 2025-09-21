import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Brush, RotateCcw, Undo } from 'lucide-react';
import { displayImage as displayImageHelper } from './helpers';

const InpaintingTool = forwardRef(({ 
  mainCanvasRef, 
  currentImage, 
  currentImagePath,
  onImageUpdateFromInpaint,
  zoomFactor, 
  displayOffset, 
  displaySize
}, ref) => {
  const [isInpaintMode, setIsInpaintMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(26);
  const [maskPaths, setMaskPaths] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [originalImageBackup, setOriginalImageBackup] = useState(null);
  const [hasBackedUpOriginal, setHasBackedUpOriginal] = useState(false);

  const lastPointRef = useRef(null);
  const drawTimeoutRef = useRef(null);
  const isInpaintingInProgressRef = useRef(false);

  const resetState = () => {
    setMaskPaths([]);
    setHasBackedUpOriginal(false);
    setOriginalImageBackup(null);
    setIsDrawing(false);
    lastPointRef.current = null;
    isInpaintingInProgressRef.current = false;
    if (drawTimeoutRef.current) {
      clearTimeout(drawTimeoutRef.current);
      drawTimeoutRef.current = null;
    }
    setIsInpaintMode(false);
  };

  // Exponer la función de reinicio al componente padre
  useImperativeHandle(ref, () => ({
    resetState
  }));


  // Backup de imagen original al entrar en modo edición
  useEffect(() => {
    if (isInpaintMode && currentImage && !hasBackedUpOriginal) {
      setOriginalImageBackup(currentImage);
      setHasBackedUpOriginal(true);
    }
  }, [isInpaintMode, currentImage, hasBackedUpOriginal]);

  const getCanvasCoordinates = (clientX, clientY) => {
    const canvas = mainCanvasRef.current;
    if (!canvas || !currentImage) return null;

    const rect = canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    // Check if mouse is within the actual image bounds
    if (mouseX < displayOffset.x || mouseX > displayOffset.x + displaySize.width ||
        mouseY < displayOffset.y || mouseY > displayOffset.y + displaySize.height) {
      return null;
    }

    return { x: mouseX, y: mouseY };
  };

  const startDrawing = (e) => {
    if (!isInpaintMode || isInpaintingInProgressRef.current) return;
    
    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    setIsDrawing(true);
    lastPointRef.current = coords;
    
    // Start a new path
    const newPath = [coords];
    setMaskPaths(prev => [...prev, newPath]);
    console.log(`[INPAINT_DEBUG] startDrawing: Nuevo trazo añadido. Total de trazos: ${maskPaths.length + 1}`);
    
    // Clear any pending auto-apply
    if (drawTimeoutRef.current) {
      clearTimeout(drawTimeoutRef.current);
      drawTimeoutRef.current = null;
    }
  };

  const draw = (e) => {
    if (!isDrawing || !isInpaintMode || isInpaintingInProgressRef.current) return;
    
    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    if (!coords || !lastPointRef.current) return;

    const mainCanvas = mainCanvasRef.current;
    if (!mainCanvas) return;

    const ctx = mainCanvas.getContext('2d');
    
    // Save current canvas state
    ctx.save();
    
    // Set overlay drawing properties
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Draw line directly on main canvas
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    
    // Restore canvas state
    ctx.restore();

    // Actualizar el trazo actual.
    // Es seguro mutar el último trazo directamente porque fue creado como un nuevo array en startDrawing.
    // Esto evita problemas de estado obsoleto (stale state) durante eventos rápidos de mousemove.
    if (maskPaths.length > 0) {
      maskPaths[maskPaths.length - 1].push(coords);
      // console.log(`[INPAINT_DEBUG] draw: Añadiendo punto. Puntos en el último trazo: ${maskPaths[maskPaths.length - 1].length}`); // Log muy verboso, descomentar si es necesario
    }

    lastPointRef.current = coords;
  };

  const stopDrawing = () => {
    if (!isDrawing || isInpaintingInProgressRef.current) return;
    
    setIsDrawing(false);
    lastPointRef.current = null;
    
    // Auto-apply inpainting after a short delay
    if (maskPaths.length > 0) {
      console.log(`[INPAINT_DEBUG] stopDrawing: Se va a procesar con ${maskPaths.length} trazos.`);
      drawTimeoutRef.current = setTimeout(() => {
        processInpainting();
      }, 300);
    }
  };

  const clearMask = () => {
    setMaskPaths([]);
    
    // Redibujar imagen limpia
    if (currentImage && mainCanvasRef.current) {
      displayImageHelper(currentImage, mainCanvasRef.current, zoomFactor);
    }
    
    // Clear any pending auto-apply
    if (drawTimeoutRef.current) {
      clearTimeout(drawTimeoutRef.current);
      drawTimeoutRef.current = null;
    }
  };

  const undoChanges = () => {
    if (originalImageBackup && hasBackedUpOriginal && !isInpaintingInProgressRef.current) {
      
      // CRUCIAL: Limpiar completamente PRIMERO
      setMaskPaths([]);
      setIsDrawing(false);
      lastPointRef.current = null;
      
      // Limpiar timeout
      if (drawTimeoutRef.current) {
        clearTimeout(drawTimeoutRef.current);
        drawTimeoutRef.current = null;
      }
      
      // Restaurar imagen original - IMPORTANTE: usar una función especial que NO dispare guardado
      // Notificamos al padre para que actualice su estado y se redibuje todo correctamente.
      onImageUpdateFromInpaint(originalImageBackup);

      // Forzar el redibujado inmediato del canvas con la imagen original restaurada.
      displayImageHelper(originalImageBackup, mainCanvasRef.current, zoomFactor);
    }
  };

  const processInpainting = async () => {
    if (!currentImagePath || !window.electronAPI || maskPaths.length === 0 || isInpaintingInProgressRef.current) {
      return;
    }

    console.log(`[INPAINT_DEBUG] processInpainting: Iniciando proceso con ${maskPaths.length} trazos.`);
    setIsProcessing(true);
    isInpaintingInProgressRef.current = true;

    try {
      // --- INICIO DE LA CORRECCIÓN ---
      // Volver a dibujar todos los trazos en el lienzo principal antes de procesar.
      // Esto es crucial porque otras actualizaciones de estado pueden haber limpiado el lienzo.
      const mainCtx = mainCanvasRef.current.getContext('2d');
      mainCtx.save();
      mainCtx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      mainCtx.lineWidth = brushSize;
      mainCtx.lineCap = 'round';
      mainCtx.lineJoin = 'round';

      maskPaths.forEach(path => {
        if (path.length < 2) return;
        mainCtx.beginPath();
        mainCtx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
          mainCtx.lineTo(path[i].x, path[i].y);
        }
        mainCtx.stroke();
      });

      mainCtx.restore();
      // --- FIN DE LA CORRECCIÓN ---

      // Create a temporary mask image with original image dimensions
      const tempMaskCanvas = document.createElement('canvas');
      
      if (!currentImage) {
        throw new Error('No hay imagen disponible');
      }

      // Set mask canvas to original image dimensions
      tempMaskCanvas.width = currentImage.width;
      tempMaskCanvas.height = currentImage.height;
      const tempCtx = tempMaskCanvas.getContext('2d');
      
      // Calculate scaling factors
      const scaleX = currentImage.width / displaySize.width;
      const scaleY = currentImage.height / displaySize.height;
      
      // Fill with black background
      tempCtx.fillStyle = 'black';
      tempCtx.fillRect(0, 0, tempMaskCanvas.width, tempMaskCanvas.height);
      
      // Draw mask paths scaled to original image dimensions
      tempCtx.globalCompositeOperation = 'source-over';
      tempCtx.strokeStyle = 'white';
      tempCtx.lineCap = 'round';
      tempCtx.lineJoin = 'round';

      maskPaths.forEach(path => {
        if (path.length < 2) return;
        
        tempCtx.lineWidth = brushSize * Math.max(scaleX, scaleY);
        tempCtx.beginPath();
        
        const firstPoint = {
          x: (path[0].x - displayOffset.x) * scaleX,
          y: (path[0].y - displayOffset.y) * scaleY
        };
        tempCtx.moveTo(firstPoint.x, firstPoint.y);
        
        for (let i = 1; i < path.length; i++) {
          const point = {
            x: (path[i].x - displayOffset.x) * scaleX,
            y: (path[i].y - displayOffset.y) * scaleY
          };
          tempCtx.lineTo(point.x, point.y);
        }
        tempCtx.stroke();
      });

      // Convert mask canvas to base64
      const maskDataUrl = tempMaskCanvas.toDataURL('image/png');
      
      // Call the inpainting function
      console.log('[INPAINT_DEBUG] processInpainting: Llamando a electronAPI.processInpainting...');
      const result = await window.electronAPI.processInpainting(currentImagePath, maskDataUrl);
      
      if (result.success) {
        // La imagen procesada ahora viene como base64
        const img = new Image();
        img.onload = () => {
           // 1. Notificar al componente padre para que actualice la imagen en el estado.
          //    Esto asegura que el resto de la app (zoom, etc.) use la imagen correcta.
          onImageUpdateFromInpaint(img);
          // 2. Forzar el redibujado inmediato del canvas con la nueva imagen.
          //    Esto soluciona el problema de que el canvas no se actualice a tiempo.
          displayImageHelper(img, mainCanvasRef.current, zoomFactor);
        };
        img.onerror = () => {
          console.error('❌ [INPAINT] Error cargando la imagen procesada desde base64');
          alert('Error al cargar la imagen procesada.');
        };

        console.log('[INPAINT_DEBUG] processInpainting: Inpainting exitoso. Actualizando imagen.');
        img.src = result.imageData;
      } else {
        throw new Error(result.error || 'Error desconocido en inpainting');
      }

    } catch (error) {
      console.error('❌ [INPAINT] Error processing inpainting:', error);
      alert(`Error en inpainting: ${error.message}`);
    } finally {
      setIsProcessing(false);
      isInpaintingInProgressRef.current = false;
    }
  };

  // Add mouse event listeners to main canvas when in inpaint mode
  useEffect(() => {
    const mainCanvas = mainCanvasRef.current;
    if (!mainCanvas || !isInpaintMode) return;

    const handleMouseDown = (e) => startDrawing(e);
    const handleMouseMove = (e) => draw(e);
    const handleMouseUp = (e) => stopDrawing(e);
    const handleMouseLeave = (e) => stopDrawing(e);

    mainCanvas.addEventListener('mousedown', handleMouseDown);
    mainCanvas.addEventListener('mousemove', handleMouseMove);
    mainCanvas.addEventListener('mouseup', handleMouseUp);
    mainCanvas.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      mainCanvas.removeEventListener('mousedown', handleMouseDown);
      mainCanvas.removeEventListener('mousemove', handleMouseMove);
      mainCanvas.removeEventListener('mouseup', handleMouseUp);
      mainCanvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isInpaintMode, isDrawing, brushSize, displayOffset, displaySize]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (drawTimeoutRef.current) {
        clearTimeout(drawTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="border-t border-gray-700 bg-gray-800">
      {/* Inpainting Controls */}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setIsInpaintMode(!isInpaintMode)}
            disabled={isProcessing}
            className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
              isInpaintMode 
                ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Brush size={14} />
            {isInpaintMode ? 'Salir Edición' : 'Editar Imagen'}
          </button>

          {isInpaintMode && !isProcessing && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400">Pincel:</label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-16"
                />
                <span className="text-xs text-gray-400 w-6">{brushSize}</span>
              </div>

              {maskPaths.length > 0 && (
                <button
                  onClick={clearMask}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm font-medium"
                  title="Limpiar trazos actuales"
                >
                  <RotateCcw size={14} />
                  Limpiar
                </button>
              )}

              {hasBackedUpOriginal && (
                <button
                  onClick={undoChanges}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-500 rounded text-sm font-medium"
                  title="Restaurar imagen original"
                >
                  <Undo size={14} />
                  Deshacer Todo
                </button>
              )}
            </>
          )}
        </div>

        {isInpaintMode && (
          <div className="text-xs text-gray-400 space-y-1">
            <p>• Dibuja sobre las áreas que quieres eliminar/reparar</p>
            <p>• El inpainting se aplica automáticamente al soltar el mouse</p>
            <p>• Usa "Limpiar" para borrar trazos sin aplicar</p>
            <p className="text-yellow-400">• Los cambios NO se guardan hasta hacer clic en "Siguiente Producto"</p>
            {isProcessing && (
              <p className="text-yellow-400 font-medium">• Procesando inpainting... Por favor espera.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default InpaintingTool;