/**
 * @file TiendaNubeProductManager.jsx
 * @description Este es el componente principal y orquestador de toda la aplicación de gestión de productos.
 * Integra y coordina varios componentes y hooks personalizados para proporcionar una interfaz completa
 * para procesar, editar y combinar productos de TiendaNube.
 *
 * `FileSelector`:
 * - Un componente que permite al usuario seleccionar el archivo `resultado.csv` y el directorio de trabajo.
 * - Es el punto de partida para cargar los datos de los productos.
 *
 * `EditorTabs`:
 * - Renderiza las pestañas de navegación principales: "General", "Variantes", "Combinar" y "Productos Completados".
 * - Permite al usuario cambiar entre las diferentes secciones de la aplicación.
 *
 * `ProcessedScreen`:
 * - Una pantalla que se muestra cuando todos los productos de la cola han sido procesados.
 * - Ofrece opciones para reiniciar la aplicación o cerrarla.
 *
 * `TiendaNubeProductManager` (Componente principal):
 * - **Orquestación de Hooks:** Utiliza tres hooks personalizados principales:
 *   - `useProductManager`: Gestiona la lógica de negocio de los productos (cargar CSV, guardar, saltar, siguiente producto, etc.).
 *   - `useProductFormManager`: Gestiona el estado y la lógica del formulario de edición del producto (nombre, precio, variantes, categorías).
 *   - `useImageManager`: Gestiona la visualización y edición de imágenes en el lienzo (zoom, paneo, inpainting).
 *
 * - **Gestión de Estado:** Mantiene el estado de la pestaña activa (`activeTab`) y el estado de procesamiento (`isProcessing`).
 *
 * - **Flujo de Trabajo Principal:**
 *   1. El usuario selecciona un archivo `resultado.csv`. El `useProductManager` carga los datos y la cola de imágenes.
 *   2. La primera imagen y sus datos se cargan en `ImageManager` y `ProductEditor` respectivamente.
 *   3. El usuario edita los detalles del producto en `ProductEditor` (pestañas "General" y "Variantes").
 *   4. El usuario puede usar `InpaintingTool` (dentro de `ImageManager`) para editar la imagen.
 *   5. Al hacer clic en "Guardar y Siguiente", el componente:
 *      - Guarda cualquier edición de imagen pendiente.
 *      - Guarda los datos del producto (incluidas las variantes) en `resultado.csv` y `salida.csv`.
 *      - Mueve la imagen procesada a la carpeta `procesadas`.
 *      - Carga el siguiente producto de la cola.
 *   6. El usuario también puede "Saltar" un producto, moviéndolo a la carpeta `saltadas`.
 *
 * - **Integración de Pestañas:**
 *   - **Pestaña "Combinar":** Renderiza el componente `CombineProducts`, que permite fusionar varios productos en uno solo.
 *     Maneja la actualización del estado de la aplicación cuando se guarda una combinación.
 *   - **Pestaña "Productos":** Renderiza el componente `ProductsTab`, que ofrece una vista de gestión de productos ya completados,
 *     permitiendo editarlos, ver eliminados, etc.
 *
 * - **Componente Contenedor:** Actúa como el contenedor principal que ensambla `Header`, `ImageManager`, y `ProductEditor`
 *   en el layout principal de la aplicación, pasando todas las props y funciones necesarias.
 */

// components/TiendaNubeProductManager.js
import React, { useState, useEffect } from 'react';
import { ChevronRight, SkipForward, FileText, FolderOpen, Package } from 'lucide-react';

// Hooks personalizados
import { useProductManager } from '../hooks/useProductManager';
import { useProductFormManager } from '../hooks/useProductFormManager';

// Componentes
import { ImageManager, useImageManager } from './ImageManager';
import { ProductEditor } from './ProductEditor';
import CombineProducts from '../CombineProducts';
import ProductsTab from './ProductsTab';

// Componentes movidos fuera para evitar re-renderizados innecesarios que quitan el foco de los inputs.

