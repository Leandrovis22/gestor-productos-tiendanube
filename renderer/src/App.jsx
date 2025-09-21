import { useState, useRef, useEffect } from 'react';
import CombineProducts from './CombineProducts';
import { ChevronRight, FolderOpen, FileText, SkipForward, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { generateUrlId, displayImage as displayImageHelper } from './helpers';
import InpaintingTool from './InpaintingTool';

const ProductThumbnailImage = ({ path, alt, className }) => {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let isMounted = true;
    const loadImage = async () => {
      if (window.electronAPI && path) {
        try {
          const imageData = await window.electronAPI.loadImage(path);
          if (isMounted) {
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

const TiendaNubeProductManager = () => {
  const [csvData, setCsvData] = useState([]);
  const [csvPath, setCsvPath] = useState('');
  const [workingDirectory, setWorkingDirectory] = useState('');
  const [imageQueue, setImageQueue] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentImage, setCurrentImage] = useState(null);
  const [outputCsvPath, setOutputCsvPath] = useState('');
  const [productImagesMap, setProductImagesMap] = useState({});

  const [currentMainProductImage, setCurrentMainProductImage] = useState('');
  const [currentProductAllImages, setCurrentProductAllImages] = useState([]);
  const [currentDisplayedImage, setCurrentDisplayedImage] = useState('');
  const [currentImagePath, setCurrentImagePath] = useState('');

  const [zoomFactor, setZoomFactor] = useState(1.0);
  const [displayOffset, setDisplayOffset] = useState({ x: 0, y: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productStock, setProductStock] = useState('10');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [originalCategories, setOriginalCategories] = useState('');
  const [savedImages, setSavedImages] = useState(new Set());

  const [useColor, setUseColor] = useState(false);
  const [useSize, setUseSize] = useState(false);
  const [useType, setUseType] = useState(false);
  const [selectedColors, setSelectedColors] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [typeName, setTypeName] = useState('Tipo');
  const [typeValues, setTypeValues] = useState('Modelo A\nModelo B\nModelo C');
  const [variantCombinations, setVariantCombinations] = useState([]);

  const [activeTab, setActiveTab] = useState('general');
  const [allProductsProcessed, setAllProductsProcessed] = useState(false);

  const imageRef = useRef(null);
  const canvasRef = useRef(null);

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

  const updateThumbnails = (mainImageFilename) => {
    if (!mainImageFilename) return;

    const allImagesForProduct = [mainImageFilename];

    if (productImagesMap[mainImageFilename]) {
      allImagesForProduct.push(...productImagesMap[mainImageFilename]);
    }

    let actualMainImage = mainImageFilename;
    for (const [main, secondaries] of Object.entries(productImagesMap)) {
      if (secondaries.includes(mainImageFilename)) {
        actualMainImage = main;
        allImagesForProduct.splice(0, 1, main);
        allImagesForProduct.push(...secondaries.filter(img => img !== mainImageFilename));
        break;
      }
    }

    setCurrentMainProductImage(actualMainImage);
    setCurrentProductAllImages([...new Set(allImagesForProduct)]);
  };

  const switchToProductImage = async (targetImageName) => {
    if (!workingDirectory || !targetImageName) return;

    try {
      const imagePath = `${workingDirectory}/${targetImageName}`;
      await loadImageOnly(imagePath, targetImageName);
    } catch (error) {
      console.error('Error switching to product image:', error);
    }
  };

  const loadImageOnly = async (imagePath, filename) => {
    if (!window.electronAPI) return;

    try {
      const exists = await window.electronAPI.fileExists(imagePath);
      if (!exists) {
        console.error('Image file does not exist:', imagePath);
        return;
      }

      const imageData = await window.electronAPI.loadImage(imagePath);

      const img = new Image();
      img.onload = () => {
        setCurrentImage(img);
        setCurrentDisplayedImage(filename);
        setCurrentImagePath(imagePath);
        setZoomFactor(1.0);
        setTimeout(() => displayImage(img), 100);
      };
      img.onerror = (error) => {
        console.error('Error loading image:', error);
      };
      img.src = imageData;
    } catch (error) {
      console.error('Error loading image only:', error);
    }
  };

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
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (file) {
            setCsvPath(file.name);
          }
        };
        input.click();
      }
    } catch (error) {
      console.error('Error selecting CSV file:', error);
    }
  };

  const loadProductImagesMap = async () => {
    if (!workingDirectory || !window.electronAPI) return;

    const mapPath = `${workingDirectory}/imagenes_producto.csv`;
    try {
      const exists = await window.electronAPI.fileExists(mapPath);
      if (exists) {
        const data = await window.electronAPI.readCsv(mapPath);
        const mapping = {};

        data.forEach(row => {
          if (row.imagen_principal && row.imagen_secundaria) {
            if (!mapping[row.imagen_principal]) {
              mapping[row.imagen_principal] = [];
            }
            mapping[row.imagen_principal].push(row.imagen_secundaria);
          }
        });

        setProductImagesMap(mapping);
      }
    } catch (error) {
      console.error('Error cargando mapeo de imágenes:', error);
    }
  };

  const selectWorkingDirectory = async () => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.selectDirectory();
        if (result.directoryPath && !result.canceled) {
          setWorkingDirectory(result.directoryPath);
          setAllProductsProcessed(false);
          await createOutputCsv(result.directoryPath);
        }
      } else {
        setWorkingDirectory('/simulado/directorio');
        createOutputCsv('/simulado/directorio');
      }
    } catch (error) {
      console.error('Error selecting directory:', error);
    }
  };

  useEffect(() => {
    const setupDirectory = async () => {
      if (workingDirectory && window.electronAPI) {
        await window.electronAPI.createDirectory(`${workingDirectory}/saltadas`);
        await window.electronAPI.createDirectory(`${workingDirectory}/procesadas`);

        await loadProductImagesMap();

        if (csvData.length > 0) {
          loadImagesFromData(csvData);
        }
      }
    };
    setupDirectory();
  }, [workingDirectory, csvData]);

  const loadCsvData = async (filePath) => {
    if (window.electronAPI) {
      try {
        const data = await window.electronAPI.readCsv(filePath);
        setCsvData(data);
        if (workingDirectory) {
          loadImagesFromData(data);
        }
      } catch (error) {
        console.error('Error loading CSV:', error);
        alert(`Error al cargar el archivo CSV: ${error.message}`);
      }
    }
  };

  const loadImagesFromData = async (data) => {
    if (data && data.length > 0 && workingDirectory && window.electronAPI) {
      const processedImages = new Set(await window.electronAPI.listFiles(`${workingDirectory}/procesadas`, ['.jpg', '.jpeg', '.png', '.webp']));
      const saltadasImages = new Set(await window.electronAPI.listFiles(`${workingDirectory}/saltadas`, ['.jpg', '.jpeg', '.png', '.webp']));

      const imageFiles = [];
      const seenMainImages = new Set();

      for (const row of data) {
        if (row.archivo) {
          const mainImage = Object.keys(productImagesMap).find(key =>
            productImagesMap[key].includes(row.archivo)
          ) || row.archivo;

          if (!seenMainImages.has(mainImage)) {
            const imagePath = `${workingDirectory}/${mainImage}`;
            const exists = await window.electronAPI.fileExists(imagePath);
            if (exists && !processedImages.has(mainImage) && !saltadasImages.has(mainImage)) {
              imageFiles.push(mainImage);
              seenMainImages.add(mainImage);
            }
          }
        }
      }

      setImageQueue(imageFiles);
      setCurrentImageIndex(0);
      if (imageFiles.length > 0) {
        await loadCurrentProduct(imageFiles[0], data, true);
      }
    }
  };

  const createOutputCsv = async (directory) => {
    const outputPath = `${directory}/salida.csv`;
    setOutputCsvPath(outputPath);

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

    const combinationOutputPath = `${directory}/imagenes_producto.csv`;
    const combinationHeaders = ['imagen_principal', 'imagen_secundaria'];
    if (window.electronAPI) {
      await window.electronAPI.createCsv(combinationOutputPath, combinationHeaders);
    }

    if (window.electronAPI) {
      await window.electronAPI.createCsv(outputPath, headers);
    }
  };

  const loadCurrentProduct = async (filename, data = csvData, isNewProduct = false) => {
    if (!filename || !workingDirectory) {
      console.error('Missing filename or working directory');
      return;
    }

    try {
      updateThumbnails(filename);

      const imagePath = `${workingDirectory}/${filename}`;
      await loadImageOnly(imagePath, filename);

      if (isNewProduct) {
        loadProductData(filename, data);
      }

    } catch (error) {
      console.error('Error loading current product:', error);
    }
  };

  const loadProductData = (filename, data = csvData) => {
    const row = data.find(r => r.archivo === filename);

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

    setSelectedColors([]);
    setSelectedSizes([]);
    setTypeValues('Modelo A\nModelo B\nModelo C');
    setVariantCombinations([]);
  };

  const ProductThumbnails = () => {
    if (activeTab !== 'general' || currentProductAllImages.length <= 1) {
      return null;
    }

    return (
      <div className="p-2 border-t border-gray-700">
        <h4 className="text-xs text-gray-400 mb-2">
          Imágenes del producto ({currentProductAllImages.length}):
        </h4>
        <div className="flex gap-2 overflow-x-auto">
          {currentProductAllImages.map((imgName, index) => {
            const isCurrentlyDisplayed = currentDisplayedImage === imgName;
            const isMainProduct = imgName === currentMainProductImage;

            return (
              <div
                key={imgName}
                className={`relative cursor-pointer border-2 rounded transition-all flex-shrink-0 ${isCurrentlyDisplayed
                  ? 'border-blue-500 shadow-lg bg-blue-900/20'
                  : 'border-transparent hover:border-gray-500'
                  }`}
                onClick={() => switchToProductImage(imgName)}
                title={`${imgName} ${isCurrentlyDisplayed ? '(mostrando)' : ''}`}
              >
                <ProductThumbnailImage
                  path={`${workingDirectory}/${imgName}`}
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
  };

  const nextProduct = async () => {
    if (!imageQueue.length) return;

    await saveCurrentProduct();

    if (window.electronAPI && workingDirectory) {
      for (const filename of currentProductAllImages) {
        const sourcePath = `${workingDirectory}/${filename}`;
        const destPath = `${workingDirectory}/procesadas/${filename}`;

        try {
          const exists = await window.electronAPI.fileExists(sourcePath);
          if (exists) {
            const result = await window.electronAPI.moveFile(sourcePath, destPath);
            if (result.success) {
              console.log(`Imagen ${filename} movida a procesadas.`);
            } else {
              console.error(`Error moviendo archivo ${filename}:`, result.error);
            }
          }
        } catch (error) {
          console.error(`Error processing ${filename}:`, error);
        }
      }
    }

    const newQueue = imageQueue.filter(img => !currentProductAllImages.includes(img));
    setImageQueue(newQueue);

    if (newQueue.length === 0) {
      setAllProductsProcessed(true);
      return;
    }

    const nextIndex = Math.min(currentImageIndex, newQueue.length - 1);
    setCurrentImageIndex(nextIndex);
    await loadCurrentProduct(newQueue[nextIndex], csvData, true);
  };

  const skipProduct = async () => {
    if (currentImageIndex >= imageQueue.length || !workingDirectory) return;

    const alreadySaved = currentProductAllImages.some(img => savedImages.has(img));
    if (alreadySaved) {
      alert('Este producto ya ha sido guardado y no puede ser saltado.');
      return;
    }

    try {
      for (const filename of currentProductAllImages) {
        const sourcePath = `${workingDirectory}/${filename}`;
        const destPath = `${workingDirectory}/saltadas/${filename}`;

        const exists = await window.electronAPI.fileExists(sourcePath);
        if (exists) {
          const result = await window.electronAPI.moveFile(sourcePath, destPath);
          if (!result.success) {
            console.error(`Error moving file ${filename}:`, result.error);
          }
        }
      }

      const updatedCsvData = csvData.filter(row => !currentProductAllImages.includes(row.archivo));
      setCsvData(updatedCsvData);

      const newQueue = imageQueue.filter(img => !currentProductAllImages.includes(img));
      setImageQueue(newQueue);

      if (newQueue.length > 0) {
        const nextIndex = Math.min(currentImageIndex, newQueue.length - 1);
        setCurrentImageIndex(nextIndex);
        await loadCurrentProduct(newQueue[nextIndex], updatedCsvData, true);
      } else {
        setAllProductsProcessed(true);
      }
    } catch (error) {
      console.error('Error skipping product:', error);
      alert(`Error al saltar el producto: ${error.message}`);
    }
  };

  const handleZoom = (delta) => {
    const factor = delta > 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.1, Math.min(5.0, zoomFactor * factor));
    setZoomFactor(newZoom);
  };

  const toggleCategory = (category) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

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

  const saveCurrentProduct = async () => {
    if (!outputCsvPath || !imageQueue.length || !currentMainProductImage) return;

    if (savedImages.has(currentMainProductImage)) {
      console.log(`Producto ${currentMainProductImage} ya fue guardado.`);
      return;
    }

    const name = productName.trim();
    const price = productPrice.trim();
    const stock = productStock.trim() || '10';

    if (!name) return;

    const urlId = generateUrlId(name);
    const categoriesStr = selectedCategories.length > 0
      ? selectedCategories.join(', ')
      : originalCategories;

    const baseData = {
      urlId,
      name,
      categories: categoriesStr,
      price: price,
      stock: stock,
      images: currentProductAllImages
    };

    if (window.electronAPI) {
      await window.electronAPI.saveProduct(outputCsvPath, baseData, variantCombinations);

      const imagesStr = currentProductAllImages.join(',');
      await window.electronAPI.saveImageUrlMapping(outputCsvPath, urlId, imagesStr);
    }

    setSavedImages(prev => {
      const newSet = new Set(prev);
      currentProductAllImages.forEach(img => newSet.add(img));
      return newSet;
    });
  };


// Fixed displayImage function - eliminates black borders and maintains proper scaling
const displayImage = (img) => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;

    const { width, height, x, y } = displayImageHelper(img, canvas, zoomFactor);
    setDisplaySize({ width, height }); // Needed for coordinate mapping
    setDisplayOffset({ x, y }); // Needed for coordinate mapping
};



// Fixed coordinate mapping function
const getImageCoordinates = (clientX, clientY) => {
  const canvas = canvasRef.current;
  if (!canvas || !currentImage) return null;

  const rect = canvas.getBoundingClientRect();
  
  // Get mouse position relative to canvas
  const mouseX = clientX - rect.left;
  const mouseY = clientY - rect.top;

  // Check if mouse is within the actual image bounds
  if (mouseX < displayOffset.x || mouseX > displayOffset.x + displaySize.width ||
      mouseY < displayOffset.y || mouseY > displayOffset.y + displaySize.height) {
    return null; // Outside image bounds
  }

  // Convert to image coordinates
  const scale = Math.min(rect.width / currentImage.width, rect.height / currentImage.height) * zoomFactor;
  const imageX = (mouseX - displayOffset.x) / scale;
  const imageY = (mouseY - displayOffset.y) / scale;

  // Clamp to image bounds
  const clampedX = Math.max(0, Math.min(currentImage.width - 1, imageX));
  const clampedY = Math.max(0, Math.min(currentImage.height - 1, imageY));

  return {
    imageX: clampedX,
    imageY: clampedY,
    canvasX: mouseX,
    canvasY: mouseY
  };

};
  const restartApp = () => {
    setCsvData([]);
    setCsvPath('');
    setWorkingDirectory('');
    setImageQueue([]);
    setCurrentImageIndex(0);
    setCurrentImage(null);
    setOutputCsvPath('');
    setZoomFactor(1.0);
    setProductName('');
    setProductPrice('');
    setProductStock('10');
    setSelectedCategories([]);
    setOriginalCategories('');
    setSavedImages(new Set());
    setUseColor(false);
    setUseSize(false);
    setUseType(false);
    setSelectedColors([]);
    setSelectedSizes([]);
    setTypeName('Tipo');
    setTypeValues('Modelo A\nModelo B\nModelo C');
    setVariantCombinations([]);
    setActiveTab('general');
    setAllProductsProcessed(false);
    setProductImagesMap({});
    setCurrentMainProductImage('');
    setCurrentProductAllImages([]);
    setCurrentDisplayedImage('');
    setCurrentImagePath('');
  };

  useEffect(() => {
    if (currentImage) {
      displayImage(currentImage);
    }
  }, [zoomFactor, currentImage]);

  useEffect(() => {
    const handleCombinationSave = async () => {
      await loadProductImagesMap();
      if (csvData.length > 0) {
        await loadImagesFromData(csvData);
      }
    };
    handleCombinationSave();
  }, [workingDirectory]);

  useEffect(() => {
    const handleResize = () => {
      if (currentImage) {
        setTimeout(() => displayImage(currentImage), 100);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentImage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e) => {
      e.preventDefault();
      handleZoom(e.deltaY > 0 ? -1 : 1);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [handleZoom]);

  useEffect(() => {
    if (csvData.length > 0 && workingDirectory && imageQueue.length > 0) {
      if (!currentImage || currentImageIndex === 0) {
        loadCurrentProduct(imageQueue[0], csvData, true);
      }
    }
  }, [csvData, workingDirectory, imageQueue]);

  const handleCombinationSaved = () => {
    loadProductImagesMap().then(() => {
      loadImagesFromData(csvData);
    });
  };

  if (activeTab === 'combinar') {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-gray-900 text-white">
        <button onClick={() => setActiveTab('general')} className="absolute top-4 right-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded z-10">
          Volver al Editor
        </button>
        <CombineProducts workingDirectory={workingDirectory} onCombinationSaved={handleCombinationSaved} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-900 text-white">
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
              <div>{currentImageIndex + 1}/{imageQueue.length} productos</div>
              <div>{currentMainProductImage || ''}</div>
              <div>CSV: {outputCsvPath ? 'salida.csv' : 'No creado'}</div>
            </div>
            <button
              onClick={skipProduct}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 px-4 py-2 rounded"
              disabled={!currentMainProductImage}
            >
              <SkipForward size={16} />
              Saltar Producto
            </button>
            <button
              onClick={nextProduct}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded"
              disabled={imageQueue.length === 0 || !currentMainProductImage}
            >
              <ChevronRight size={16} />
              Siguiente Producto
            </button>
          </div>
        </div>
      </div>

      {allProductsProcessed ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <h2 className="text-2xl font-bold mb-4">¡Has procesado todos los productos!</h2>
          <p className="text-gray-400 mb-8">El archivo `salida.csv` ha sido guardado en tu carpeta de trabajo.</p>
          <div className="flex gap-4">
            <button
              onClick={restartApp}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded"
            >
              Reiniciar
            </button>
            <button
              onClick={() => window.close()}
              className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded"
            >
              Cerrar Aplicación
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[500px] bg-gray-800 border-r border-gray-700 flex flex-col" ref={imageRef}>
            <div className="flex-1 p-4 relative">
              <canvas
                ref={canvasRef}
                className="w-full h-full cursor-default"
              />
            </div>

            <div className="p-4 border-t border-gray-700 flex items-center gap-2">
              <button onClick={() => handleZoom(1)} className="p-2 bg-gray-700 hover:bg-gray-600 rounded"><ZoomIn size={16} /></button>
              <button onClick={() => handleZoom(-1)} className="p-2 bg-gray-700 hover:bg-gray-600 rounded"><ZoomOut size={16} /></button>
              <button onClick={() => setZoomFactor(1)} className="p-2 bg-gray-700 hover:bg-gray-600 rounded"><RotateCcw size={16} /></button>
            </div>

            <InpaintingTool
              mainCanvasRef={canvasRef}
              currentImage={currentImage}
              currentImagePath={currentImagePath}
              onImageSaved={(img) => { setCurrentImage(img); setTimeout(() => displayImage(img), 50); }}
              zoomFactor={zoomFactor}
              displayOffset={displayOffset}
              displaySize={displaySize}
            />

            <ProductThumbnails />
          </div>

          <div className="flex-1 flex flex-col overflow-y-auto bg-gray-900">
            <div className="flex border-b border-gray-700">
              <button
                onClick={() => setActiveTab('general')}
                className={`px-4 py-2 text-sm font-medium ${activeTab === 'general' ? 'bg-gray-800 border-b-2 border-blue-500' : 'text-gray-400 hover:bg-gray-800'}`}
              >
                General
              </button>
              <button
                onClick={() => setActiveTab('variantes')}
                className={`px-4 py-2 text-sm font-medium ${activeTab === 'variantes' ? 'bg-gray-800 border-b-2 border-blue-500' : 'text-gray-400 hover:bg-gray-800'}`}
              >
                Variantes
              </button>
              <button
                onClick={() => setActiveTab('combinar')}
                className={`px-4 py-2 text-sm font-medium ${activeTab === 'combinar' ? 'bg-gray-800 border-b-2 border-blue-500' : 'text-gray-400 hover:bg-gray-800'}`}
              >
                Combinar
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {activeTab === 'general' && (
                <div>
                  <div className="mb-1">
                    <label className="block text-sm font-medium mb-2">Nombre del Producto:</label>
                    <textarea
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      className="w-full h-[3rem] bg-gray-800 border border-gray-600 rounded px-3 py-2"
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-4 mb-1">
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
                      <label className="block text-sm font-medium mb-2">Stock (si no hay variantes):</label>
                      <input
                        type="text"
                        value={productStock}
                        onChange={(e) => setProductStock(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-4">
                      <h3 className="text-lg font-medium mb-2">Categorías Activas</h3>
                      <div className="p-3 bg-gray-800 border border-gray-700 rounded min-h-[60px]">
                        {selectedCategories.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {selectedCategories.map(cat => (
                              <span key={cat} className="bg-blue-600 text-white text-xs font-medium px-2.5 py-1 rounded-full">
                                {cat}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400">Ninguna categoría seleccionada.</p>
                        )}
                      </div>
                    </div>

                    <h3 className="text-lg font-medium mb-2">Todas las Categorías</h3>
                    <div className="max-h-64 overflow-y-auto border border-gray-700 rounded p-2 bg-gray-800">
                      <div className="grid grid-cols-2 gap-2">
                        {categories.map(category => (
                          <button
                            key={category}
                            onClick={() => toggleCategory(category)}
                            className={`w-full text-left text-sm px-3 py-2 rounded ${selectedCategories.includes(category)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 hover:bg-gray-600'
                              }`}
                          >
                            {category}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'variantes' && (
                <div>
                  <div className="border border-gray-700 rounded">
                    <div className="p-3 bg-gray-800 border-b border-gray-600">
                      <h3 className="font-medium">Variantes</h3>
                      <p className="text-sm text-gray-400 mt-1">
                        Selecciona las propiedades que tendrá el producto. Se generarán todas las combinaciones.
                      </p>
                    </div>

                    <div className="p-4">
                      <div className="grid grid-cols-3 gap-4 mb-4">
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
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TiendaNubeProductManager;