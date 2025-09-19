const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: (filters) => ipcRenderer.invoke('select-file', filters),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  readCsv: (filePath) => ipcRenderer.invoke('read-csv', filePath),
  loadImage: (imagePath) => ipcRenderer.invoke('load-image', imagePath),
  getImageInfo: (imagePath) => ipcRenderer.invoke('get-image-info', imagePath),
  saveImage: (imagePath, imageData) => ipcRenderer.invoke('save-image', imagePath, imageData),
  createCsv: (csvPath, headers) => ipcRenderer.invoke('create-csv', csvPath, headers),
  saveProduct: (csvPath, productData, variants) => ipcRenderer.invoke('save-product', csvPath, productData, variants),
  moveFile: (sourcePath, destPath) => ipcRenderer.invoke('move-file', sourcePath, destPath),
  copyFile: (sourcePath, destPath) => ipcRenderer.invoke('copy-file', sourcePath, destPath),
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
  createDirectory: (dirPath) => ipcRenderer.invoke('create-directory', dirPath),
  listFiles: (dirPath, extensions) => ipcRenderer.invoke('list-files', dirPath, extensions),
  processInpainting: (imagePath, maskData) => ipcRenderer.invoke('process-inpainting', imagePath, maskData)
});