// FileSelector como componente interno
const FileSelector = ({ productManager }) => (
  <div className="flex items-center gap-4">
    <button
      onClick={productManager.selectCsvFile}
      className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded"
    >
      <FileText size={16} />
      Seleccionar resultado.csv
    </button>

    <button
      onClick={productManager.selectWorkingDirectory}
      className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded text-sm opacity-75"
      title="Cambiar carpeta manualmente (opcional)"
    >
      <FolderOpen size={16} />
      Cambiar Carpeta
    </button>

    <span className="text-gray-300">
      {productManager.csvPath ? (
        <div className="text-[0.7rem]">
          <div>CSV: {productManager.csvPath.split('/').pop()}</div>
          <div className="text-xs text-gray-400">
            Carpeta: {productManager.workingDirectory ? productManager.workingDirectory.split('/').pop() : 'No seleccionada'}
          </div>
        </div>
      ) : (
        'Sin archivo seleccionado'
      )}
    </span>
  </div>
);



// Tabs del editor
const EditorTabs = ({ activeTab, setActiveTab }) => (
  <div className="flex border-b border-gray-700">
    <button
      onClick={() => setActiveTab('general')}
      className={`px-4 py-2 text-sm font-medium ${
        activeTab === 'general' 
          ? 'bg-gray-800 border-b-2 border-blue-500' 
          : 'text-gray-400 hover:bg-gray-800'
      }`}
    >
      General
    </button>
    <button
      onClick={() => setActiveTab('variantes')}
      className={`px-4 py-2 text-sm font-medium ${
        activeTab === 'variantes' 
          ? 'bg-gray-800 border-b-2 border-blue-500' 
          : 'text-gray-400 hover:bg-gray-800'
      }`}
    >
      Variantes
    </button>
    <button
      onClick={() => setActiveTab('combinar')}
      className={`px-4 py-2 text-sm font-medium ${
        activeTab === 'combinar' 
          ? 'bg-gray-800 border-b-2 border-blue-500' 
          : 'text-gray-400 hover:bg-gray-800'
      }`}
    >
      Combinar
    </button>
    <button
      onClick={() => setActiveTab('productos')}
      className={`px-4 py-2 text-sm font-medium flex items-center gap-2 ${
        activeTab === 'productos' 
          ? 'bg-gray-800 border-b-2 border-blue-500' 
          : 'text-gray-400 hover:bg-gray-800'
      }`}
    >
      <Package size={16} />
      Productos Completados
    </button>
  </div>
);

// Pantalla de productos procesados
const ProcessedScreen = ({ onRestart }) => (
  <div className="flex-1 flex flex-col items-center justify-center text-center">
    <h2 className="text-2xl font-bold mb-4">¡Has procesado todos los productos!</h2>
    <p className="text-gray-400 mb-8">El archivo `salida.csv` ha sido guardado en tu carpeta de trabajo.</p>
    <div className="flex gap-4">
      <button
        onClick={onRestart}
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
);

