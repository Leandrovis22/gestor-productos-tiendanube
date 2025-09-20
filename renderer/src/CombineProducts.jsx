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

const CombineProducts = ({ workingDirectory, onCombinationSaved }) => {
  const [imagesInDirectory, setImagesInDirectory] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [primaryImage, setPrimaryImage] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [csvData, setCsvData] = useState([]);

  useEffect(() => {
    const loadImages = async () => {
      if (workingDirectory && window.electronAPI) {
        const allImages = await window.electronAPI.listFiles(workingDirectory, ['.jpg', '.jpeg', '.png', '.webp']);
        const processedImages = new Set(await window.electronAPI.listFiles(`${workingDirectory}/procesadas`, ['.jpg', '.jpeg', '.png', '.webp']));
        const saltadasImages = new Set(await window.electronAPI.listFiles(`${workingDirectory}/saltadas`, ['.jpg', '.jpeg', '.png', '.webp']));
        
        setImagesInDirectory(allImages.filter(img => !processedImages.has(img) && !saltadasImages.has(img)));
      }
    };

    const loadCsv = async () => {
        if (window.electronAPI) {
            const result = await window.electronAPI.selectFile([{ name: 'CSV Files', extensions: ['csv'] }], true);
            if (result.filePath && !result.canceled) {
                const data = await window.electronAPI.readCsv(result.filePath);
                setCsvData(data);
            }
        }
    }

    loadImages();
    if (csvData.length === 0) {
    }
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

  const saveCombination = async () => {
    if (!primaryImage || selectedImages.length < 2) {
      alert("Debes seleccionar al menos dos imágenes, una de ellas como principal.");
      return;
    }

    const combinationOutputPath = `${workingDirectory}/imagenes_producto.csv`;
    const secondaryImages = selectedImages.filter(img => img !== primaryImage);

    if (secondaryImages.length > 0) {
      const rows = secondaryImages.map(secImg => `"${primaryImage}";"${secImg}"`).join('\n') + '\n';
      await window.electronAPI.appendFile(combinationOutputPath, rows, 'latin1');
    }

    setImagesInDirectory(prev => prev.filter(img => !secondaryImages.includes(img)));
    setSelectedImages([primaryImage]);
    setIsModalOpen(false);
    onCombinationSaved(); // Notificar al padre que se guardó una combinación
  };

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
      </div>

      {selectedImages.length > 0 && (
        <div className="mb-4 p-4 bg-gray-800 rounded-lg">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded"
            disabled={selectedImages.length < 2}
          >
            Combinar {selectedImages.length} imágenes
          </button>
          <p className="text-sm text-gray-400 mt-2">
            Principal: {primaryImage || 'Ninguna seleccionada'}
          </p>
           {selectedImages.length < 2 && <p className="text-xs text-yellow-400 mt-1">Selecciona al menos 2 imágenes para combinar.</p>}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
        {imagesInDirectory.map(imageName => (
          <div
            key={imageName}
            className={`relative border-4 rounded-lg overflow-hidden cursor-pointer transition-all ${selectedImages.includes(imageName) ? (imageName === primaryImage ? 'border-green-500' : 'border-blue-500') : 'border-gray-700 hover:border-gray-600'}`}
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
                  className={`w-6 h-6 rounded-full text-xs font-bold ${imageName === primaryImage ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-800 hover:bg-green-300'}`}
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
          <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Confirmar Combinación</h3>
            <p className="text-sm text-gray-300 mb-2">Se establecerá <span className="font-bold text-green-400">{primaryImage}</span> como el producto principal.</p>
            <p className="text-sm text-gray-400 mb-4">Las siguientes imágenes se asociarán como secundarias:</p>
            <ul className="list-disc list-inside bg-gray-700 p-3 rounded-md max-h-48 overflow-y-auto mb-6">
              {selectedImages.filter(img => img !== primaryImage).map(img => <li key={img} className="text-sm">{img}</li>)}
            </ul>
            <div className="flex justify-end gap-4">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded">
                Cancelar
              </button>
              <button onClick={saveCombination} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded">
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