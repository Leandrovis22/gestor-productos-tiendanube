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
  saveProduct: (csvPath, productData, variants) => ipcRenderer.invoke('save-product', csvPath, productData, variants),
  moveFile: (sourcePath, destPath) => ipcRenderer.invoke('move-file', sourcePath, destPath),
  copyFile: (sourcePath, destPath) => ipcRenderer.invoke('copy-file', sourcePath, destPath),
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
  createDirectory: (dirPath) => ipcRenderer.invoke('create-directory', dirPath),
  listFiles: (dirPath, extensions) => ipcRenderer.invoke('list-files', dirPath, extensions),
  saveImageUrlMapping: (csvPath, urlId, imagesStr) => ipcRenderer.invoke('save-image-url-mapping', csvPath, urlId, imagesStr),
  
  saveEditedImage: (originalPath, editedImageData) => ipcRenderer.invoke('save-edited-image', originalPath, editedImageData),
  
  // New inpainting methods
  processInpainting: (imagePath, maskDataUrl) => ipcRenderer.invoke('process-inpainting', imagePath, maskDataUrl),
  checkPythonDependencies: () => ipcRenderer.invoke('check-python-dependencies'),
});