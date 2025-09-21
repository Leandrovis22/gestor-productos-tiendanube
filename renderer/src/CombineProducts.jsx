import { useState, useEffect } from 'react';

const InlineLocalImage = ({ path, alt, className }) => {
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

const CombineProducts = ({ workingDirectory, onCombinationSaved, csvData }) => {
  const [imagesInDirectory, setImagesInDirectory] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [primaryImage, setPrimaryImage] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPropertyGroup, setSelectedPropertyGroup] = useState(null);
  const [existingPrimaryImages, setExistingPrimaryImages] = useState(new Set());

  useEffect(() => {
    const loadImages = async () => {
      if (workingDirectory && window.electronAPI) {
        const allImages = await window.electronAPI.listFiles(workingDirectory, ['.jpg', '.jpeg', '.png', '.webp']);
        
        // Cargar imágenes ya procesadas o saltadas
        const processedImages = new Set(await window.electronAPI.listFiles(`${workingDirectory}/procesadas`, ['.jpg', '.jpeg', '.png', '.webp']));
        const saltadasImages = new Set(await window.electronAPI.listFiles(`${workingDirectory}/saltadas`, ['.jpg', '.jpeg', '.png', '.webp']));
        
        // Cargar imágenes que ya son secundarias en una combinación
        const secondaryImages = new Set();
        const mapPath = `${workingDirectory}/imagenes_producto.csv`;
        const mapExists = await window.electronAPI.fileExists(mapPath);
        if (mapExists) {
          const mappingData = await window.electronAPI.readCsv(mapPath);
          setExistingPrimaryImages(new Set(mappingData.map(row => row.imagen_principal)));
          mappingData.forEach(row => {
            if (row.imagen_secundaria) {
              secondaryImages.add(row.imagen_secundaria);
            }
          });
        }

        // Filtrar imágenes para no mostrar las ya procesadas, saltadas o combinadas como secundarias
        const availableImages = allImages.filter(img => 
          !processedImages.has(img) && !saltadasImages.has(img) && !secondaryImages.has(img)
        );
        setImagesInDirectory(availableImages);
      }
    };

    loadImages();
  }, [workingDirectory]);

  const toggleImageSelection = (imageName) => {
    setSelectedImages(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(imageName)) {
        newSelection.delete(imageName);
      } else {
        newSelection.add(imageName);
      }
      const newArray = Array.from(newSelection);
      
      if (primaryImage === imageName && !newSelection.has(imageName)) {
        setPrimaryImage(newArray.length > 0 ? newArray[0] : null);
      } else if (!primaryImage && newArray.length > 0) {
        setPrimaryImage(newArray[0]);
      }
      return newArray;
    });
  };

  const selectAllImages = () => {
    setSelectedImages(imagesInDirectory);
    setPrimaryImage(imagesInDirectory.length > 0 ? imagesInDirectory[0] : null);
  };

  const handleCombineClick = async () => {
    if (selectedImages.length < 2) {
      alert("Debes seleccionar al menos 2 imágenes para combinar.");
      return;
    }

    // Validar que no se estén combinando dos productos principales
    const mapPath = `${workingDirectory}/imagenes_producto.csv`;
    const mapExists = await window.electronAPI.fileExists(mapPath);
    let primaryProductsInSelection = 0;
    if (mapExists) {
      const mappingData = await window.electronAPI.readCsv(mapPath);
      const currentPrimaryImages = new Set(mappingData.map(row => row.imagen_principal));
      selectedImages.forEach(img => {
        if (existingPrimaryImages.has(img)) {
          primaryProductsInSelection++;
        }
      });
    }

    if (primaryProductsInSelection > 1) {
      alert(`No se pueden combinar dos o más productos que ya son principales. Has seleccionado ${primaryProductsInSelection} productos principales en tu combinación.`);
      return;
    }

    setIsModalOpen(true);
  };

  const getUniquePropertyGroups = () => {
    if (!csvData || !selectedImages.length) return [];
    
    const groups = [];
    const seenGroups = new Set();
    
    selectedImages.forEach(imageName => {
      const row = csvData.find(r => r.archivo === imageName);
      if (row) {
        const groupKey = `${row.descripcion || ''}|${row.precio || ''}|${row.categorias || ''}`;
        if (!seenGroups.has(groupKey) && (row.descripcion || row.precio || row.categorias)) {
          seenGroups.add(groupKey);
          groups.push({
            imageName,
            descripcion: row.descripcion || '',
            precio: row.precio || '',
            categorias: row.categorias || '',
            key: groupKey
          });
        }
      }
    });
    
    return groups;
  };

  const saveCombination = async () => {
    if (!primaryImage || selectedImages.length < 2) {
      alert("Debes seleccionar al menos dos imágenes, una de ellas como principal.");
      return;
    }

    if (!selectedPropertyGroup) {
      alert("Debes seleccionar un grupo de propiedades para el producto principal.");
      return;
    }

    try {
      // 1. Save image combinations to imagenes_producto.csv
      const combinationOutputPath = `${workingDirectory}/imagenes_producto.csv`;
      const secondaryImages = selectedImages.filter(img => img !== primaryImage);
      
      if (secondaryImages.length > 0) {
        const rows = secondaryImages.map(secImg => `"${primaryImage}";"${secImg}"`).join('\n') + '\n';
        await window.electronAPI.appendFile(combinationOutputPath, rows, 'latin1');
      }

      // 2. Update resultado.csv with the selected properties for the primary image
      const resultadoPath = `${workingDirectory}/resultado.csv`;
      await window.electronAPI.updateProductInResultado(resultadoPath, primaryImage, selectedPropertyGroup);

      // 3. Remove secondary images from resultado.csv
      await window.electronAPI.removeProductsFromResultado(resultadoPath, secondaryImages);

      // 4. Update local state
      setImagesInDirectory(prev => prev.filter(img => !secondaryImages.includes(img)));
      setSelectedImages([]);
      setPrimaryImage(null);
      setSelectedPropertyGroup(null);
      setIsModalOpen(false);
      
      // 5. Notify parent component
      onCombinationSaved();
      
    } catch (error) {
      console.error('Error saving combination:', error);
      alert(`Error al guardar la combinación: ${error.message}`);
    }
  };

  const getBorderColor = (imageName) => {
    const isSelected = selectedImages.includes(imageName);
    if (isSelected) {
      if (imageName === primaryImage) {
        return 'border-yellow-500'; // Principal seleccionado
      }
      return 'border-blue-500'; // Secundario seleccionado
    }
    if (existingPrimaryImages.has(imageName)) {
      return 'border-red-500'; // Ya es un producto principal
    }
    // Producto individual, no seleccionado
    return 'border-green-500';
  };

  const propertyGroups = getUniquePropertyGroups();

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Combinar Productos</h2>
      <div className="mb-4 flex gap-4">
        <button onClick={selectAllImages} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded">
          Seleccionar Todo
        </button>
        <button onClick={() => setSelectedImages([])} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded">
          Deseleccionar Todo
        </button>
        {selectedImages.length > 0 && (
          <div className="flex items-center gap-4 p-1 bg-gray-800 rounded-lg">
            <div>
              <button
                onClick={handleCombineClick}
                className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded"
                disabled={selectedImages.length < 2}
              >
                Combinar {selectedImages.length} imágenes
              </button>
            </div>
            <div className="flex flex-col">
              <p className="text-sm text-gray-400">Principal: {primaryImage || 'Ninguna seleccionada'}</p>
              {selectedImages.length < 2 && <p className="text-xs text-yellow-400 mt-1">Selecciona al menos 2 imágenes para combinar.</p>}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
        {imagesInDirectory.map(imageName => (
          <div
            key={imageName}
            className={`relative border-4 rounded-lg overflow-hidden cursor-pointer transition-all ${getBorderColor(imageName)}`}
            onClick={() => toggleImageSelection(imageName)}
          >
            <InlineLocalImage
              path={`${workingDirectory}/${imageName}`}
              alt={imageName}
              className="w-full h-32 object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">{imageName}</div>
            {selectedImages.includes(imageName) && (
              <div className="absolute top-1 right-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setPrimaryImage(imageName); }}
                  className={`w-6 h-6 rounded-full text-xs font-bold ${imageName === primaryImage ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-800 hover:bg-yellow-300'}`}
                  title="Marcar como principal"
                >
                  P
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-[65rem] max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Confirmar Combinación</h3>
            <p className="text-sm text-gray-300 mb-6">
              Se establecerá <span className="font-bold text-green-400">{primaryImage}</span> como el producto principal.
            </p>
            
            <div className="mb-6">
              <h4 className="text-md font-semibold text-gray-300 mb-3">
                Selecciona el grupo de propiedades para el producto principal:
              </h4>
              
              {propertyGroups.length > 0 ? (
                <div className="flex flex-wrap gap-4 justify-center">
                  {propertyGroups.map((group, index) => (
                    <div
                      key={group.key}
                      onClick={() => setSelectedPropertyGroup(group)}
                      className={`flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedPropertyGroup?.key === group.key
                          ? 'border-blue-500 bg-blue-900/20'
                          : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                      } w-[30rem]`}
                    >
                      <div className="flex-shrink-0">
                        <InlineLocalImage
                          path={`${workingDirectory}/${group.imageName}`}
                          alt={group.imageName}
                          className="w-[10rem] h-[13rem] object-cover rounded-md"
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="space-y-2">     
                            <div className="flex-1">
                              <p className="text-xs text-gray-200 mt-1">{group.imageName}</p>
                              
                            </div>                     
                          <div className="flex gap-4">
                          
                            
                            <div className="flex-1">
                              <span className="text-xs text-gray-400 font-medium">Descripción:</span>
                              <p className="text-sm text-gray-200 break-words">
                                {group.descripcion || <span className="text-gray-500 italic">Sin descripción</span>}
                              </p>
                            </div>
                            
                            <div className="flex-1 max-w-[5rem]">
                              <span className="text-xs text-gray-400 font-medium">Precio:</span>
                              <p className="text-sm text-gray-200">
                                {group.precio || <span className="text-gray-500 italic">Sin precio</span>}
                              </p>
                            </div>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400 font-medium">Categorías:</span>
                            <p className="text-sm text-gray-200 break-words">
                              {group.categorias || <span className="text-gray-500 italic">Sin categorías</span>}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No se encontraron grupos de propiedades válidos en las imágenes seleccionadas.</p>
              )}
            </div>

            <div className="border-t border-gray-600 pt-4">
              <h4 className="text-sm font-medium text-gray-400 mb-2">Resumen de la operación:</h4>
              <div className="text-sm text-gray-300 space-y-1">
                <p>• <strong>{primaryImage}</strong> se mantendrá como producto principal</p>
                <p>• <strong>{selectedImages.length - 1}</strong> imágenes se vincularán como secundarias</p>
                <p>• Las imágenes secundarias se eliminarán de resultado.csv</p>
                <p>• El producto principal adoptará las propiedades del grupo seleccionado</p>
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-6">
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedPropertyGroup(null);
                }} 
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
              >
                Cancelar
              </button>
              <button 
                onClick={saveCombination} 
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded"
                disabled={!selectedPropertyGroup}
              >
                Confirmar y Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CombineProducts;