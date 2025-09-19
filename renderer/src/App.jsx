import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  FolderOpen, 
  FileText, 
  Save, 
  SkipForward, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Plus,
  Minus,
  Search,
  X
} from 'lucide-react';
import Papa from 'papaparse';

const TiendaNubeProductManager = () => {
  // Estados principales
  const [csvData, setCsvData] = useState([]);
  const [csvPath, setCsvPath] = useState('');
  const [workingDirectory, setWorkingDirectory] = useState('');
  const [imageQueue, setImageQueue] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentImage, setCurrentImage] = useState(null);
  const [originalImage, setOriginalImage] = useState(null);
  const [outputCsvPath, setOutputCsvPath] = useState('');
  
  // Estados de la imagen
  const [zoomFactor, setZoomFactor] = useState(1.0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(33);
  const [maskCanvas, setMaskCanvas] = useState(null);
  const [displayOffset, setDisplayOffset] = useState({ x: 0, y: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  
  // Estados del formulario
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productStock, setProductStock] = useState('10');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [originalCategories, setOriginalCategories] = useState('');
  
  // Estados de variantes
  const [useColor, setUseColor] = useState(false);
  const [useSize, setUseSize] = useState(false);
  const [useType, setUseType] = useState(false);
  const [selectedColors, setSelectedColors] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [typeName, setTypeName] = useState('Tipo');
  const [typeValues, setTypeValues] = useState('Modelo A\nModelo B\nModelo C');
  const [variantCombinations, setVariantCombinations] = useState([]);
  
  // Estados UI
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategorySearch, setShowCategorySearch] = useState(false);
  
  // Referencias
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const maskCanvasRef = useRef(null);
  
  // Definiciones de datos
  const predefinedColors = [
    "Amarillo", "Azul", "Beige", "Blanco", "Bordó", "Celeste",
    "Fucsia", "Gris", "Marrón", "Naranja", "Negro", "Plata",
    "Rojo", "Rosa", "Verde", "Violeta", "Transparente", "Multicolor"
  ];

  const predefinedSizes = ["XS", "S", "M", "L", "XL", "XXL"];

  const categories = [
    "Plata > Conjuntos",
    "Plata > Cadenas", 
    "Plata > Dijes",
    "Plata > Aros > Argollas",
    "Plata > Aros > Aros pasantes",
    "Plata > Aros > Abridores",
    "Acero > Acero Blanco > Aros > Cuff",
    "Acero > Acero Blanco > Aros > Aros Pasantes",
    "Acero > Acero Blanco > Aros > Abridores",
    "Acero > Acero Blanco > Aros > Argollas",
    "Acero > Acero Blanco > Anillos",
    "Acero > Acero Blanco > Anillos > Alianzas",
    "Acero > Acero Blanco > Cadena",
    "Acero > Acero Blanco > Dijes",
    "Acero > Acero Blanco > Pulseras",
    "Acero > Acero Blanco > Esclavas",
    "Acero > Acero Quirúrgico > Aros",
    "Acero > Acero Quirúrgico > Anillos",
    "Acero > Acero Dorado > Aros > Aros Pasantes",
    "Acero > Acero Dorado > Aros > Abridores",
    "Acero > Acero Dorado > Aros > Argollas",
    "Acero > Acero Dorado > Cadena",
    "Acero > Acero Dorado > Dijes",
    "Acero > Acero Dorado > Pulseras",
    "Acero > Acero Dorado > Esclavas",
    "Acero > Acero Dorado > Anillos",
    "Alhajero",
    "Cristal",
    "Pulseras"
  ];

  // Funciones de archivo
  const selectCsvFile = async () => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.selectFile([
          { name: 'CSV Files', extensions: ['csv'] }
        ]);
        if (result.filePath && !result.canceled) {
          setCsvPath(result.filePath);
          loadCsvData(result.filePath);
        }
      } else {
        // Fallback para desarrollo web
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (file) {
            setCsvPath(file.name);
            const reader = new FileReader();
            reader.onload = (e) => {
              const csvText = e.target.result;
              Papa.parse(csvText, {
                header: true,
                delimiter: ';',
                complete: (results) => {
                  setCsvData(results.data);
                  loadImagesFromData(results.data);
                }
              });
            };
            reader.readAsText(file);
          }
        };
        input.click();
      }
    } catch (error) {
      console.error('Error selecting CSV file:', error);
    }
  };

  const selectWorkingDirectory = async () => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.selectDirectory();
        if (result.directoryPath && !result.canceled) {
          setWorkingDirectory(result.directoryPath);
          await createOutputCsv(result.directoryPath);
          // Crear carpetas necesarias
          await window.electronAPI.createDirectory(`${result.directoryPath}/saltadas`);
          await window.electronAPI.createDirectory(`${result.directoryPath}/procesadas`);
          
          // Si ya tenemos datos CSV, recargar las imágenes
          if (csvData.length > 0) {
            loadImagesFromData(csvData);
          }
        }
      } else {
        // Para desarrollo web, usar un directorio simulado
        setWorkingDirectory('/simulado/directorio');
        createOutputCsv('/simulado/directorio');
      }
    } catch (error) {
      console.error('Error selecting directory:', error);
    }
  };

  const loadCsvData = async (filePath) => {
    if (window.electronAPI) {
      try {
        const data = await window.electronAPI.readCsv(filePath);
        setCsvData(data);
        // Si ya tenemos directorio de trabajo, cargar imágenes
        if (workingDirectory) {
          loadImagesFromData(data);
        }
      } catch (error) {
        console.error('Error loading CSV:', error);
        alert(`Error al cargar el archivo CSV: ${error.message}`);
      }
    }
  };

  const loadImagesFromData = (data) => {
    if (data && data.length > 0 && workingDirectory) {
      const imageFiles = data.map(row => row.archivo).filter(Boolean);
      setImageQueue(imageFiles);
      setCurrentImageIndex(0);
      if (imageFiles.length > 0) {
        loadCurrentImage(imageFiles[0], data);
      }
    }
  };

  const createOutputCsv = async (directory) => {
    const outputPath = `${directory}/salida.csv`;
    setOutputCsvPath(outputPath);
    
    // Headers para el CSV de salida
    const headers = [
      '"Identificador de URL"', 'Nombre', 'Categorías',
      '"Nombre de propiedad 1"', '"Valor de propiedad 1"',
      '"Nombre de propiedad 2"', '"Valor de propiedad 2"', 
      '"Nombre de propiedad 3"', '"Valor de propiedad 3"',
      'Precio', '"Precio promocional"', '"Peso (kg)"',
      '"Alto (cm)"', '"Ancho (cm)"', '"Profundidad (cm)"', 'Stock',
      'SKU', '"Código de barras"', '"Mostrar en tienda"', '"Envío sin cargo"',
      'Descripción', 'Tags', '"Título para SEO"', '"Descripción para SEO"',
      'Marca', '"Producto Físico"', '"MPN (Número de pieza del fabricante)"',
      'Sexo', '"Rango de edad"', 'Costo'
    ];

    if (window.electronAPI) {
      await window.electronAPI.createCsv(outputPath, headers);
    }
  };

  // Funciones de imagen
  const loadCurrentImage = async (filename, data = csvData) => {
    if (!filename || !workingDirectory) {
      console.error('Missing filename or working directory');
      return;
    }

    if (window.electronAPI) {
      try {
        const imagePath = `${workingDirectory}/${filename}`;
        console.log('Loading image from:', imagePath);
        
        // Verificar si el archivo existe
        const exists = await window.electronAPI.fileExists(imagePath);
        if (!exists) {
          console.error('Image file does not exist:', imagePath);
          return;
        }
        
        const imageData = await window.electronAPI.loadImage(imagePath);
        
        const img = new Image();
        img.onload = () => {
          console.log('Image loaded successfully:', filename);
          setCurrentImage(img);
          setOriginalImage(img);
          setZoomFactor(1.0);
          setMaskCanvas(null);
          loadProductData(filename, data);
          // Usar setTimeout para asegurar que el canvas esté renderizado
          setTimeout(() => displayImage(img), 100);
        };
        img.onerror = (error) => {
          console.error('Error loading image:', error);
        };
        img.src = imageData;
      } catch (error) {
        console.error('Error loading image:', error);
      }
    } else {
      // Para desarrollo, usar imagen placeholder
      const img = new Image();
      img.onload = () => {
        setCurrentImage(img);
        setOriginalImage(img);
        setZoomFactor(1.0);
        loadProductData(filename, data);
        setTimeout(() => displayImage(img), 100);
      };
      img.src = `https://picsum.photos/400/400?random=${Math.random()}`;
    }
  };

  const displayImage = (img) => {
    const canvas = canvasRef.current;
    if (!canvas || !img) {
      console.log('Canvas or image not available for display');
      return;
    }

    const ctx = canvas.getContext('2d');
    const canvasRect = canvas.getBoundingClientRect();
    const canvasWidth = canvasRect.width;
    const canvasHeight = canvasRect.height;
    
    // Ajustar el tamaño del canvas a su tamaño visual
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Calcular escala para ajustar la imagen al canvas
    const scale = Math.min(canvasWidth / img.width, canvasHeight / img.height) * zoomFactor;
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    
    const offsetX = (canvasWidth - scaledWidth) / 2;
    const offsetY = (canvasHeight - scaledHeight) / 2;
    
    setDisplayOffset({ x: offsetX, y: offsetY });
    setDisplaySize({ width: scaledWidth, height: scaledHeight });
    
    // Limpiar canvas y dibujar fondo
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Dibujar la imagen
    ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
    
    console.log('Image displayed successfully');
  };

  const loadProductData = (filename, data = csvData) => {
    const row = data.find(r => r.archivo === filename);
    
    // Limpiar selecciones anteriores
    setSelectedCategories([]);
    
    if (row) {
      setProductName(row.descripcion || '');
      setProductPrice(row.precio?.replace('$', '').replace(',', '.') || '');
      setOriginalCategories(row.categorias || '');
      
      if (row.categorias) {
        const cats = row.categorias.split(',').map(c => c.trim());
        setSelectedCategories(cats);
      }
    } else {
      setProductName('');
      setProductPrice('');
      setOriginalCategories('');
    }
    
    // Limpiar variantes
    setSelectedColors([]);
    setSelectedSizes([]);
    setTypeValues('Modelo A\nModelo B\nModelo C');
    setVariantCombinations([]);
  };

  // Funciones de navegación
  const nextImage = () => {
    saveCurrentProduct();
    
    if (currentImageIndex >= imageQueue.length - 1) {
      alert('Has procesado todos los productos de la cola.');
      return;
    }
    
    const newIndex = currentImageIndex + 1;
    setCurrentImageIndex(newIndex);
    loadCurrentImage(imageQueue[newIndex]);
  };

  const skipImage = async () => {
    if (currentImageIndex < imageQueue.length && workingDirectory) {
      const filename = imageQueue[currentImageIndex];
      
      try {
        // Mover imagen a carpeta saltadas
        const sourcePath = `${workingDirectory}/${filename}`;
        const destPath = `${workingDirectory}/saltadas/${filename}`;
        
        const exists = await window.electronAPI.fileExists(sourcePath);
        if (exists) {
          const result = await window.electronAPI.moveFile(sourcePath, destPath);
          if (result.success) {
            console.log(`Image ${filename} moved to saltadas folder`);
          } else {
            console.error('Error moving file:', result.error);
          }
        }
        
        // Actualizar CSV data removiendo la imagen saltada
        const updatedCsvData = csvData.filter(row => row.archivo !== filename);
        setCsvData(updatedCsvData);
        
        // Actualizar cola de imágenes
        const newQueue = imageQueue.filter((_, index) => index !== currentImageIndex);
        setImageQueue(newQueue);
        
        // Ajustar índice actual
        if (currentImageIndex >= newQueue.length && currentImageIndex > 0) {
          setCurrentImageIndex(currentImageIndex - 1);
        }
        
        // Cargar siguiente imagen
        if (newQueue.length > 0) {
          const nextIndex = currentImageIndex >= newQueue.length ? currentImageIndex - 1 : currentImageIndex;
          loadCurrentImage(newQueue[nextIndex], updatedCsvData);
        }
      } catch (error) {
        console.error('Error skipping image:', error);
        alert(`Error al saltar la imagen: ${error.message}`);
      }
    }
  };

  // Funciones de edición de imagen
  const handleZoom = (delta) => {
    const factor = delta > 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.1, Math.min(5.0, zoomFactor * factor));
    setZoomFactor(newZoom);
    
    if (currentImage) {
      displayImage(currentImage);
    }
  };

  const resetImage = () => {
    if (originalImage) {
      setCurrentImage(originalImage);
      setZoomFactor(1.0);
      setMaskCanvas(null);
      displayImage(originalImage);
    }
  };

  // Funciones de dibujo y borrado
  const startDrawing = (e) => {
    if (!currentImage) return;
    setIsDrawing(true);
    drawBrush(e);
  };

  const drawBrush = (e) => {
    if (!isDrawing || !currentImage) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Verificar si está dentro de la imagen
    if (x < displayOffset.x || y < displayOffset.y || 
        x > displayOffset.x + displaySize.width || 
        y > displayOffset.y + displaySize.height) {
      return;
    }
    
    // Crear máscara si no existe
    if (!maskCanvas) {
      const mask = document.createElement('canvas');
      mask.width = currentImage.width;
      mask.height = currentImage.height;
      const maskCtx = mask.getContext('2d');
      maskCtx.fillStyle = 'black';
      maskCtx.fillRect(0, 0, mask.width, mask.height);
      setMaskCanvas(mask);
    }
    
    // Dibujar en la máscara
    const maskCtx = maskCanvas.getContext('2d');
    if (maskCtx) {
      const scaleX = currentImage.width / displaySize.width;
      const scaleY = currentImage.height / displaySize.height;
      const imgX = (x - displayOffset.x) * scaleX;
      const imgY = (y - displayOffset.y) * scaleY;
      const brushRadius = brushSize * Math.max(scaleX, scaleY) / 2;
      
      maskCtx.fillStyle = 'white';
      maskCtx.beginPath();
      maskCtx.arc(imgX, imgY, brushRadius, 0, Math.PI * 2);
      maskCtx.fill();
    }
    
    // Mostrar la máscara en el canvas principal
    const mainCtx = canvas.getContext('2d');
    mainCtx.save();
    mainCtx.globalAlpha = 0.5;
    mainCtx.fillStyle = 'red';
    mainCtx.beginPath();
    mainCtx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    mainCtx.fill();
    mainCtx.restore();
  };

  const stopDrawing = async () => {
    if (isDrawing) {
      setIsDrawing(false);
      await performInpainting();
    }
  };

  const performInpainting = async () => {
    if (!maskCanvas || !currentImage || !workingDirectory) return;
    
    try {
      const filename = imageQueue[currentImageIndex];
      const imagePath = `${workingDirectory}/${filename}`;
      
      // Por ahora, simular el inpainting - en una implementación real
      // aquí enviarías la máscara al proceso de inpainting
      console.log('Performing inpainting...');
      
      if (window.electronAPI) {
        // Convertir máscara a datos
        const maskData = maskCanvas.toDataURL();
        const processedImage = await window.electronAPI.processInpainting(imagePath, maskData);
        
        // Cargar la imagen procesada
        const img = new Image();
        img.onload = () => {
          setCurrentImage(img);
          setMaskCanvas(null);
          displayImage(img);
        };
        img.src = processedImage;
      }
    } catch (error) {
      console.error('Error performing inpainting:', error);
    }
  };

  // Funciones de categorías
  const toggleCategory = (category) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const selectAllCategories = () => {
    setSelectedCategories([...categories]);
  };

  const clearAllCategories = () => {
    setSelectedCategories([]);
  };

  const filteredCategories = categories.filter(cat => 
    cat.toLowerCase().includes(categorySearch.toLowerCase())
  );

  // Funciones de variantes
  const toggleColor = (color) => {
    setSelectedColors(prev => 
      prev.includes(color) 
        ? prev.filter(c => c !== color)
        : [...prev, color]
    );
  };

  const toggleSize = (size) => {
    setSelectedSizes(prev => 
      prev.includes(size)
        ? prev.filter(s => s !== size) 
        : [...prev, size]
    );
  };

  const generateVariantCombinations = () => {
    const properties = [];
    const propertyNames = [];
    
    if (useColor && selectedColors.length > 0) {
      properties.push(selectedColors);
      propertyNames.push("Color");
    }
    
    if (useSize && selectedSizes.length > 0) {
      properties.push(selectedSizes);
      propertyNames.push("Talle");
    }
    
    if (useType && typeValues.trim()) {
      const values = typeValues.split('\n').map(v => v.trim()).filter(Boolean);
      if (values.length > 0) {
        properties.push(values);
        propertyNames.push(typeName || "Tipo");
      }
    }
    
    if (properties.length === 0) {
      setVariantCombinations([]);
      return;
    }
    
    // Generar todas las combinaciones
    const combinations = [];
    const generateCombos = (current, remaining) => {
      if (remaining.length === 0) {
        combinations.push([...current]);
        return;
      }
      
      const [firstProperty, ...restProperties] = remaining;
      for (const value of firstProperty) {
        generateCombos([...current, value], restProperties);
      }
    };
    
    generateCombos([], properties);
    
    const variantData = combinations.map((combo, index) => ({
      id: index,
      properties: propertyNames.map((name, i) => ({
        name,
        value: combo[i] || ''
      })),
      price: productPrice || '0',
      stock: '10'
    }));
    
    setVariantCombinations(variantData);
  };

  const updateVariantPrice = (variantId, price) => {
    setVariantCombinations(prev => 
      prev.map(v => v.id === variantId ? { ...v, price } : v)
    );
  };

  const updateVariantStock = (variantId, stock) => {
    setVariantCombinations(prev => 
      prev.map(v => v.id === variantId ? { ...v, stock } : v)
    );
  };

  // Función de guardado
  const saveCurrentProduct = () => {
    if (!outputCsvPath || !imageQueue.length) return;
    
    const filename = imageQueue[currentImageIndex];
    const name = productName.trim();
    const price = productPrice.trim();
    const stock = productStock.trim() || '10';
    
    if (!name) return;
    
    // Generar URL ID
    const generateUrlId = (name) => {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
      return name.toLowerCase()
        .replace(/[áéíóúñü]/g, match => ({
          'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n', 'ü': 'u'
        })[match])
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') + '-' + timestamp;
    };
    
    const urlId = generateUrlId(name);
    const categoriesStr = selectedCategories.length > 0 
      ? selectedCategories.join(', ') 
      : originalCategories;
    
    // Crear datos para CSV
    const baseData = {
      urlId,
      name,
      categories: categoriesStr,
      price: price,
      stock: stock
    };
    
    // En una implementación completa, aquí escribiríamos al CSV
    console.log('Saving product:', baseData);
    console.log('Variants:', variantCombinations);
    
    if (window.electronAPI) {
      window.electronAPI.saveProduct(outputCsvPath, baseData, variantCombinations);
    }
  };

  // Efectos
  useEffect(() => {
    if (currentImage) {
      displayImage(currentImage);
    }
  }, [zoomFactor, currentImage]);

  // Efecto para manejar el redimensionado del canvas
  useEffect(() => {
    const handleResize = () => {
      if (currentImage) {
        setTimeout(() => displayImage(currentImage), 100);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentImage]);

  // Efecto para cargar la primera imagen cuando se configuren CSV y directorio
  useEffect(() => {
    if (csvData.length > 0 && workingDirectory && imageQueue.length > 0 && currentImageIndex === 0) {
      loadCurrentImage(imageQueue[0], csvData);
    }
  }, [csvData, workingDirectory]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={selectCsvFile}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded"
            >
              <FileText size={16} />
              Seleccionar resultado.csv
            </button>
            <button
              onClick={selectWorkingDirectory}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded"
            >
              <FolderOpen size={16} />
              Seleccionar Carpeta
            </button>
            <span className="text-gray-300">
              {csvPath ? `CSV: ${csvPath.split('/').pop()}` : 'Sin archivo seleccionado'}
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right text-sm text-gray-300">
              <div>{currentImageIndex + 1}/{imageQueue.length} imágenes</div>
              <div>{imageQueue[currentImageIndex] || ''}</div>
              <div>CSV: {outputCsvPath ? 'salida.csv' : 'No creado'}</div>
            </div>
            <button
              onClick={skipImage}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 px-4 py-2 rounded"
            >
              <SkipForward size={16} />
              Saltar
            </button>
            <button
              onClick={nextImage}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded"
            >
              <ChevronRight size={16} />
              Siguiente
            </button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Panel izquierdo - Imagen */}
        <div className="w-[500px] bg-gray-800 border-r border-gray-700 flex flex-col">
          <div className="flex-1 p-4">
            <canvas
              ref={canvasRef}
              className="w-full h-full bg-gray-900 cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={drawBrush}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onWheel={(e) => {
                e.preventDefault();
                handleZoom(e.deltaY > 0 ? -1 : 1);
              }}
            />
          </div>
          
          {/* Controles de imagen */}
          <div className="p-4 border-t border-gray-700">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleZoom(1)}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
              >
                <ZoomIn size={16} />
              </button>
              <button
                onClick={() => handleZoom(-1)}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
              >
                <ZoomOut size={16} />
              </button>
              <button
                onClick={resetImage}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
              >
                <RotateCcw size={16} />
              </button>
              <div className="flex items-center gap-2 ml-4">
                <span className="text-sm">Pincel:</span>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-20"
                />
                <span className="text-sm w-8">{brushSize}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Panel derecho - Formulario */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Nombre del producto */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Nombre del Producto:</label>
            <textarea
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full h-20 bg-gray-800 border border-gray-600 rounded px-3 py-2"
              rows={3}
            />
          </div>

          {/* Categorías */}
          <div className="mb-6">
            <div className="border border-gray-600 rounded">
              <div className="p-3 bg-gray-800 border-b border-gray-600">
                <h3 className="font-medium">Categorías</h3>
              </div>
              
              {/* Vista colapsada */}
              <div
                className="p-3 bg-gray-700 cursor-pointer hover:bg-gray-600"
                onMouseEnter={() => setCategoriesExpanded(true)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">
                    {selectedCategories.length > 0 
                      ? selectedCategories.length <= 3 
                        ? selectedCategories.join(', ')
                        : `${selectedCategories.slice(0, 3).join(', ')} y ${selectedCategories.length - 3} más...`
                      : 'Ninguna categoría seleccionada'
                    }
                  </span>
                  <span className="text-gray-400">▼</span>
                </div>
              </div>

              {/* Vista expandida */}
              {categoriesExpanded && (
                <div
                  className="p-3 bg-gray-700"
                  onMouseLeave={() => setCategoriesExpanded(false)}
                >
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={selectAllCategories}
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                    >
                      Seleccionar Todo
                    </button>
                    <button
                      onClick={clearAllCategories}
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                    >
                      Limpiar Todo
                    </button>
                    <button
                      onClick={() => setShowCategorySearch(!showCategorySearch)}
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm flex items-center gap-1"
                    >
                      <Search size={14} />
                      Buscar
                    </button>
                  </div>

                  {showCategorySearch && (
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="text"
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        placeholder="Buscar categorías..."
                        className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
                      />
                      <button
                        onClick={() => {
                          setShowCategorySearch(false);
                          setCategorySearch('');
                        }}
                        className="p-1 bg-gray-600 hover:bg-gray-500 rounded"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  <div className="max-h-48 overflow-y-auto">
                    {filteredCategories.map(category => (
                      <label key={category} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-600 px-2 rounded">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(category)}
                          onChange={() => toggleCategory(category)}
                          className="rounded"
                        />
                        <span className="text-sm">{category}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Precio y Stock */}
          <div className="mb-6 flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Precio:</label>
              <input
                type="text"
                value={productPrice}
                onChange={(e) => setProductPrice(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Stock:</label>
              <input
                type="text"
                value={productStock}
                onChange={(e) => setProductStock(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2"
              />
            </div>
          </div>

          {/* Variantes */}
          <div className="mb-6">
            <div className="border border-gray-600 rounded">
              <div className="p-3 bg-gray-800 border-b border-gray-600">
                <h3 className="font-medium">Variantes</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Selecciona las propiedades que tendrá el producto. Se generarán todas las combinaciones.
                </p>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {/* Color */}
                  <div className="border border-gray-600 rounded p-3">
                    <label className="flex items-center gap-2 mb-3">
                      <input
                        type="checkbox"
                        checked={useColor}
                        onChange={(e) => setUseColor(e.target.checked)}
                      />
                      <span className="font-medium">Color</span>
                    </label>
                    
                    {useColor && (
                      <div>
                        <div className="max-h-32 overflow-y-auto mb-2 bg-gray-800 rounded p-2">
                          {predefinedColors.map(color => (
                            <label key={color} className="flex items-center gap-2 py-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedColors.includes(color)}
                                onChange={() => toggleColor(color)}
                                className="rounded"
                              />
                              <span className="text-sm">{color}</span>
                            </label>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setSelectedColors([...predefinedColors])}
                            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                          >
                            Todos
                          </button>
                          <button
                            onClick={() => setSelectedColors([])}
                            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                          >
                            Ninguno
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Talle */}
                  <div className="border border-gray-600 rounded p-3">
                    <label className="flex items-center gap-2 mb-3">
                      <input
                        type="checkbox"
                        checked={useSize}
                        onChange={(e) => setUseSize(e.target.checked)}
                      />
                      <span className="font-medium">Talle</span>
                    </label>
                    
                    {useSize && (
                      <div>
                        <div className="grid grid-cols-2 gap-1 mb-2">
                          {predefinedSizes.map(size => (
                            <label key={size} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedSizes.includes(size)}
                                onChange={() => toggleSize(size)}
                                className="rounded"
                              />
                              <span className="text-sm">{size}</span>
                            </label>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setSelectedSizes([...predefinedSizes])}
                            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                          >
                            Todos
                          </button>
                          <button
                            onClick={() => setSelectedSizes([])}
                            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                          >
                            Ninguno
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tipo personalizado */}
                  <div className="border border-gray-600 rounded p-3">
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="checkbox"
                        checked={useType}
                        onChange={(e) => setUseType(e.target.checked)}
                      />
                      <input
                        type="text"
                        value={typeName}
                        onChange={(e) => setTypeName(e.target.value)}
                        className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
                      />
                    </div>
                    
                    {useType && (
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Valores:</label>
                        <textarea
                          value={typeValues}
                          onChange={(e) => setTypeValues(e.target.value)}
                          className="w-full h-16 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">(Un valor por línea)</p>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={generateVariantCombinations}
                  className="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded mb-4"
                >
                  Generar Combinaciones
                </button>

                {/* Lista de combinaciones */}
                {variantCombinations.length > 0 && (
                  <div className="border border-gray-600 rounded">
                    <div className="p-3 bg-gray-800 border-b border-gray-600">
                      <h4 className="font-medium">
                        Combinaciones generadas ({variantCombinations.length})
                      </h4>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {variantCombinations.map((variant, index) => (
                        <div key={variant.id} className="p-3 border-b border-gray-700 last:border-b-0">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <span className="text-sm font-medium">{index + 1}. </span>
                              {variant.properties.map((prop, i) => (
                                <span key={i} className="text-sm">
                                  {prop.value && `${prop.name}: ${prop.value}`}
                                  {prop.value && i < variant.properties.length - 1 && variant.properties[i + 1].value && ' + '}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <span className="text-sm">$</span>
                              <input
                                type="text"
                                value={variant.price}
                                onChange={(e) => updateVariantPrice(variant.id, e.target.value)}
                                className="w-20 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
                              />
                              <span className="text-sm ml-2">Stock:</span>
                              <input
                                type="text"
                                value={variant.stock}
                                onChange={(e) => updateVariantStock(variant.id, e.target.value)}
                                className="w-16 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default TiendaNubeProductManager;