const TiendaNubeProductManager = () => {
  const [activeTab, setActiveTab] = useState('general');

  // Hooks personalizados
  const productManager = useProductManager();
  const productForm = useProductFormManager();
  const imageManager = useImageManager();

  // Estados locales adicionales (si son necesarios)
  const [isProcessing, setIsProcessing] = useState(false);

  // Función para cargar producto actual
  const loadCurrentProduct = async (filename, isNewProduct = false) => {
    if (!filename) return;
    
    // Cargar imagen
    await imageManager.loadCurrentProduct(
      filename, 
      productManager.workingDirectory, 
      productManager.updateThumbnails, 
      isNewProduct
    );
    
    // Cargar datos del formulario si es un producto nuevo
    if (isNewProduct) {
      productForm.loadProductData(filename, productManager.csvData);
    }
  };

  // Manejo de selección de imagen
  const handleImageSelect = async (imageName) => {
    await imageManager.switchToProductImage(imageName, productManager.workingDirectory);
  };

  // Manejo de navegación: siguiente producto
  const handleNextProduct = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // Guardar tipo de variante si es nuevo o si se han agregado nuevos valores
      if (productForm.useType && productForm.typeName && productForm.typeValues) {
        const currentValues = productForm.typeValues.split('\n').map(v => v.trim()).filter(Boolean);
        const existingType = productForm.predefinedTypes.find(pt => pt.name.toLowerCase() === productForm.typeName.toLowerCase());
        
        let shouldSave = false;
        
        if (!existingType) {
          // Es un tipo completamente nuevo
          shouldSave = true;
        } else {
          // Verificar si hay nuevos valores en el tipo existente
          const existingValues = existingType.values || [];
          const hasNewValues = currentValues.some(value => !existingValues.includes(value));
          shouldSave = hasNewValues;
        }
        
        if (shouldSave) {
          const typeToSave = {
            name: productForm.typeName,
            values: currentValues
          };
          if (window.electronAPI) {
            const result = await window.electronAPI.savePredefinedType(typeToSave);
            if (result.success) productForm.loadConfig(result.config);
          }
        }
      }

      // Guardar la imagen editada ANTES de cualquier otra cosa
      await imageManager.saveCurrentImageIfEdited();

      // Guardar producto actual
      const productData = productForm.getProductData();
      await productManager.saveCurrentProduct(productData, productForm.variantCombinations);

      // Mover al siguiente producto
      const nextFilename = await productManager.nextProduct(
        imageManager.resetImageState,
        productForm.resetForm
      );

      if (nextFilename) {
        // NUEVA LÍNEA: Recargar el mapa de imágenes antes de cargar el producto
        await productManager.loadProductImagesMap();
        
        await loadCurrentProduct(nextFilename, true);
      }
    } catch (error) {
      console.error('Error moving to next product:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Manejo de saltar producto
  const handleSkipProduct = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // Guardar tipo de variante si es nuevo o si se han agregado nuevos valores
      if (productForm.useType && productForm.typeName && productForm.typeValues) {
        const currentValues = productForm.typeValues.split('\n').map(v => v.trim()).filter(Boolean);
        const existingType = productForm.predefinedTypes.find(pt => pt.name.toLowerCase() === productForm.typeName.toLowerCase());
        
        let shouldSave = false;
        
        if (!existingType) {
          // Es un tipo completamente nuevo
          shouldSave = true;
        } else {
          // Verificar si hay nuevos valores en el tipo existente
          const existingValues = existingType.values || [];
          const hasNewValues = currentValues.some(value => !existingValues.includes(value));
          shouldSave = hasNewValues;
        }
        
        if (shouldSave) {
          const typeToSave = {
            name: productForm.typeName,
            values: currentValues
          };
          if (window.electronAPI) {
            const result = await window.electronAPI.savePredefinedType(typeToSave);
            if (result.success) productForm.loadConfig(result.config);
          }
        }
      }

      const nextFilename = await productManager.skipProduct(
        imageManager.resetImageState,
        productForm.resetForm
      );

      if (nextFilename) {
        // NUEVA LÍNEA: Recargar el mapa de imágenes antes de cargar el producto
        await productManager.loadProductImagesMap();
        
        await loadCurrentProduct(nextFilename, true);
      }
    } catch (error) {
      console.error('Error skipping product:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Manejo de guardar nuevo color
  const handleSaveColor = async (colorName, hexColor) => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.saveColor(colorName, hexColor);
        if (result.success && result.config) {
          // Recargar la configuración para actualizar los colores disponibles
          productForm.loadConfig(result.config);
        }
        return result;
      }
      return { success: false, error: 'electronAPI no disponible' };
    } catch (error) {
      console.error('Error saving color:', error);
      return { success: false, error: error.message };
    }
  };

  // Manejo de guardado cuando se guardan combinaciones
  const handleCombinationSaved = async () => {
    // 1. Recargar el mapa de imágenes de productos
    await productManager.loadProductImagesMap();
    
    // 2. Recargar datos CSV
    await productManager.loadCsvData(productManager.csvPath);
    
    // 3. Recargar las imágenes desde los datos actualizados
    await productManager.loadImagesFromData(productManager.csvData);
    
    // 4. Sincronizar csvData con el estado del disco
    await productManager.syncCsvDataWithDisk();
    
    // 5. NUEVA LÍNEA: Forzar actualización de thumbnails para el producto actual
    if (productManager.currentMainProductImage) {
      productManager.updateThumbnails(productManager.currentMainProductImage);
    }
  };

  // Efectos para sincronizar datos
  useEffect(() => {
    if (productManager.csvData.length > 0 && productManager.workingDirectory && productManager.imageQueue.length > 0) {
      if (!imageManager.currentImage || productManager.currentImageIndex === 0) {
        loadCurrentProduct(productManager.imageQueue[0], true);
      }
    }
  }, [productManager.csvData, productManager.workingDirectory, productManager.imageQueue]);

  // Efecto para cargar la configuración en el formulario cuando cambia
  useEffect(() => {
    if (productManager.config) {
      productForm.loadConfig(productManager.config);
    }
  }, [productManager.config]);

  // Header con controles principales
  const Header = () => (
    <div className="bg-gray-800 p-[0.6rem] border-b border-gray-700">
      <div className="flex items-center justify-between">
        <FileSelector productManager={productManager} />
        <div className="flex items-center gap-4">
          <div className="text-right text-xs text-gray-300">
            <div>{productManager.currentImageIndex + 1}/{productManager.imageQueue.length} productos</div>
            <div>{productManager.currentMainProductImage || ''}</div>
          </div>
          <button
            onClick={handleSkipProduct}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 px-4 py-2 rounded"
            disabled={!productManager.currentMainProductImage || isProcessing}
          >
            <SkipForward size={16} />
            Saltar
          </button>
          <button
            onClick={handleNextProduct}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded"
            disabled={productManager.imageQueue.length === 0 || !productManager.currentMainProductImage || isProcessing}
          >
            <ChevronRight size={16} />
            {isProcessing ? 'Procesando...' : 'Guardar y Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );

  // Renderizado principal
  if (activeTab === 'productos') {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-gray-900 text-white">
        <ProductsTab setActiveTab={setActiveTab} />
      </div>
    );
  }

  if (activeTab === 'combinar') {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-gray-900 text-white">
        <div className="bg-gray-800 p-1 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Combinar Productos</h1>
            <button 
              onClick={() => setActiveTab('general')} 
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded"
            >
              Volver al Editor
            </button>
          </div>
        </div>
        <CombineProducts 
          workingDirectory={productManager.workingDirectory} 
          onCombinationSaved={handleCombinationSaved} 
          csvData={productManager.csvData}
          onSyncCsvData={productManager.syncCsvDataWithDisk}
        />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-900 text-white">
      <Header />

      {productManager.allProductsProcessed ? (
        <ProcessedScreen onRestart={productManager.restartApp} />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <ImageManager 
            key={productManager.currentMainProductImage}
            workingDirectory={productManager.workingDirectory}
            currentProductAllImages={productManager.currentProductAllImages}
            currentMainProductImage={productManager.currentMainProductImage}
            currentDisplayedImage={imageManager.currentDisplayedImage}
            activeTab={activeTab}
            onImageSelect={handleImageSelect}
            imageManager={imageManager}
          />

          <div className="flex-1 flex flex-col overflow-y-auto bg-gray-900">
            <EditorTabs activeTab={activeTab} setActiveTab={setActiveTab} />

            <ProductEditor
              // Datos básicos del producto
              productName={productForm.productName}
              setProductName={productForm.setProductName}
              productPrice={productForm.productPrice}
              setProductPrice={productForm.setProductPrice}
              productStock={productForm.productStock}
              setProductStock={productForm.setProductStock}
              selectedCategories={productForm.selectedCategories}
              categoryTree={productForm.categoryTree}
              categories={productForm.categories}
              onToggleCategory={productForm.toggleCategory}

              // Estados de variantes
              useColor={productForm.useColor}
              setUseColor={productForm.setUseColor}
              useSize={productForm.useSize}
              setUseSize={productForm.setUseSize}
              useType={productForm.useType}
              setUseType={productForm.setUseType}
              selectedColors={productForm.selectedColors}
              selectedSizes={productForm.selectedSizes}
              typeName={productForm.typeName}
              setTypeName={productForm.setTypeName}
              typeValues={productForm.typeValues}
              setTypeValues={productForm.setTypeValues}
              variantCombinations={productForm.variantCombinations}
              predefinedColors={productForm.predefinedColors}
              predefinedSizes={productForm.predefinedSizes}
              predefinedTypes={productForm.predefinedTypes}
              colorMap={productForm.colorMap}
              onSelectPredefinedType={productForm.onSelectPredefinedType}

              // Funciones de variantes
              onToggleColor={productForm.toggleColor}
              onToggleSize={productForm.toggleSize}
              onSelectAllColors={productForm.selectAllColors}
              onClearAllColors={productForm.clearAllColors}
              onSelectAllSizes={productForm.selectAllSizes}
              onClearAllSizes={productForm.clearAllSizes}
              onGenerateVariants={productForm.generateVariantCombinations}
              onUpdateVariantPrice={productForm.updateVariantPrice}
              onUpdateVariantStock={productForm.updateVariantStock}
              onSaveColor={handleSaveColor}

              // Control de pestañas
              activeTab={activeTab}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TiendaNubeProductManager;