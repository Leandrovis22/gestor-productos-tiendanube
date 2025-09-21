import React, { useState, useRef, useEffect } from 'react';
import { Brush, RotateCcw, Undo } from 'lucide-react';
import { displayImage as displayImageHelper } from './helpers';

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
  const [brushSize, setBrushSize] = useState(26);
  const [maskPaths, setMaskPaths] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [originalImageBackup, setOriginalImageBackup] = useState(null);
  const [hasBackedUpOriginal, setHasBackedUpOriginal] = useState(false);

  const overlayCanvasRef = useRef(null);
  const lastPointRef = useRef(null);
  const drawTimeoutRef = useRef(null);

  // Setup overlay - no separate canvas needed
  useEffect(() => {
    if (isInpaintMode && currentImage) {
      // Clear any existing overlay
      if (overlayCanvasRef.current) {
        const ctx = overlayCanvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      }
    }
  }, [isInpaintMode, currentImage, displayOffset, displaySize, zoomFactor]);

  // Clear everything when switching images
  useEffect(() => {
    setMaskPaths([]);
    setHasBackedUpOriginal(false);
    setOriginalImageBackup(null);
  }, [currentImagePath]);

  // Create backup of original image when first entering inpaint mode
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
    if (!isInpaintMode) return;
    
    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    setIsDrawing(true);
    lastPointRef.current = coords;
    
    // Start a new path
    const newPath = [coords];
    setMaskPaths(prev => [...prev, newPath]);
    
    // Clear any pending auto-apply
    if (drawTimeoutRef.current) {
      clearTimeout(drawTimeoutRef.current);
    }
  };

  const draw = (e) => {
    if (!isDrawing || !isInpaintMode) return;
    
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
    if (!isDrawing) return;
    
    setIsDrawing(false);
    lastPointRef.current = null;
    
    // Auto-apply inpainting after a short delay
    if (maskPaths.length > 0) {
      drawTimeoutRef.current = setTimeout(() => {
        processInpainting();
      }, 300); // 300ms delay
    }
  };

  const clearMask = () => {
    setMaskPaths([]);
    
    // Redraw the original image to clear overlay marks
    if (currentImage && mainCanvasRef.current) {
      const canvas = mainCanvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Redraw image
      const { width, height, x, y } = displayImageHelper(currentImage, canvas, zoomFactor);
      ctx.drawImage(currentImage, x, y, width, height);
    }
    
    // Clear any pending auto-apply
    if (drawTimeoutRef.current) {
      clearTimeout(drawTimeoutRef.current);
    }
  };

  const undoChanges = () => {
    if (originalImageBackup && hasBackedUpOriginal) {
      onImageSaved(originalImageBackup);
      
      // IMPORTANTE: Limpiar completamente todos los paths y estado
      setMaskPaths([]);
      setHasBackedUpOriginal(false);
      setOriginalImageBackup(null);
      
      // Limpiar cualquier timeout pendiente
      if (drawTimeoutRef.current) {
        clearTimeout(drawTimeoutRef.current);
      }
      
      // Forzar re-render del canvas limpio
      setTimeout(() => {
        if (originalImageBackup && mainCanvasRef.current) {
          displayImageHelper(originalImageBackup, mainCanvasRef.current, zoomFactor);
        }
      }, 50);
    }
  };

  // Local helper function to display image on canvas
  const displayImage = (img, canvas, zoom = 1) => {
    if (!img || !canvas) return { width: 0, height: 0, x: 0, y: 0 };
    
    const ctx = canvas.getContext('2d');
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Calculate scaling to fit image in canvas while maintaining aspect ratio
    const scale = Math.min(canvasWidth / img.width, canvasHeight / img.height) * zoom;
    const width = img.width * scale;
    const height = img.height * scale;
    
    // Center the image
    const x = (canvasWidth - width) / 2;
    const y = (canvasHeight - height) / 2;
    
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(img, x, y, width, height);
    
    return { width, height, x, y };
  };

  const processInpainting = async () => {
    if (!currentImagePath || !window.electronAPI || maskPaths.length === 0) {
      return;
    }

    setIsProcessing(true);

    try {
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
      const result = await window.electronAPI.processInpainting(currentImagePath, maskDataUrl);
      
      if (result.success) {
        // Reload the updated image
        const imageData = await window.electronAPI.loadImage(currentImagePath);
        const img = new Image();
        
        img.onload = () => {
          onImageSaved(img);
          clearMask();
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
    
    // Clear any pending auto-apply
    if (drawTimeoutRef.current) {
      clearTimeout(drawTimeoutRef.current);
    }
    
    // Redraw overlay without the last path
    setTimeout(redrawOverlay, 0);
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

  // Redraw overlay when paths change - not needed anymore since we draw directly
  useEffect(() => {
    // No action needed - drawing happens in real time on main canvas
  }, [maskPaths, brushSize]);

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
            <p>• Usa trazos continuos para mejores resultados</p>
            {isProcessing && (
              <p className="text-yellow-400">• Procesando inpainting...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InpaintingTool;