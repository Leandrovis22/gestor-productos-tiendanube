// components/ImageManager.js
import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import InpaintingTool from '../InpaintingTool';

/**
 * Dibuja una imagen en un canvas, ajustándola al contenedor y centrada.
 * @param {HTMLImageElement} img - La imagen a dibujar.
 * @param {HTMLCanvasElement} canvas - El canvas principal.
 * @param {number} zoomFactor - El factor de zoom actual.
 * @param {Object} panOffset - El offset de arrastre { x, y }.
 * @returns {{width: number, height: number, x: number, y: number}} - Las dimensiones y offset de la imagen dibujada.
 */
export const displayImageHelper = (img, canvas, zoomFactor, panOffset = { x: 0, y: 0 }) => {
    const ctx = canvas.getContext('2d');

    const rect = canvas.getBoundingClientRect();
    const containerWidth = Math.max(1, Math.floor(rect.width));
    const containerHeight = Math.max(1, Math.floor(rect.height));

    const scaleX = containerWidth / img.width;
    const scaleY = containerHeight / img.height;
    const scale = Math.min(scaleX, scaleY) * zoomFactor;

    const displayWidth = img.width * scale;
    const displayHeight = img.height * scale;

    const offsetX = (containerWidth - displayWidth) / 2 + panOffset.x;
    const offsetY = (containerHeight - displayHeight) / 2 + panOffset.y;

    canvas.width = containerWidth;
    canvas.height = containerHeight;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, offsetX, offsetY, displayWidth, displayHeight);

    return { width: displayWidth, height: displayHeight, x: offsetX, y: offsetY };
};

// Componente para miniaturas de imágenes
const ProductThumbnailImage = ({ path, alt, className }) => {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let isMounted = true;
    const loadImage = async () => {
      const resolvedPath = await Promise.resolve(path);
      if (window.electronAPI && resolvedPath) {
        try {
          const imageData = await window.electronAPI.loadImage(resolvedPath);
          if (isMounted && imageData) {
            setSrc(imageData);
          }
        } catch (error) {
          console.error(`Error loading image ${path}:`, error);
        }
      }
    };
    loadImage();
    return () => { isMounted = false; };
  }, [path]);

  return src ? <img src={src} alt={alt} className={className} /> : <div className={`${className} bg-gray-700 animate-pulse`}></div>;
};

