const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const Papa = require('papaparse');
const sharp = require('sharp');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets/icon.png'),
    show: false
  });

  const isDev = !app.isPackaged;
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer/dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// API Handlers
ipcMain.handle('select-file', async (event, filters) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: filters || [
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    return {
      filePath: result.canceled ? null : result.filePaths[0],
      canceled: result.canceled
    };
  } catch (error) {
    console.error('Error selecting file:', error);
    return { filePath: null, error: error.message };
  }
});

ipcMain.handle('select-directory', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    
    return {
      directoryPath: result.canceled ? null : result.filePaths[0],
      canceled: result.canceled
    };
  } catch (error) {
    console.error('Error selecting directory:', error);
    return { directoryPath: null, error: error.message };
  }
});

ipcMain.handle('read-csv', async (event, filePath) => {
  try {
    const csvContent = await fs.readFile(filePath, 'utf-8');
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvContent, {
        header: true,
        delimiter: ';',
        bom: true, // <-- Añade esta línea
        skipEmptyLines: true,
        complete: (results) => {
          resolve(results.data);
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error('Error reading CSV:', error);
    throw error;
  }
});

ipcMain.handle('load-image', async (event, imagePath) => {
  try {
    // Verificar si el archivo existe
    const exists = await fs.access(imagePath).then(() => true).catch(() => false);
    if (!exists) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    // Leer la imagen y convertirla a base64
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
    
    return base64Image;
  } catch (error) {
    console.error('Error loading image:', error);
    throw error;
  }
});

ipcMain.handle('get-image-info', async (event, imagePath) => {
  try {
    const metadata = await sharp(imagePath).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format
    };
  } catch (error) {
    console.error('Error getting image info:', error);
    throw error;
  }
});

ipcMain.handle('save-image', async (event, imagePath, imageData) => {
  try {
    // Convertir base64 a buffer
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    await fs.writeFile(imagePath, buffer);
    return { success: true };
  } catch (error) {
    console.error('Error saving image:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-csv', async (event, csvPath, headers) => {
  try {
    // Verificar si el archivo ya existe para no sobrescribirlo
    const exists = await fs.access(csvPath).then(() => true).catch(() => false);
    if (exists) {
      console.log('El archivo salida.csv ya existe. No se sobrescribirá.');
      return { success: true, message: 'File already exists' };
    }

    const csvContent = headers.join(';') + '\n';
    await fs.writeFile(csvPath, csvContent, 'latin1'); // Usar 'latin1' para codificación ANSI
    return { success: true };
  } catch (error) {
    console.error('Error creating CSV:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-product', async (event, csvPath, productData, variants) => {
  try {
    // Generar URL ID con timestamp
    const generateUrlId = (name) => {
      const timestamp = new Date().toISOString()
        .slice(0, 19)
        .replace(/[-:]/g, '')
        .replace('T', '-');
      
      const cleanName = name.toLowerCase()
        .replace(/[áéíóúñü]/g, match => ({
          'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n', 'ü': 'u'
        })[match] || match)
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      return `${cleanName}-${timestamp}`;
    };

    const urlId = generateUrlId(productData.name);
    
    // Formatear precio
    const formatPrice = (priceStr) => {
      if (!priceStr) return '';
      try {
        // 1. Como la entrada siempre es un entero, eliminamos todos los separadores de miles (puntos o comas).
        //    Ej: "1.000" -> "1000", "1,000" -> "1000"
        const cleanPrice = priceStr.replace(/[.,]/g, '');
        const price = parseFloat(cleanPrice);
        // 2. Formatear a 'en-US' que usa "," para miles y "." para decimales.
        return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } catch {
        return '';
      }
    };

    const rows = [];

    if (variants && variants.length > 0) {
      // Primera variante con todos los datos del producto
      const firstVariant = variants[0];
      const activeProperties = firstVariant.properties.filter(p => p.value && p.value.trim());
      
      const mainRow = [
        urlId,
        productData.name,
        productData.categories
      ];

      // Agregar hasta 3 propiedades
      for (let i = 0; i < 3; i++) {
        if (i < activeProperties.length) {
          mainRow.push(activeProperties[i].name, activeProperties[i].value);
        } else {
          mainRow.push('', '');
        }
      }

      mainRow.push(
        formatPrice(firstVariant.price),
        '', '0.02', '2.00', '2.00', '2.00',
        firstVariant.stock || '10',
        '', '', 'SI', 'NO', '', '', '', '', '', 'SI', '', '', '', ''
      );

      rows.push(mainRow);

      // Variantes adicionales
      for (let i = 1; i < variants.length; i++) {
        const variant = variants[i];
        const activePropsVariant = variant.properties.filter(p => p.value && p.value.trim());
        
        const variantRow = [urlId, '', '']; // Mismo URL ID, nombre y categorías vacías

        // Agregar propiedades de la variante
        for (let j = 0; j < 3; j++) {
          if (j < activePropsVariant.length) {
            variantRow.push(activePropsVariant[j].name, activePropsVariant[j].value);
          } else {
            variantRow.push('', '');
          }
        }

        variantRow.push(
          formatPrice(variant.price),
          '', '0.02', '2.00', '2.00', '2.00',
          variant.stock || '10',
          '', '', '', '', '', '', '', '', '', '', '', '', '', ''
        );

        rows.push(variantRow);
      }
    } else {
      // Sin variantes: solo fila principal
      const mainRow = [
        urlId,
        productData.name,
        productData.categories,
        '', '', '', '', '', '', // Sin propiedades de variantes
        formatPrice(productData.price),
        '', '0.02', '2.00', '2.00', '2.00',
        productData.stock || '10',
        '', '', 'SI', 'NO', '', '', '', '', '', 'SI', '', '', '', ''
      ];
      
      rows.push(mainRow);
    }

    // Escribir al CSV
    const csvRows = rows.map(row => row.join(';')).join('\n') + '\n';
    await fs.appendFile(csvPath, csvRows, 'latin1'); // Usar 'latin1' para codificación ANSI

    return { success: true, urlId };
  } catch (error) {
    console.error('Error saving product:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('move-file', async (event, sourcePath, destPath) => {
  try {
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.rename(sourcePath, destPath);
    return { success: true };
  } catch (error) {
    console.error('Error moving file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('copy-file', async (event, sourcePath, destPath) => {
  try {
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.copyFile(sourcePath, destPath);
    return { success: true };
  } catch (error) {
    console.error('Error copying file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file-exists', async (event, filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('create-directory', async (event, dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return { success: true };
  } catch (error) {
    console.error('Error creating directory:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-files', async (event, dirPath, extensions) => {
  try {
    const files = await fs.readdir(dirPath);
    if (extensions) {
      const filteredFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return extensions.includes(ext);
      });
      return filteredFiles;
    }
    return files;
  } catch (error) {
    console.error('Error listing files:', error);
    return [];
  }
});

ipcMain.handle('append-file', async (event, filePath, data, encoding) => {
  try {
    await fs.appendFile(filePath, data, encoding || 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('Error appending to file:', error);
    return { success: false, error: error.message };
  }
});

// Función para procesar inpainting (simulado)
ipcMain.handle('process-inpainting', async (event, imagePath, maskData) => {
  try {
    // En una implementación real, aquí usarías una librería de procesamiento de imágenes
    // Por ahora, simplemente retornamos la imagen original
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
    
    // Aquí podrías integrar con OpenCV, Sharp, o una API de inpainting
    console.log('Processing inpainting for:', imagePath);
    
    return base64Image;
  } catch (error) {
    console.error('Error processing inpainting:', error);
    throw error;
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});