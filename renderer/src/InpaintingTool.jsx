import React, { useState, useRef, useEffect } from 'react';
import { Brush, RotateCcw, Save, Undo } from 'lucide-react';

const InpaintingTool = ({ 
  mainCanvasRef, 
  currentImage, 
  currentImagePath, 
  onImageSaved, 
  zoomFactor, 
  displayOffset, 
  displaySize 
}) => {
  const [isInpaintMode, setIsInpaintMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(10);
  const [maskPaths, setMaskPaths] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const maskCanvasRef = useRef(null);
  const lastPointRef = useRef(null);

  // Initialize mask canvas when entering inpaint mode
  useEffect(() => {
    if (isInpaintMode && currentImage && maskCanvasRef.current) {
      const maskCanvas = maskCanvasRef.current;
      const mainCanvas = mainCanvasRef.current;
      
      if (mainCanvas) {
        maskCanvas.width = mainCanvas.width;
        maskCanvas.height = mainCanvas.height;
        
        // Clear the mask canvas
        const ctx = maskCanvas.getContext('2d');
        ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      }
    }
  }, [isInpaintMode, currentImage]);

  // Clear mask when switching images
  useEffect(() => {
    setMaskPaths([]);
    setHasUnsavedChanges(false);
    if (maskCanvasRef.current) {
      const ctx = maskCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    }
  }, [currentImagePath]);

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
    if (!isInpaintMode) return;
    
    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    setIsDrawing(true);
    setHasUnsavedChanges(true);
    lastPointRef.current = coords;
    
    // Start a new path
    const newPath = [coords];
    setMaskPaths(prev => [...prev, newPath]);
  };

  const draw = (e) => {
    if (!isDrawing || !isInpaintMode) return;
    
    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    if (!coords || !lastPointRef.current) return;

    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    const ctx = maskCanvas.getContext('2d');
    
    // Draw line on mask canvas
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    // Update current path
    setMaskPaths(prev => {
      const newPaths = [...prev];
      if (newPaths.length > 0) {
        newPaths[newPaths.length - 1].push(coords);
      }
      return newPaths;
    });

    lastPointRef.current = coords;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPointRef.current = null;
  };

  const clearMask = () => {
    setMaskPaths([]);
    setHasUnsavedChanges(false);
    if (maskCanvasRef.current) {
      const ctx = maskCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    }
  };

  const redrawMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    const ctx = maskCanvas.getContext('2d');
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'white';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    maskPaths.forEach(path => {
      if (path.length < 2) return;
      
      ctx.lineWidth = brushSize;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
      }
      ctx.stroke();
    });
  };

  const processInpainting = async () => {
    if (!currentImagePath || !window.electronAPI || maskPaths.length === 0) {
      alert('No hay máscara dibujada o imagen seleccionada');
      return;
    }

    setIsProcessing(true);

    try {
      // Create a temporary mask image with original image dimensions
      const tempMaskCanvas = document.createElement('canvas');
      const mainCanvas = mainCanvasRef.current;
      
      if (!mainCanvas || !currentImage) {
        throw new Error('Canvas o imagen no disponible');
      }

      // Set mask canvas to original image dimensions
      tempMaskCanvas.width = currentImage.width;
      tempMaskCanvas.height = currentImage.height;
      const tempCtx = tempMaskCanvas.getContext('2d');
      
      // Calculate scaling factors
      const scaleX = currentImage.width / displaySize.width;
      const scaleY = currentImage.height / displaySize.height;
      
      // Draw mask paths scaled to original image dimensions
      tempCtx.fillStyle = 'black';
      tempCtx.fillRect(0, 0, tempMaskCanvas.width, tempMaskCanvas.height);
      
      tempCtx.globalCompositeOperation = 'source-over';
      tempCtx.strokeStyle = 'white';
      tempCtx.lineCap = 'round';
      tempCtx.lineJoin = 'round';

      maskPaths.forEach(path => {
        if (path.length < 2) return;
        
        tempCtx.lineWidth = brushSize * scaleX;
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
      const result = await window.electronAPI.processInpainting(currentImagePath, maskDataUrl);
      
      if (result.success) {
        // Reload the updated image
        const imageData = await window.electronAPI.loadImage(currentImagePath);
        const img = new Image();
        
        img.onload = () => {
          onImageSaved(img);
          setHasUnsavedChanges(false);
          setMaskPaths([]);
          clearMask();
          alert('Inpainting completado exitosamente');
        };
        
        img.onerror = () => {
          throw new Error('Error cargando imagen procesada');
        };
        
        img.src = imageData;
      } else {
        throw new Error(result.error || 'Error desconocido en inpainting');
      }

    } catch (error) {
      console.error('Error processing inpainting:', error);
      alert(`Error en inpainting: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const undoLastStroke = () => {
    if (maskPaths.length === 0) return;
    
    setMaskPaths(prev => prev.slice(0, -1));
    setHasUnsavedChanges(maskPaths.length > 1);
    
    // Redraw mask without the last path
    setTimeout(redrawMask, 0);
  };

  // Add mouse event listeners to main canvas when in inpaint mode
  useEffect(() => {
    const mainCanvas = mainCanvasRef.current;
    if (!mainCanvas || !isInpaintMode) return;

    mainCanvas.addEventListener('mousedown', startDrawing);
    mainCanvas.addEventListener('mousemove', draw);
    mainCanvas.addEventListener('mouseup', stopDrawing);
    mainCanvas.addEventListener('mouseleave', stopDrawing);

    return () => {
      mainCanvas.removeEventListener('mousedown', startDrawing);
      mainCanvas.removeEventListener('mousemove', draw);
      mainCanvas.removeEventListener('mouseup', stopDrawing);
      mainCanvas.removeEventListener('mouseleave', stopDrawing);
    };
  }, [isInpaintMode, isDrawing, brushSize, displayOffset, displaySize]);

  // Redraw mask when paths change
  useEffect(() => {
    redrawMask();
  }, [maskPaths, brushSize]);

  return (
    <div className="border-t border-gray-700 bg-gray-800">
      {/* Hidden mask canvas */}
      <canvas
        ref={maskCanvasRef}
        className="hidden"
      />
      
      {/* Inpainting Controls */}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setIsInpaintMode(!isInpaintMode)}
            className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
              isInpaintMode 
                ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            <Brush size={14} />
            {isInpaintMode ? 'Salir Edición' : 'Editar Imagen'}
          </button>

          {isInpaintMode && (
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

              <button
                onClick={undoLastStroke}
                disabled={maskPaths.length === 0}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Deshacer último trazo"
              >
                <Undo size={14} />
              </button>

              <button
                onClick={clearMask}
                disabled={maskPaths.length === 0}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Limpiar máscara"
              >
                <RotateCcw size={14} />
              </button>

              <button
                onClick={processInpainting}
                disabled={maskPaths.length === 0 || isProcessing}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={14} />
                {isProcessing ? 'Procesando...' : 'Aplicar Inpainting'}
              </button>
            </>
          )}
        </div>

        {isInpaintMode && (
          <div className="text-xs text-gray-400 space-y-1">
            <p>• Dibuja sobre las áreas que quieres eliminar/reparar</p>
            <p>• El área dibujada será rellenada automáticamente</p>
            <p>• Usa trazos continuos para mejores resultados</p>
            {hasUnsavedChanges && (
              <p className="text-yellow-400">• Tienes cambios sin guardar</p>
            )}
          </div>
        )}
      </div>

      {/* Overlay mask canvas for visual feedback */}
      {isInpaintMode && (
        <canvas
          ref={maskCanvasRef}
          className="absolute top-0 left-0 pointer-events-none opacity-50"
          style={{
            mixBlendMode: 'screen',
            zIndex: 10
          }}
        />
      )}
    </div>
  );
};

export default InpaintingTool;