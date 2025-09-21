// components/TiendaNubeProductManager.js
import React, { useState, useEffect } from 'react';
import { ChevronRight, SkipForward, FileText, FolderOpen } from 'lucide-react';

// Hooks personalizados
import { useProductManager } from '../hooks/useProductManager';
import { useProductFormManager } from '../hooks/useProductFormManager';

// Componentes
import { ImageManager, useImageManager } from './ImageManager';
import { ProductEditor } from './ProductEditor';
import CombineProducts from '../CombineProducts';

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
        <div className="text-sm">
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
      const nextFilename = await productManager.skipProduct(
        imageManager.resetImageState,
        productForm.resetForm
      );

      if (nextFilename) {
        await loadCurrentProduct(nextFilename, true);
      }
    } catch (error) {
      console.error('Error skipping product:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Manejo de guardado cuando se guardan combinaciones
  const handleCombinationSaved = async () => {
    await productManager.loadProductImagesMap();
    await productManager.loadCsvData(productManager.csvPath);
    await productManager.loadImagesFromData(productManager.csvData);
  };

  // Efectos para sincronizar datos
  useEffect(() => {
    if (productManager.csvData.length > 0 && productManager.workingDirectory && productManager.imageQueue.length > 0) {
      if (!imageManager.currentImage || productManager.currentImageIndex === 0) {
        loadCurrentProduct(productManager.imageQueue[0], true);
      }
    }
  }, [productManager.csvData, productManager.workingDirectory, productManager.imageQueue]);

  // Header con controles principales
  const Header = () => (
    <div className="bg-gray-800 p-4 border-b border-gray-700">
      <div className="flex items-center justify-between">
        <FileSelector productManager={productManager} />
        <div className="flex items-center gap-4">
          <div className="text-right text-sm text-gray-300">
            <div>{productManager.currentImageIndex + 1}/{productManager.imageQueue.length} productos</div>
            <div>{productManager.currentMainProductImage || ''}</div>
            <div>CSV: {productManager.outputCsvPath ? 'salida.csv' : 'No creado'}</div>
          </div>
          <button
            onClick={handleSkipProduct}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 px-4 py-2 rounded"
            disabled={!productManager.currentMainProductImage || isProcessing}
          >
            <SkipForward size={16} />
            Saltar Producto
          </button>
          <button
            onClick={handleNextProduct}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded"
            disabled={productManager.imageQueue.length === 0 || !productManager.currentMainProductImage || isProcessing}
          >
            <ChevronRight size={16} />
            {isProcessing ? 'Procesando...' : 'Siguiente Producto'}
          </button>
        </div>
      </div>
    </div>
  );

  // Renderizado principal
  if (activeTab === 'combinar') {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-gray-900 text-white">
        <button 
          onClick={() => setActiveTab('general')} 
          className="absolute top-4 right-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded z-10"
        >
          Volver al Editor
        </button>
        <CombineProducts 
          workingDirectory={productManager.workingDirectory} 
          onCombinationSaved={handleCombinationSaved} 
          csvData={productManager.csvData} 
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