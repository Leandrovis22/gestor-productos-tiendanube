import React, { useState, useEffect, useCallback } from 'react';
import { 
  Package, 
  Plus, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  Search, 
  Image,
  Save,
  X,
  FolderOpen,
  FileText,
  AlertTriangle
} from 'lucide-react';

const ProductsTab = () => {
  // Estados principales
  const [workingDirectory, setWorkingDirectory] = useState(null);
  const [products, setProducts] = useState([]);
  const [deletedProducts, setDeletedProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('list'); // 'list', 'edit', 'deleted'
  const [currentProduct, setCurrentProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [config, setConfig] = useState(null);

  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 54;

  // Estados del formulario de edición
  const [editForm, setEditForm] = useState({
    name: '',
    categories: '',
    price: '',
    stock: '',
    variants: []
  });

  // Estados para manejo de imágenes
  const [productImages, setProductImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [imageDataCache, setImageDataCache] = useState(new Map());

  // Función para actualizar formulario con useCallback para evitar re-renders
  const updateEditForm = useCallback((field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Función para actualizar variante con useCallback
  const updateVariant = useCallback((index, field, value) => {
    setEditForm(prev => {
      const updatedVariants = [...prev.variants];
      updatedVariants[index][field] = value;
      return {
        ...prev,
        variants: updatedVariants
      };
    });
  }, []);

  // Cargar configuración al montar el componente
  useEffect(() => {
    loadConfig();
  }, []);

  // Función para seleccionar directorio de trabajo
  const selectWorkingDirectory = async () => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.selectDirectory();
        if (!result.canceled && result.directoryPath) {
          setWorkingDirectory(result.directoryPath);
          await loadProducts(result.directoryPath);
          await loadConfig();
        }
      }
    } catch (error) {
      console.error('Error selecting directory:', error);
    }
  };

  // Función para cargar configuración desde ubicación permanente
  const loadConfig = async () => {
    try {
      if (window.electronAPI) {
        const configData = await window.electronAPI.readConfig();
        setConfig(configData);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  // Función para cargar productos desde salida.csv y imagen-url.csv
  const loadProducts = async (directory) => {
    setLoading(true);
    try {
      if (window.electronAPI) {
        // Cargar productos desde salida.csv
        const salidaCsvPath = await window.electronAPI.joinPaths(directory, 'salida.csv');
        const salidaExists = await window.electronAPI.fileExists(salidaCsvPath);
        
        if (!salidaExists) {
          console.warn('salida.csv no encontrado');
          setProducts([]);
          return;
        }

        // Leer salida.csv con encoding adecuado
        const csvData = await window.electronAPI.readCsv(salidaCsvPath);
        
        // Cargar mapeo de imágenes desde imagen-url.csv
        const imagenUrlCsvPath = await window.electronAPI.joinPaths(directory, 'imagen-url.csv');
        const imagenUrlExists = await window.electronAPI.fileExists(imagenUrlCsvPath);
        
        let imageMapping = new Map();
        if (imagenUrlExists) {
          try {
            const imageUrlData = await window.electronAPI.readCsv(imagenUrlCsvPath);
            imageUrlData.forEach(row => {
              const url = row.url || '';
              const imagenes = row.imagenes || '';
              if (url && imagenes) {
                // Separar múltiples imágenes por coma
                const imageList = imagenes.split(',').map(img => img.trim()).filter(img => img);
                imageMapping.set(url, imageList);
              }
            });
          } catch (error) {
            console.warn('Error reading imagen-url.csv:', error);
          }
        }

        // Procesar datos CSV para extraer productos únicos y sus variantes
        const productMap = new Map();
        
        csvData.forEach(row => {
          const urlId = row['Identificador de URL'] || '';
          const name = row['Nombre'] || '';
          const categories = row['Categorías'] || '';
          const price = row['Precio'] || '';
          const stock = row['Stock'] || '';
          
          if (urlId) {
            // Si el producto no existe y tiene nombre, es la fila principal del producto
            if (!productMap.has(urlId) && name) {
              // Obtener imágenes del mapeo
              const productImages = imageMapping.get(urlId) || [];
              
              productMap.set(urlId, {
                id: urlId,
                name: name,
                categories: categories,
                price: price,
                stock: stock,
                variants: [],
                images: productImages
              });
            }
            
            // Siempre agregar la fila como variante (incluyendo la principal)
            if (productMap.has(urlId)) {
              const variant = {
                price: price,
                stock: stock,
                properties: []
              };
              
              // Extraer propiedades de variante (1-3)
              for (let i = 1; i <= 3; i++) {
                const propName = row[`Nombre de propiedad ${i}`] || '';
                const propValue = row[`Valor de propiedad ${i}`] || '';
                if (propName && propValue) {
                  variant.properties.push({ name: propName, value: propValue });
                }
              }
              
              // Marcar si es la variante principal (tiene nombre del producto)
              variant.isMain = !!name;
              
              productMap.get(urlId).variants.push(variant);
            }
          }
        });
        
        const productsArray = Array.from(productMap.values());
        setProducts(productsArray);
        
        // Cargar datos de imagen solo para productos visibles en la página actual
        const startIndex = (currentPage - 1) * productsPerPage;
        const endIndex = startIndex + productsPerPage;
        const visibleProducts = productsArray.slice(startIndex, endIndex);
        
        // Ya no necesitamos cargar imágenes en base64, usaremos protocolo local-image://
      }
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Función para cargar imágenes de productos desde carpeta procesadas
  const loadProductImages = async (productId, directory) => {
    try {
      if (window.electronAPI) {
        const procesadasDir = await window.electronAPI.joinPaths(directory, 'procesadas');
        const procesadasExists = await window.electronAPI.fileExists(procesadasDir);
        
        if (!procesadasExists) {
          console.warn('Carpeta procesadas no encontrada');
          setProductImages([]);
          return;
        }

        // Cargar mapeo de imágenes desde imagen-url.csv
        const imagenUrlCsvPath = await window.electronAPI.joinPaths(directory, 'imagen-url.csv');
        const imagenUrlExists = await window.electronAPI.fileExists(imagenUrlCsvPath);
        
        let productImageFiles = [];
        if (imagenUrlExists) {
          try {
            const imageUrlData = await window.electronAPI.readCsv(imagenUrlCsvPath);
            const productMapping = imageUrlData.find(row => row.url === productId);
            
            if (productMapping && productMapping.imagenes) {
              productImageFiles = productMapping.imagenes
                .split(',')
                .map(img => img.trim())
                .filter(img => img);
            }
          } catch (error) {
            console.warn('Error reading imagen-url.csv:', error);
          }
        }

        setProductImages(productImageFiles);
        // Ya no necesitamos cargar base64, usamos protocolo local-image://
      }
    } catch (error) {
      console.error('Error loading product images:', error);
      setProductImages([]);
    }
  };

  // DEPRECATED: Función para cargar datos de imagen como base64 - Ya no necesaria
  // const loadImageDataForFiles = async (imageFiles, directory) => {
  //   const newImageDataCache = new Map(imageDataCache); // Mantener cache existente
    
  //   for (const imageName of imageFiles) {
  //     try {
  //       // Solo cargar si no está ya en cache
  //       if (!newImageDataCache.has(imageName)) {
  //         const imagePath = await window.electronAPI.joinPaths(directory, 'procesadas', imageName);
  //         const imageData = await window.electronAPI.loadImage(imagePath);
          
  //         if (imageData) {
  //           newImageDataCache.set(imageName, imageData);
  //         }
  //       }
  //     } catch (error) {
  //       console.warn(`Error loading image ${imageName}:`, error);
  //     }
  //   }
    
  //   setImageDataCache(newImageDataCache);
  // };

  // Función para cargar productos eliminados
  const loadDeletedProducts = async () => {
    if (!workingDirectory) return;
    
    try {
      if (window.electronAPI) {
        const deletedDir = await window.electronAPI.joinPaths(workingDirectory, 'eliminados');
        const deletedCsvPath = await window.electronAPI.joinPaths(deletedDir, 'salida.csv');
        const csvExists = await window.electronAPI.fileExists(deletedCsvPath);
        
        if (!csvExists) {
          setDeletedProducts([]);
          return;
        }

        const csvData = await window.electronAPI.readCsv(deletedCsvPath);
        const productMap = new Map();
        
        csvData.forEach(row => {
          const urlId = row['Identificador de URL'] || '';
          const name = row['Nombre'] || '';
          const categories = row['Categorías'] || '';
          
          if (urlId && name && !productMap.has(urlId)) {
            productMap.set(urlId, {
              id: urlId,
              name: name,
              categories: categories,
              deletedAt: new Date().toLocaleDateString()
            });
          }
        });
        
        setDeletedProducts(Array.from(productMap.values()));
      }
    } catch (error) {
      console.error('Error loading deleted products:', error);
      setDeletedProducts([]);
    }
  };

  // Función para editar producto
  const editProduct = async (product) => {
    setCurrentProduct(product);
    setEditForm({
      name: product.name,
      categories: product.categories,
      price: product.price,
      stock: product.stock,
      variants: [...product.variants]
    });
    
    // Cargar imágenes del producto
    if (workingDirectory) {
      await loadProductImages(product.id, workingDirectory);
    }
    
    setView('edit');
  };

  // Función para guardar cambios del producto
  const saveProduct = async () => {
    if (!currentProduct || !workingDirectory) return;
    
    try {
      setLoading(true);
      
      // Actualizar producto en CSV
      const result = await window.electronAPI.updateProductInCsv(
        workingDirectory, 
        currentProduct.id, 
        editForm
      );
      
      if (result.success) {
        // Actualizar estado local
        const updatedProducts = products.map(p => 
          p.id === currentProduct.id 
            ? { ...p, ...editForm }
            : p
        );
        
        setProducts(updatedProducts);
        setView('list');
        setCurrentProduct(null);
      } else {
        alert(`Error al guardar producto: ${result.error}`);
      }
      
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error al guardar el producto');
    } finally {
      setLoading(false);
    }
  };

  // Función para eliminar producto
  const deleteProduct = async (product) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar el producto "${product.name}"?`)) {
      return;
    }
    
    try {
      setLoading(true);
      
      const result = await window.electronAPI.deleteProduct(workingDirectory, product.id);
      
      if (result.success) {
        // Remover del estado local
        setProducts(products.filter(p => p.id !== product.id));
        
        // Regresar a la vista de lista de productos
        setView('list');
        setCurrentProduct(null);
        
        alert(`Producto eliminado correctamente. Se movieron ${result.deletedImages} imágenes y ${result.deletedVariants} variantes a la carpeta 'eliminados'.`);
      } else {
        alert(`Error al eliminar producto: ${result.error}`);
      }
      
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Error al eliminar el producto');
    } finally {
      setLoading(false);
    }
  };

  // Función para limpiar CSV manualmente
  const restoreProduct = async (product) => {
    if (!confirm(`¿Estás seguro de que quieres restaurar el producto "${product.name}"?`)) {
      return;
    }
    
    try {
      setLoading(true);
      
      const result = await window.electronAPI.restoreProduct(workingDirectory, product.id);
      
      if (result.success) {
        // Remover de productos eliminados
        setDeletedProducts(deletedProducts.filter(p => p.id !== product.id));
        
        // Recargar productos principales
        await loadProducts(workingDirectory);
        
        alert(`Producto restaurado correctamente. Se restauraron ${result.restoredImages} imágenes y ${result.restoredVariants} variantes.`);
      } else {
        alert(`Error al restaurar producto: ${result.error}`);
      }
      
    } catch (error) {
      console.error('Error restoring product:', error);
      alert('Error al restaurar el producto');
    } finally {
      setLoading(false);
    }
  };

  // Función para eliminar imagen permanentemente
  const deleteImage = async (imageName) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar permanentemente la imagen "${imageName}"?`)) {
      return;
    }
    
    try {
      if (window.electronAPI && workingDirectory) {
        // Las imágenes están en la carpeta procesadas
        const procesadasDir = await window.electronAPI.joinPaths(workingDirectory, 'procesadas');
        const imagePath = await window.electronAPI.joinPaths(procesadasDir, imageName);
        const result = await window.electronAPI.deleteImagePermanently(imagePath);
        
        if (result.success) {
          // Actualizar estado local
          setProductImages(productImages.filter(img => img !== imageName));
          
          // Limpiar cache de imagen
          const newCache = new Map(imageDataCache);
          newCache.delete(imageName);
          setImageDataCache(newCache);
          
          // También actualizar el archivo imagen-url.csv
          await window.electronAPI.updateImageUrlCsv(workingDirectory, currentProduct.id, imageName, 'remove');
        } else {
          alert(`Error al eliminar imagen: ${result.error}`);
        }
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Error al eliminar la imagen');
    }
  };

  // Filtrar productos según término de búsqueda
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.categories.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calcular paginación
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
  const startIndex = (currentPage - 1) * productsPerPage;
  const endIndex = startIndex + productsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);

  // Resetear página cuando cambia el término de búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Cargar imágenes cuando cambia la página - Ya no necesario con protocolo local-image://
  // useEffect(() => {
  //   if (workingDirectory && currentProducts.length > 0) {
  //     const visibleImages = [];
  //     currentProducts.forEach(product => {
  //       if (product.images && product.images.length > 0) {
  //         visibleImages.push(product.images[0]);
  //       }
  //     });
      
  //     if (visibleImages.length > 0) {
  //       loadImageDataForFiles([...new Set(visibleImages)], workingDirectory);
  //     }
  //   }
  // }, [currentPage, currentProducts.length]);

  // Cargar productos eliminados cuando se cambia a esa vista
  useEffect(() => {
    if (view === 'deleted') {
      loadDeletedProducts();
    }
  }, [view, workingDirectory]);

  // Componente de selección de directorio
  const DirectorySelector = () => (
    <div className="bg-gray-800 p-6 rounded-lg mb-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Package size={20} />
        Gestión de Productos
      </h2>
      <div className="flex items-center gap-4">
        <button
          onClick={selectWorkingDirectory}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded"
        >
          <FolderOpen size={16} />
          Seleccionar Carpeta de Trabajo
        </button>
        {workingDirectory && (
          <span className="text-gray-300 text-sm">
            Carpeta: {workingDirectory.split('\\').pop()}
          </span>
        )}
      </div>
    </div>
  );

  // Vista principal (lista de productos)
  const ListView = () => (
    <div className="space-y-4">
      {/* Controles superiores */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <span className="text-gray-400 text-sm">
            {filteredProducts.length} productos total - Página {currentPage} de {totalPages}
          </span>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setView('deleted')}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 px-4 py-2 rounded text-sm"
          >
            <Trash2 size={16} />
            Ver Eliminados
          </button>
          <button
            onClick={() => {/* TODO: Implementar crear nuevo producto */}}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 px-4 py-2 rounded"
          >
            <Plus size={16} />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Lista de productos */}
      <div className="h-[calc(100vh-147px)] overflow-y-auto pr-2">
        <div className="grid grid-cols-6 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-gray-400">Cargando productos...</p>
            </div>
          ) : currentProducts.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-400">
              <Package size={48} className="mx-auto mb-4 opacity-50" />
              <p>No hay productos disponibles</p>
              <p className="text-sm">Selecciona una carpeta de trabajo para comenzar</p>
            </div>
          ) : (
            currentProducts.map(product => (
              <div 
                key={product.id} 
                className="relative border-4 border-gray-600 hover:border-blue-500 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 hover:scale-105"
                onClick={() => editProduct(product)}
              >
                {/* Imagen del producto */}
                <div className="w-full aspect-[3/4] bg-gray-700 flex items-center justify-center">
                  {product.images?.length > 0 ? (
                    <img 
                      src={window.electronAPI.getLocalImageUrl(
                        `${workingDirectory}\\procesadas\\${product.images[0]}`
                      )}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className={`w-full h-full bg-gray-600 items-center justify-center ${
                      product.images?.length > 0 ? 'hidden' : 'flex'
                    }`}
                  >
                    <Image size={24} className="text-gray-500" />
                  </div>
                </div>

                {/* Información del producto */}
                <div className="bg-black bg-opacity-75 text-white p-2 min-h-[60px]">
                  <h3 className="font-semibold text-sm mb-1 leading-tight" title={product.name}>
                    {product.name}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-gray-300">
                    <span className="flex items-center gap-1">
                      <Image size={12} />
                      {product.images?.length || 0}
                    </span>
                    <span>${product.price}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Controles de paginación */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-4">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded"
          >
            Anterior
          </button>
          
          <div className="flex items-center gap-2">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNumber;
              if (totalPages <= 5) {
                pageNumber = i + 1;
              } else if (currentPage <= 3) {
                pageNumber = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNumber = totalPages - 4 + i;
              } else {
                pageNumber = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={pageNumber}
                  onClick={() => setCurrentPage(pageNumber)}
                  className={`w-10 h-10 rounded ${
                    currentPage === pageNumber
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }`}
                >
                  {pageNumber}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );

  // Vista de productos eliminados
  const DeletedView = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Trash2 size={20} />
          Productos Eliminados
        </h2>
        <button
          onClick={() => setView('list')}
          className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded"
        >
          <X size={16} />
          Volver
        </button>
      </div>

      {deletedProducts.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Trash2 size={48} className="mx-auto mb-4 opacity-50" />
          <p>No hay productos eliminados</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {deletedProducts.map(product => (
            <div key={product.id} className="bg-red-900/20 border border-red-500/30 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{product.name}</h3>
                  <p className="text-gray-400 text-sm">{product.categories}</p>
                  <p className="text-red-400 text-xs mt-1">
                    Eliminado el: {product.deletedAt}
                  </p>
                </div>
                <button
                  onClick={() => restoreProduct(product)}
                  className="flex items-center gap-1 bg-green-600 hover:bg-green-500 px-3 py-1 rounded text-sm"
                >
                  <RotateCcw size={14} />
                  Restaurar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Vista de edición de producto
  const EditView = () => (
    <div className="h-[calc(100vh-90px)] overflow-y-auto pr-2">
      <div className="space-y-6">
        <div className="flex justify-between items-center sticky top-0 bg-gray-900 z-10 py-2">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Edit3 size={20} />
            Editar Producto: {currentProduct?.name}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setView('list')}
              className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded"
            >
              <X size={16} />
              Cancelar
            </button>
            <button
              onClick={() => deleteProduct(currentProduct)}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 px-4 py-2 rounded"
            >
              <Trash2 size={16} />
              Eliminar
            </button>
            <button
              onClick={saveProduct}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-500 px-4 py-2 rounded"
            >
              <Save size={16} />
              Guardar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Columna izquierda: Datos del producto y variantes */}
          <div className="space-y-6">
            {/* Formulario de datos del producto */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Datos del Producto</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Nombre</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => updateEditForm('name', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Categorías</label>
                  <input
                    type="text"
                    value={editForm.categories}
                    onChange={(e) => updateEditForm('categories', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Precio</label>
                    <input
                      type="text"
                      value={editForm.price}
                      onChange={(e) => updateEditForm('price', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Stock</label>
                    <input
                      type="text"
                      value={editForm.stock}
                      onChange={(e) => updateEditForm('stock', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Variantes del producto */}
            {editForm.variants && editForm.variants.length > 0 && (
              <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">Variantes del Producto ({editForm.variants.length})</h3>
                <div className="space-y-3">
                  {editForm.variants.map((variant, index) => {
                    // Crear descripción de la variante
                    let variantDescription = '';
                    if (variant.properties.length > 0) {
                      variantDescription = variant.properties
                        .map(prop => `${prop.name}: ${prop.value}`)
                        .join(', ');
                    } else {
                      variantDescription = variant.isMain ? 'Variante principal' : `Variante ${index + 1}`;
                    }
                    
                    return (
                      <div 
                        key={index} 
                        className={`flex items-center justify-between p-3 rounded ${
                          variant.isMain ? 'bg-blue-900/30 border border-blue-500/30' : 'bg-gray-700'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {variantDescription}
                            </span>
                            {variant.isMain && (
                              <span className="text-xs bg-blue-600 px-2 py-1 rounded">Principal</span>
                            )}
                          </div>
                          {variant.properties.length > 0 && (
                            <div className="text-xs text-gray-400 mt-1">
                              {variant.properties.length} propiedades
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <label className="text-gray-400">Precio:</label>
                            <input
                              type="text"
                              value={variant.price}
                              onChange={(e) => updateVariant(index, 'price', e.target.value)}
                              className="w-20 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-center"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-gray-400">Stock:</label>
                            <input
                              type="text"
                              value={variant.stock}
                              onChange={(e) => updateVariant(index, 'stock', e.target.value)}
                              className="w-16 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-center"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Resumen de variantes */}
                <div className="mt-4 p-3 bg-gray-700/50 rounded text-sm">
                  <div className="grid grid-cols-3 gap-4 text-gray-300">
                    <div>
                      <span className="font-medium">Total variantes:</span> {editForm.variants.length}
                    </div>
                    <div>
                      <span className="font-medium">Con propiedades:</span> {editForm.variants.filter(v => v.properties.length > 0).length}
                    </div>
                    <div>
                      <span className="font-medium">Stock total:</span> {editForm.variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Columna derecha: Gestión de imágenes */}
          <div className="bg-gray-800 p-6 rounded-lg h-fit">
            <h3 className="text-lg font-semibold mb-4">Imágenes del Producto</h3>
            <div className="space-y-4">
              {productImages.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No hay imágenes disponibles</p>
              ) : (
                <div className="overflow-y-auto pr-2">
                  <div className="grid grid-cols-2 gap-3">
                    {productImages.map(image => (
                      <div key={image} className="relative group">
                        <div className="aspect-[3/4] bg-gray-700 rounded-lg overflow-hidden">
                          <img 
                            src={window.electronAPI.getLocalImageUrl(
                              `${workingDirectory}\\procesadas\\${image}`
                            )}
                            alt={image}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <div className="hidden w-full h-full bg-gray-600 items-center justify-center text-xs text-gray-400">
                            <div className="text-center">
                              Error al cargar imagen
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteImage(image)}
                          className="absolute top-2 right-2 bg-red-600 hover:bg-red-500 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                        <p className="text-xs text-gray-400 mt-1 truncate">{image}</p>
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
  );

  // Renderizado principal
  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {!workingDirectory ? (
        <DirectorySelector />
      ) : (
        <div className="space-y-6">
          {view === 'list' && <ListView />}
          {view === 'edit' && <EditView />}
          {view === 'deleted' && <DeletedView />}
        </div>
      )}
    </div>
  );
};

export default ProductsTab;