// Componente de miniaturas optimizado con memo
const ProductThumbnails = React.memo(({ 
  currentProductAllImages, 
  currentDisplayedImage, 
  currentMainProductImage, 
  workingDirectory, 
  onImageSelect 
}) => {
  const containerRef = useRef(null);

  // Configurar el evento wheel con passive: false
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelScroll = (e) => {
      e.preventDefault();
      container.scrollLeft += e.deltaY;
    };

    container.addEventListener('wheel', handleWheelScroll, { passive: false });

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheelScroll);
      }
    };
  }, []);
  
  if (currentProductAllImages.length <= 1) {
    return null; // No mostrar si solo hay una imagen o ninguna
  }

  return (
    <div className="p-2 border-t border-gray-700">
      <h4 className="text-xs text-gray-400 mb-2">
        Imágenes del producto ({currentProductAllImages.length}):
      </h4>
      <div 
        ref={containerRef}
        className="flex gap-2 overflow-x-auto overflow-y-hidden pb-1"
      >
        {currentProductAllImages.map((imgName) => {
          const isCurrentlyDisplayed = currentDisplayedImage === imgName;
          const isMainProduct = imgName === currentMainProductImage;

          return (
            <div
              key={imgName}
              className={`relative cursor-pointer border-2 rounded transition-all flex-shrink-0 ${
                isCurrentlyDisplayed
                  ? 'border-blue-500 shadow-lg bg-blue-900/20'
                  : 'border-transparent hover:border-gray-500'
              }`}
              onClick={() => onImageSelect(imgName)}
              title={`${imgName} ${isCurrentlyDisplayed ? '(mostrando)' : ''}`}
            >
              <ProductThumbnailImage
                path={window.electronAPI.joinPaths(workingDirectory, imgName)}
                alt={imgName}
                className="w-16 h-16 object-cover rounded-sm"
              />
              {isCurrentlyDisplayed && (
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                </div>
              )}
              {isMainProduct && (
                <div className="absolute -top-1 -right-1">
                  <div className="w-4 h-4 bg-green-500 rounded-full text-xs text-white flex items-center justify-center font-bold">
                    P
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Producto principal: {currentMainProductImage}
        {currentProductAllImages.length > 1 && ' + ' + (currentProductAllImages.length - 1) + ' secundarias'}
      </p>
    </div>
  );
});

// Hook personalizado para gestión de imágenes
export const useImageManager = () => {
  const [currentImage, setCurrentImage] = useState(null);
  const [currentImagePath, setCurrentImagePath] = useState('');
  const [currentDisplayedImage, setCurrentDisplayedImage] = useState('');
  const [zoomFactor, setZoomFactor] = useState(1.0);
  const [displayOffset, setDisplayOffset] = useState({ x: 0, y: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  const imageRef = useRef(null);
  const canvasRef = useRef(null);
  const loadingImageRef = useRef(null);
  const isInpaintingUpdateRef = useRef(false);
  const inpaintingToolRef = useRef(null);

  // Cargar imagen específica
  const loadImageOnly = async (imagePath, filename) => {
    if (!window.electronAPI) return;

    // Prevent concurrent image loads
    if (loadingImageRef.current === filename) {
      return;
    }

    loadingImageRef.current = filename;

    try {
      const exists = await window.electronAPI.fileExists(imagePath);
      if (!exists) {
        console.error('Image file does not exist:', imagePath);
        loadingImageRef.current = null;
        return;
      }

      // Si la imagen que se va a cargar no es la que se está cargando actualmente, detener.
      if (loadingImageRef.current !== filename) {
        return;
      }

      const imageData = await window.electronAPI.loadImage(imagePath);

      const img = new Image();
      img.onload = () => {
        // Final check before setting state
        if (loadingImageRef.current === filename) {
          setCurrentImage(img);
          setCurrentDisplayedImage(filename);
          setCurrentImagePath(imagePath);
          setZoomFactor(1.0);
          setPanOffset({ x: 0, y: 0 });
          setTimeout(() => displayImage(img), 100);
          loadingImageRef.current = null;
        }
      };
      img.onerror = (error) => {
        console.error('Error loading image:', error);
        loadingImageRef.current = null;
      };
      img.src = imageData;
    } catch (error) {
      console.error('Error loading image only:', error);
      loadingImageRef.current = null;
    }
  };

  // Mostrar imagen en el canvas
  const displayImage = (img) => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;

    const { width, height, x, y } = displayImageHelper(img, canvas, zoomFactor, panOffset);
    setDisplaySize({ width, height }); // Needed for coordinate mapping
    setDisplayOffset({ x, y }); // Needed for coordinate mapping
  };

  // Manejar zoom
  const handleZoom = (delta) => {
    const factor = delta > 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.1, Math.min(5.0, zoomFactor * factor));
    setZoomFactor(newZoom);
  };

  // Manejar zoom con posición del mouse
  const handleZoomAtPosition = (delta, mouseX, mouseY) => {
    const canvas = canvasRef.current;
    if (!canvas || !currentImage) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = mouseX - rect.left;
    const canvasY = mouseY - rect.top;

    // Factor de zoom
    const factor = delta > 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.1, Math.min(5.0, zoomFactor * factor));

    // Calcular el nuevo offset para mantener el punto del mouse en la misma posición
    const zoomDelta = newZoom / zoomFactor;
    
    // Ajustar el pan offset basado en la posición del mouse y el centro de la imagen
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    const mouseOffsetFromCenter = {
      x: canvasX - centerX,
      y: canvasY - centerY
    };
    
    const newPanX = panOffset.x - mouseOffsetFromCenter.x * (zoomDelta - 1);
    const newPanY = panOffset.y - mouseOffsetFromCenter.y * (zoomDelta - 1);

    setPanOffset({ x: newPanX, y: newPanY });
    setZoomFactor(newZoom);
  };

  // Iniciar arrastre
  const handleMouseDown = (e) => {
    if (e.button === 2) { // Botón derecho
      e.preventDefault();
      setIsDragging(true);
      const rect = canvasRef.current.getBoundingClientRect();
      setLastMousePos({ 
        x: e.clientX - rect.left, 
        y: e.clientY - rect.top 
      });
    }
  };

  // Manejar movimiento del mouse
  const handleMouseMove = (e) => {
    if (isDragging) {
      e.preventDefault();
      const rect = canvasRef.current.getBoundingClientRect();
      const currentMouseX = e.clientX - rect.left;
      const currentMouseY = e.clientY - rect.top;
      
      const deltaX = currentMouseX - lastMousePos.x;
      const deltaY = currentMouseY - lastMousePos.y;
      
      // Velocidad fija de arrastre
      const dragSpeed = 6; // Ajusta este valor para cambiar la velocidad
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      if (distance > 0) {
        // Normalizar la dirección y aplicar velocidad fija
        const normalizedX = deltaX / distance;
        const normalizedY = deltaY / distance;
        
        const moveX = normalizedX * Math.min(distance, dragSpeed);
        const moveY = normalizedY * Math.min(distance, dragSpeed);
        
        setPanOffset(prev => ({
          x: prev.x + moveX,
          y: prev.y + moveY
        }));
      }
      
      setLastMousePos({ x: currentMouseX, y: currentMouseY });
    }
  };

  // Finalizar arrastre
  const handleMouseUp = (e) => {
    if (e.button === 2) { // Botón derecho
      setIsDragging(false);
    }
  };

  // Prevenir menú contextual
  const handleContextMenu = (e) => {
    e.preventDefault();
  };

  // Resetear zoom
  const resetZoom = () => {
    setZoomFactor(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  // Cambiar a imagen de producto específica
  const switchToProductImage = async (targetImageName, workingDirectory) => {
    if (!workingDirectory || !targetImageName) return;

    // Don't switch if we're already on this image
    if (currentDisplayedImage === targetImageName) {
      return;
    }

    try {
      await saveCurrentImageIfEdited();
      const imagePath = await window.electronAPI.joinPaths(workingDirectory, targetImageName);
      await loadImageOnly(imagePath, targetImageName);
    } catch (error) {
      console.error('Error switching to product image:', error);
    }
  };

  // Guardar imagen actual si fue editada
  const saveCurrentImageIfEdited = async () => {
    if (currentImage && currentImagePath && inpaintingToolRef.current?.hasUnsavedChanges()) {
      await saveImageFromState(currentImage, currentImagePath);
      inpaintingToolRef.current.resetUnsavedChanges();
    }
  };

  // Guardar imagen desde el estado
  const saveImageFromState = async (imageObject, imagePath) => {
    if (!window.electronAPI || !imageObject || !imagePath) return;

    // Crear un canvas temporal para convertir el objeto Image a base64
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageObject.naturalWidth;
    tempCanvas.height = imageObject.naturalHeight;
    const ctx = tempCanvas.getContext('2d');
    ctx.drawImage(imageObject, 0, 0);
    const imageDataUrl = tempCanvas.toDataURL('image/jpeg', 0.98);
    await window.electronAPI.saveEditedImage(imagePath, imageDataUrl);
  };

  // Manejar actualización de imagen desde inpainting
  const handleInpaintingImageUpdate = (img) => {
    
    isInpaintingUpdateRef.current = true;
    setCurrentImage(img);
    
    setTimeout(() => { 
      isInpaintingUpdateRef.current = false; 
    }, 100);
  };

  // Reset completo del estado de imagen
  const resetImageState = () => {
    if (inpaintingToolRef.current) {
      inpaintingToolRef.current.resetState();
    }
    // No reseteamos currentImage, currentImagePath, etc. aquí porque 
    // se actualizarán cuando se cargue la nueva imagen
  };

  // Cargar producto con imagen principal
  const loadCurrentProduct = async (filename, workingDirectory, updateThumbnails, isNewProduct = false) => {
    if (!filename || !workingDirectory) {
      console.error('Missing filename or working directory');
      return;
    }

    try {
      updateThumbnails(filename);

      const imagePath = await window.electronAPI.joinPaths(workingDirectory, filename);
      
      // Reset inpainting state when loading a new product
      if (isNewProduct) {
        resetImageState();
      }
      
      await loadImageOnly(imagePath, filename);

    } catch (error) {
      console.error('Error loading current product:', error);
    }
  };

  return {
    // Estados
    currentImage,
    setCurrentImage,
    currentImagePath,
    currentDisplayedImage,
    zoomFactor,
    displayOffset,
    displaySize,
    panOffset,
    isDragging,
    
    // Referencias
    imageRef,
    canvasRef,
    inpaintingToolRef,
    
    // Funciones
    loadImageOnly,
    displayImage,
    handleZoom,
    handleZoomAtPosition,
    resetZoom,
    switchToProductImage,
    saveCurrentImageIfEdited,
    saveImageFromState,
    handleInpaintingImageUpdate,
    resetImageState,
    loadCurrentProduct,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu
  };
};

export const ImageManager = ({
  workingDirectory,
  currentProductAllImages,
  currentMainProductImage,
  currentDisplayedImage,
  activeTab,
  onImageSelect,
  imageManager // Recibe el hook completo
}) => {
  // Efectos para sincronizar con zoom y redimensionado
  useEffect(() => {
    if (imageManager.currentImage) {
        imageManager.displayImage(imageManager.currentImage);
    }
  }, [imageManager.zoomFactor, imageManager.panOffset, imageManager.currentImage]);

  // Efecto para forzar re-render de miniaturas cuando cambian las imágenes del producto
  useEffect(() => {
  }, [currentProductAllImages]);

  useEffect(() => {
    const handleResize = () => {
      if (imageManager.currentImage) {
        setTimeout(() => imageManager.displayImage(imageManager.currentImage), 100);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [imageManager.currentImage, imageManager.displayImage]);

  useEffect(() => {
    const canvas = imageManager.canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e) => {
      e.preventDefault();
      imageManager.handleZoomAtPosition(e.deltaY > 0 ? -1 : 1, e.clientX, e.clientY);
    };

    const handleMouseDown = (e) => {
      if (e.button === 2) { // Solo para botón derecho
        imageManager.handleMouseDown(e);
      }
    };

    const handleMouseMove = (e) => {
      if (imageManager.isDragging) {
        imageManager.handleMouseMove(e);
      }
    };

    const handleMouseUp = (e) => {
      if (e.button === 2 && imageManager.isDragging) { // Solo para botón derecho
        imageManager.handleMouseUp(e);
      }
    };

    const handleContextMenu = (e) => imageManager.handleContextMenu(e);

    // Event listeners del canvas
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('contextmenu', handleContextMenu);

    // Event listeners globales para capturar mouse fuera del canvas
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      if (canvas) {
        canvas.removeEventListener('wheel', handleWheel);
        canvas.removeEventListener('mousedown', handleMouseDown);
        canvas.removeEventListener('contextmenu', handleContextMenu);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [imageManager.canvasRef, imageManager.handleZoomAtPosition, imageManager.handleMouseDown, imageManager.handleMouseMove, imageManager.handleMouseUp, imageManager.handleContextMenu, imageManager.isDragging]);

  return (
    <div className="w-[500px] bg-gray-800 border-r border-gray-700 flex flex-col" ref={imageManager.imageRef}>
      <div className="flex-1 p-4 relative">
        <canvas
          ref={imageManager.canvasRef}
          className={`w-full h-full ${imageManager.isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        />
      </div>

      <InpaintingTool
        ref={imageManager.inpaintingToolRef}
        mainCanvasRef={imageManager.canvasRef}
        currentImage={imageManager.currentImage}
        currentImagePath={imageManager.currentImagePath}
        onImageUpdateFromInpaint={imageManager.handleInpaintingImageUpdate}
        zoomFactor={imageManager.zoomFactor}
        displayOffset={imageManager.displayOffset}
        displaySize={imageManager.displaySize}
        panOffset={imageManager.panOffset}
      >
        <div className="p-2 border-t border-gray-700 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button onClick={() => imageManager.handleZoom(1)} className="p-2 bg-gray-700 hover:bg-gray-600 rounded"><ZoomIn size={16} /></button>
            <button onClick={() => imageManager.handleZoom(-1)} className="p-2 bg-gray-700 hover:bg-gray-600 rounded"><ZoomOut size={16} /></button>
            <button onClick={imageManager.resetZoom} className="p-2 bg-gray-700 hover:bg-gray-600 rounded"><RotateCcw size={16} /></button>
          </div>
          {/* Inpainting controls will be injected here */}
        </div>
      </InpaintingTool>

      <ProductThumbnails 
        currentProductAllImages={currentProductAllImages}
        currentDisplayedImage={currentDisplayedImage}
        currentMainProductImage={currentMainProductImage}
        workingDirectory={workingDirectory}
        onImageSelect={onImageSelect}
      />
    </div>
  );
};