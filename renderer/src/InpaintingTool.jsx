import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Brush, RotateCcw, Undo } from 'lucide-react';
import { displayImageHelper } from './components/ImageManager';

const InpaintingTool = forwardRef(({ 
  mainCanvasRef, 
  currentImage, 
  currentImagePath,
  onImageUpdateFromInpaint,
  zoomFactor,
  displayOffset, 
  displaySize,
  children
}, ref) => {
  const [isInpaintMode, setIsInpaintMode] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(26);
  const [maskPaths, setMaskPaths] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [originalImageBackup, setOriginalImageBackup] = useState(null);
  const [hasBackedUpOriginal, setHasBackedUpOriginal] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Add current image path tracking to detect image switches
  const [currentImagePathRef, setCurrentImagePathRef] = useState(null);

  const lastPointRef = useRef(null);
  const drawTimeoutRef = useRef(null);
  const isInpaintingInProgressRef = useRef(false);

  const resetState = () => {
    setMaskPaths([]);
    setHasBackedUpOriginal(false);
    setOriginalImageBackup(null);
    setIsDrawing(false);
    lastPointRef.current = null;
    setHasUnsavedChanges(false);
    isInpaintingInProgressRef.current = false;
    setCurrentImagePathRef(null); // Reset path tracking
    if (drawTimeoutRef.current) {
      clearTimeout(drawTimeoutRef.current);
      drawTimeoutRef.current = null;
    }
  };

  // Expose the function of reset to parent component
  useImperativeHandle(ref, () => ({
    resetState,
    undoChanges,
    isProcessing,
    hasUnsavedChanges: () => hasUnsavedChanges,
    resetUnsavedChanges: () => setHasUnsavedChanges(false)
  }));

  // Reset state when image path changes (switching between thumbnails)
  useEffect(() => {
    if (currentImagePath !== currentImagePathRef) {
      // Clear any pending auto-apply
      if (drawTimeoutRef.current) {
        clearTimeout(drawTimeoutRef.current);
        drawTimeoutRef.current = null;
      }
      
      // Reset all inpainting state
      setMaskPaths([]);
      setIsDrawing(false);
      lastPointRef.current = null;
      setHasBackedUpOriginal(false);
      setOriginalImageBackup(null);
      setHasUnsavedChanges(false);
      isInpaintingInProgressRef.current = false;
      
      setCurrentImagePathRef(currentImagePath);
    }
  }, [currentImagePath, currentImagePathRef]);

  // Backup original image when starting to edit a new image
  useEffect(() => {
    if (isInpaintMode && currentImage && !hasBackedUpOriginal && currentImagePath) {
      setOriginalImageBackup(currentImage);
      setHasBackedUpOriginal(true);
    }
  }, [isInpaintMode, currentImage, hasBackedUpOriginal, currentImagePath]);

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
    setHasUnsavedChanges(true);
    lastPointRef.current = coords;
    
    // Start a new path
    const newPath = [coords];
    setMaskPaths(prev => [...prev, newPath]);
    
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

    // Update current stroke - safe to mutate last stroke directly
    if (maskPaths.length > 0) {
      maskPaths[maskPaths.length - 1].push(coords);
    }

    lastPointRef.current = coords;
  };

  const stopDrawing = () => {
    if (!isDrawing || isInpaintingInProgressRef.current) return;
    
    setIsDrawing(false);
    lastPointRef.current = null;
    
    // Auto-apply inpainting after a short delay
    if (maskPaths.length > 0) {
      drawTimeoutRef.current = setTimeout(() => {
        processInpainting();
      }, 300);
    }
  };

  const clearMask = () => {
    setMaskPaths([]);
    
    // Redraw clean image
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
      
      // Clear state FIRST
      setMaskPaths([]);
      setIsDrawing(false);
      lastPointRef.current = null;
      
      // Clear timeout
      if (drawTimeoutRef.current) {
        clearTimeout(drawTimeoutRef.current);
        drawTimeoutRef.current = null;
      }
      
      // Restore original image - notify parent to update state
      onImageUpdateFromInpaint(originalImageBackup);

      // Force immediate redraw with restored image
      displayImageHelper(originalImageBackup, mainCanvasRef.current, zoomFactor);
      
      // Don't reset backup state - allow multiple undos
    }
  };

  const processInpainting = async () => {
    if (!currentImagePath || !window.electronAPI || maskPaths.length === 0 || isInpaintingInProgressRef.current) {
      return;
    }

    setIsProcessing(true);
    isInpaintingInProgressRef.current = true;

    try {
      // Redraw all strokes on main canvas before processing
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
        const img = new Image();
        img.onload = () => {
          // Notify parent component to update image state
          onImageUpdateFromInpaint(img);
          setHasUnsavedChanges(true);
          // Force immediate redraw with new image
          displayImageHelper(img, mainCanvasRef.current, zoomFactor);
        };
        img.onerror = () => {
          console.error('❌ [INPAINT] Error cargando la imagen procesada desde base64');
          alert('Error al cargar la imagen procesada.');
        };

        img.src = result.imageData;
      } else {
        // If inpainting fails, redraw the current image to clear any temporary strokes
        displayImageHelper(currentImage, mainCanvasRef.current, zoomFactor);
        setMaskPaths([]); // Clear paths on failure too
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

  // Inject inpainting controls into children
  const childrenWithInpaintControls = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, {
        children: (
          <>
            {child.props.children}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400">Pincel:</label>
              <input
                type="range"
                min="5"
                max="50"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="w-24"
                disabled={isProcessing}
              />
              <span className="text-xs text-gray-400 w-6">{brushSize}</span>
              {hasBackedUpOriginal && (
                <button
                  onClick={undoChanges}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-500 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Restaurar imagen original"
                >
                  <Undo size={14} />
                  Deshacer Todo
                </button>
              )}
            </div>
          </>
        ),
      });
    }
    return child;
  });

  return (
    <>{childrenWithInpaintControls}</>
  );
});

export default InpaintingTool;