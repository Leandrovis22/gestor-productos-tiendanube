// preload.js - Updated with inpainting functionality

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: (filters) => ipcRenderer.invoke('select-file', filters),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  readCsv: (filePath) => ipcRenderer.invoke('read-csv', filePath),
  loadImage: (imagePath) => ipcRenderer.invoke('load-image', imagePath),
  getImageInfo: (imagePath) => ipcRenderer.invoke('get-image-info', imagePath),
  createCsv: (csvPath, headers) => ipcRenderer.invoke('create-csv', csvPath, headers),
  appendFile: (path, data, encoding) => ipcRenderer.invoke('append-file', path, data, encoding),
  saveProduct: (csvPath, productData, variants) => ipcRenderer.invoke('save-product', csvPath, productData, variants), // Devuelve { success, urlId }
  moveFile: (sourcePath, destPath) => ipcRenderer.invoke('move-file', sourcePath, destPath),
  copyFile: (sourcePath, destPath) => ipcRenderer.invoke('copy-file', sourcePath, destPath),
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
  createDirectory: (dirPath) => ipcRenderer.invoke('create-directory', dirPath),
  listFiles: (dirPath, extensions) => ipcRenderer.invoke('list-files', dirPath, extensions),
  joinPaths: (...paths) => ipcRenderer.invoke('join-paths', ...paths),
  saveImageUrlMapping: (csvPath, urlId, imagesStr) => ipcRenderer.invoke('save-image-url-mapping', csvPath, urlId, imagesStr),
  getDirectoryFromPath: (filePath) => ipcRenderer.invoke('get-directory-from-path', filePath),

  saveEditedImage: (originalPath, editedImageData) => ipcRenderer.invoke('save-edited-image', originalPath, editedImageData),

  // New inpainting methods
  processInpainting: (imagePath, maskDataUrl) => ipcRenderer.invoke('process-inpainting', imagePath, maskDataUrl),
  checkPythonDependencies: () => ipcRenderer.invoke('check-python-dependencies'),

  // Functions for CombineProducts
  updateProductInResultado: (resultadoPath, primaryImageName, propertyGroup) => ipcRenderer.invoke('update-product-in-resultado', resultadoPath, primaryImageName, propertyGroup),
  removeProductsFromResultado: (resultadoPath, imagesToRemove) => ipcRenderer.invoke('remove-products-from-resultado', resultadoPath, imagesToRemove),

  readConfig: (directoryPath) => ipcRenderer.invoke('read-config', directoryPath),
  savePredefinedType: (directoryPath, newType) => ipcRenderer.invoke('savePredefinedType', directoryPath, newType),

});