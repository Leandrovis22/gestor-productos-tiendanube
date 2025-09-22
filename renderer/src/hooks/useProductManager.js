// hooks/useProductManager.js
import { useState, useEffect } from 'react';

export const useProductManager = () => {
  // Estados principales
  const [csvData, setCsvData] = useState([]);
  const [csvPath, setCsvPath] = useState('');
  const [workingDirectory, setWorkingDirectory] = useState('');
  const [outputCsvPath, setOutputCsvPath] = useState('');
  
  // Estados de imágenes y procesamiento
  const [imageQueue, setImageQueue] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [productImagesMap, setProductImagesMap] = useState({});
  const [currentMainProductImage, setCurrentMainProductImage] = useState('');
  const [currentProductAllImages, setCurrentProductAllImages] = useState([]);
  const [savedImages, setSavedImages] = useState(new Set());
  const [allProductsProcessed, setAllProductsProcessed] = useState(false);
  const [config, setConfig] = useState(null);

  // Selección de archivo CSV
  const selectCsvFile = async () => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.selectFile([
          { name: 'CSV Files', extensions: ['csv'] }
        ]);
        if (result.filePath && !result.canceled) {
          setCsvPath(result.filePath);

          // Automatically set working directory to the same folder as the CSV
          const csvDirectory = await window.electronAPI.getDirectoryFromPath(result.filePath);
          setWorkingDirectory(csvDirectory);
          // Load config from the new directory
          loadConfig(csvDirectory);

          setAllProductsProcessed(false);

          // Create output CSV in the same directory
          await createOutputCsv(csvDirectory);

          // Load CSV data
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

  // Selección de directorio de trabajo
  const selectWorkingDirectory = async () => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.selectDirectory();
        if (result.directoryPath && !result.canceled) {
          setWorkingDirectory(result.directoryPath);
          // Load config from the new directory
          loadConfig(result.directoryPath);
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

  // Carga de datos CSV
  const loadCsvData = async (filePath) => {
    if (window.electronAPI) {
      try {
        const data = await window.electronAPI.readCsv(filePath, { delimiter: ';' });
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

  // Carga de configuración desde config.json
  const loadConfig = async (directory) => {
    if (window.electronAPI && directory) {
      try {
        const configData = await window.electronAPI.readConfig(directory);
        setConfig(configData);
      } catch (error) {
        console.error('Error loading config.json:', error);
      }
    }
  };

  // Carga del mapeo de imágenes de productos
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

  // Carga de imágenes desde datos CSV
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
            const imagePath = await window.electronAPI.joinPaths(workingDirectory, mainImage);
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
    }
  };

  // Creación del CSV de salida
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

  // Actualización de miniaturas
  const updateThumbnails = (mainImageFilename) => {
    if (!mainImageFilename) return;

    const allImagesForProduct = [mainImageFilename];

    if (productImagesMap[mainImageFilename]) {
      allImagesForProduct.push(...productImagesMap[mainImageFilename]);
      console.log('✅ Encontradas imágenes secundarias para', mainImageFilename, ':', productImagesMap[mainImageFilename]);
    }

    let actualMainImage = mainImageFilename;
    for (const [main, secondaries] of Object.entries(productImagesMap)) {
      if (secondaries.includes(mainImageFilename)) {
        actualMainImage = main;
        allImagesForProduct.splice(0, 1, main);
        allImagesForProduct.push(...secondaries.filter(img => img !== mainImageFilename));
        console.log('🔄 Imagen es secundaria, usando principal:', actualMainImage);
        break;
      }
    }

    const uniqueImages = [...new Set(allImagesForProduct)];
    
    // Solo actualizar si realmente cambió algo
    setCurrentMainProductImage(prev => {
      if (prev !== actualMainImage) {
        console.log('� Producto cargado:', actualMainImage, `(${uniqueImages.length} imágenes)`);
        return actualMainImage;
      }
      return prev;
    });
    
    setCurrentProductAllImages(prev => {
      const prevStr = JSON.stringify(prev);
      const newStr = JSON.stringify(uniqueImages);
      if (prevStr !== newStr) {
        return uniqueImages;
      }
      return prev;
    });
  };

  // Guardar producto actual
  const saveCurrentProduct = async (productData, variantCombinations) => {
    if (!outputCsvPath || !imageQueue.length || !currentMainProductImage) return;

    if (savedImages.has(currentMainProductImage)) {
      return;
    }

    const { productName, productPrice, productStock, selectedCategories, originalCategories } = productData;
    
    const name = productName.trim();
    const price = productPrice.trim();
    const stock = productStock.trim() || '10';

    if (!name) return;

    const categoriesStr = selectedCategories.length > 0
      ? selectedCategories.join(', ')
      : originalCategories;

    const baseData = {
      name,
      categories: categoriesStr,
      price: price,
      stock: stock,
      images: currentProductAllImages
    };

    if (window.electronAPI) {
      // Guardamos el producto y recibimos la urlId generada en el backend
      const { urlId } = await window.electronAPI.saveProduct(outputCsvPath, baseData, variantCombinations);

      const imagesStr = currentProductAllImages.join(',');
      await window.electronAPI.saveImageUrlMapping(outputCsvPath, urlId, imagesStr);
    }

    // Actualizamos el set de imágenes guardadas
    setSavedImages(prev => new Set([...prev, ...currentProductAllImages]));
  };

  // Pasar al siguiente producto
  const nextProduct = async (onImageReset, onFormReset) => {
    if (!imageQueue.length) return;

    // Reset states
    if (onImageReset) onImageReset();
    if (onFormReset) onFormReset();

    if (window.electronAPI && workingDirectory) {
      for (const filename of currentProductAllImages) {
        const sourcePath = await window.electronAPI.joinPaths(workingDirectory, filename);
        const destPath = await window.electronAPI.joinPaths(workingDirectory, 'procesadas', filename);

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
    
    return newQueue[nextIndex]; // Return next product filename
  };

  // Saltar producto
  const skipProduct = async (onImageReset, onFormReset) => {
    if (currentImageIndex >= imageQueue.length || !workingDirectory) return;

    const alreadySaved = currentProductAllImages.some(img => savedImages.has(img));
    if (alreadySaved) {
      alert('Este producto ya ha sido guardado y no puede ser saltado.');
      return;
    }

    // Reset states
    if (onImageReset) onImageReset();
    if (onFormReset) onFormReset();

    try {
      for (const filename of currentProductAllImages) {
        const sourcePath = await window.electronAPI.joinPaths(workingDirectory, filename);
        const destPath = await window.electronAPI.joinPaths(workingDirectory, 'saltadas', filename);

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
        return newQueue[nextIndex]; // Return next product filename
      } else {
        setAllProductsProcessed(true);
        return null;
      }
    } catch (error) {
      console.error('Error skipping product:', error);
      alert(`Error al saltar el producto: ${error.message}`);
    }
  };

  // Reiniciar aplicación
  const restartApp = () => {
    setCsvData([]);
    setCsvPath('');
    setWorkingDirectory('');
    setImageQueue([]);
    setCurrentImageIndex(0);
    setOutputCsvPath('');
    setSavedImages(new Set());
    setAllProductsProcessed(false);
    setProductImagesMap({});
    setCurrentMainProductImage('');
    setCurrentProductAllImages([]);
  };

  // Configuración inicial del directorio
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

  return {
    // Estados
    csvData,
    setCsvData,
    csvPath,
    workingDirectory,
    outputCsvPath,
    imageQueue,
    currentImageIndex,
    productImagesMap,
    currentMainProductImage,
    currentProductAllImages,
    savedImages,
    allProductsProcessed,
    config,

    // Funciones
    selectCsvFile,
    selectWorkingDirectory,
    loadCsvData,
    loadProductImagesMap,
    loadImagesFromData,
    updateThumbnails,
    saveCurrentProduct,
    nextProduct,
    skipProduct,
    restartApp
  };
};