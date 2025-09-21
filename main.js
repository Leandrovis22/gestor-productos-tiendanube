// root main.js

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const Papa = require('papaparse');
const sharp = require('sharp');

const { spawn } = require('child_process');
const os = require('os');

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
        bom: true,
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

ipcMain.handle('create-csv', async (event, csvPath, headers) => {
  try {
    const exists = await fs.access(csvPath).then(() => true).catch(() => false);
    if (exists) {
      return { success: true, message: 'File already exists' };
    }

    const csvContent = headers.join(';') + '\n'; // Usar 'latin1' para codificación ANSI
    await fs.writeFile(csvPath, csvContent, 'latin1'); // Usar 'latin1' para codificación ANSI
    return { success: true };
  } catch (error) {
    console.error('Error creating CSV:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-product', async (event, csvPath, productData, variants) => {
  try {
    // Función para generar un identificador de URL único y limpio.
    const generateUrlId = (name) => {
      const now = new Date();
      const pad = (num) => num.toString().padStart(2, '0');
      const day = pad(now.getDate());
      const month = pad(now.getMonth() + 1); // Meses son 0-indexados
      const hours = pad(now.getHours());
      const minutes = pad(now.getMinutes());
      const timestamp = `${day}-${month}-${hours}-${minutes}`;
      
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
    
    const formatPrice = (priceStr) => {
      if (!priceStr) return '';
      try {
        const cleanPrice = priceStr.replace(/[.,]/g, '');
        const price = parseFloat(cleanPrice);
        return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } catch {
        return '';
      }
    };

    const rows = [];

    if (variants && variants.length > 0) {
      const firstVariant = variants[0];
      const activeProperties = firstVariant.properties.filter(p => p.value && p.value.trim());
      
      const mainRow = [
        urlId,
        productData.name,
        productData.categories
      ];

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

      for (let i = 1; i < variants.length; i++) {
        const variant = variants[i];
        const activePropsVariant = variant.properties.filter(p => p.value && p.value.trim());
        
        const variantRow = [urlId, '', '']; // Mismo URL ID, nombre y categorías vacías

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
      const mainRow = [
        urlId,
        productData.name,
        productData.categories,
        '', '', '', '', '', '',
        formatPrice(productData.price),
        '', '0.02', '2.00', '2.00', '2.00',
        productData.stock || '10',
        '', '', 'SI', 'NO', '', '', '', '', '', 'SI', '', '', '', ''
      ];
      
      rows.push(mainRow);
    }

    const csvRows = rows.map(row => row.join(';')).join('\n') + '\n';
    await fs.appendFile(csvPath, csvRows, 'latin1');

    return { success: true, urlId }; // <-- Devolvemos la urlId generada
  } catch (error) {
    console.error('Error saving product:', error);
    return { success: false, error: error.message };
  }
});

// Add these two new IPC handlers to your electron main.js file

ipcMain.handle('update-product-in-resultado', async (event, resultadoPath, primaryImageName, propertyGroup) => {
  try {
    // Check if file exists
    const exists = await fs.access(resultadoPath).then(() => true).catch(() => false);
    if (!exists) {
      return { success: true };
    }

    // Read the CSV file
    const csvContent = await fs.readFile(resultadoPath, 'latin1');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return { success: true };
    }

    // Find and update the line with the primary image
    let updated = false;
    const updatedLines = lines.map(line => {
      const columns = line.split(';');
      
      // Look for the primary image in the description or any relevant field
      // You might need to adjust this logic based on how images are referenced in resultado.csv
      if (line.includes(primaryImageName)) {
        updated = true;
        
        // Update the relevant columns with the new property group
        // Column mapping for resultado.csv: 0: archivo, 1: descripcion, 2: precio, 3: categorias
        if (columns.length >= 4) {
          if (propertyGroup.descripcion) {
            columns[1] = propertyGroup.descripcion; // Name/Description column
          }
          if (propertyGroup.precio) {
            columns[2] = propertyGroup.precio; // Price column
          }
          if (propertyGroup.categorias) {
            columns[3] = propertyGroup.categorias; // Categories column
          }
        }
        
        return columns.join(';');
      }
      return line;
    });

    if (updated) {
      // Write back to file
      await fs.writeFile(resultadoPath, updatedLines.join('\n') + '\n', 'latin1');
      console.log(`Updated product ${primaryImageName} in resultado.csv with new properties`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating product in resultado.csv:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remove-products-from-resultado', async (event, resultadoPath, imagesToRemove) => {
  try {
    // Check if file exists
    const exists = await fs.access(resultadoPath).then(() => true).catch(() => false);
    if (!exists) {
      console.log('resultado.csv does not exist yet, skipping removal');
      return { success: true };
    }

    // Read the CSV file
    const csvContent = await fs.readFile(resultadoPath, 'latin1');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return { success: true };
    }

    // Filter out lines that contain any of the images to remove
    const filteredLines = lines.filter(line => {
      return !imagesToRemove.some(imageToRemove => line.includes(imageToRemove));
    });

    const removedCount = lines.length - filteredLines.length;

    if (removedCount > 0) {
      // Write back to file
      await fs.writeFile(resultadoPath, filteredLines.join('\n') + '\n', 'latin1');
      console.log(`Removed ${removedCount} products from resultado.csv`);
    }

    return { success: true, removedCount };
  } catch (error) {
    console.error('Error removing products from resultado.csv:', error);
    return { success: false, error: error.message };
  }
});



ipcMain.handle('append-file', async (event, filePath, data, encoding) => {
  try {
    await fs.appendFile(filePath, data, encoding);
    return { success: true };
  } catch (error) {
    console.error('Error appending to file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('move-file', async (event, sourcePath, destPath) => {
  try {
    await fs.mkdir(path.dirname(path.normalize(destPath)), { recursive: true });
    await fs.rename(sourcePath, destPath);
    return { success: true };
  } catch (error) {
    console.error('Error moving file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('copy-file', async (event, sourcePath, destPath) => {
  try {
    await fs.mkdir(path.dirname(path.normalize(destPath)), { recursive: true });
    await fs.copyFile(sourcePath, destPath);
    return { success: true };
  } catch (error) {
    console.error('Error copying file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file-exists', async (event, filePath) => {
  try {
    await fs.access(path.normalize(filePath));
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('create-directory', async (event, dirPath) => {
  try {
    await fs.mkdir(path.normalize(dirPath), { recursive: true });
    return { success: true };
  } catch (error) {
    console.error('Error creating directory:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-files', async (event, dirPath, extensions) => {
  try {
    const files = await fs.readdir(path.normalize(dirPath));
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

ipcMain.handle('join-paths', (event, ...paths) => {
  return path.join(...paths);
});

ipcMain.handle('save-image-url-mapping', async (event, csvPath, urlId, imagesStr) => {
  try {
    const imageUrlCsvPath = path.join(path.dirname(csvPath), 'imagen-url.csv');
    
    const exists = await fs.access(imageUrlCsvPath).then(() => true).catch(() => false);
    if (!exists) {
      const headers = 'url;imagenes\n';
      await fs.writeFile(imageUrlCsvPath, headers, 'utf-8');
    }
    
    const row = `${urlId};${imagesStr}\n`;
    await fs.appendFile(imageUrlCsvPath, row, 'utf-8');
    
    return { success: true };
  } catch (error) {
    console.error('Error saving image-url mapping:', error);
    return { success: false, error: error.message };
  }
});



ipcMain.handle('get-directory-from-path', (event, filePath) => {
  try {
    return path.dirname(path.normalize(filePath));
  } catch (error) {
    console.error('Error getting directory from path:', error);
    return null;
  }
});


//Image manipulation root main.js

// Handler mejorado para guardar imagen editada manteniendo dimensiones originales
ipcMain.handle('save-edited-image', async (event, originalPath, editedImageData) => {
  try {
    // Obtener dimensiones de la imagen original
    const originalMetadata = await sharp(originalPath).metadata();
    const originalWidth = originalMetadata.width;
    const originalHeight = originalMetadata.height;
    
    // Convertir base64 a buffer
    const base64Data = editedImageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    const backupDir = path.join(path.dirname(originalPath), 'backup_editadas');
    await fs.mkdir(backupDir, { recursive: true });

    const filename = path.basename(originalPath);
    const filenameParts = filename.split('.');
    const extension = filenameParts.pop();
    const baseFilename = filenameParts.join('.');
    
    // Verificar si ya existe un backup para esta imagen
    const filesInBackupDir = await fs.readdir(backupDir);
    const backupExists = filesInBackupDir.some(file => file.startsWith(`${baseFilename}_backup_`));

    let backupPath = null;
    if (!backupExists) {
      // Crear backup de la imagen original con timestamp solo si no existe
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
      backupPath = path.join(backupDir, `${baseFilename}_backup_${timestamp}.${extension}`);
      await fs.copyFile(originalPath, backupPath);
      console.log(`[BACKUP] Created backup for ${filename} at ${backupPath}`);
    } else {
      console.log(`[BACKUP] Backup for ${filename} already exists. Skipping creation.`);
    }
    
    // Procesar la imagen manteniendo las dimensiones exactas de la original
    const processedBuffer = await sharp(buffer)
      .resize(originalWidth, originalHeight, {
        fit: 'fill', // Forzar dimensiones exactas
        kernel: sharp.kernel.lanczos3 // Mejor algoritmo de redimensionado
      })
      .jpeg({ quality: 95, progressive: true }) // Calidad web estándar
      .toBuffer();
    
    // Sobrescribir la imagen original con la editada
    await fs.writeFile(originalPath, processedBuffer);
    
    return {
      success: true,
      backupPath: backupPath,
      message: 'Imagen guardada manteniendo dimensiones originales'
    };
    
  } catch (error) {
    console.error('Error guardando imagen editada:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Handler for processing inpainting with OpenCV Python script - MODIFIED
ipcMain.handle('process-inpainting', async (event, imagePath, maskDataUrl) => {
  try {
    
    // Create temporary directory for processing
    const tempDir = path.join(os.tmpdir(), 'inpainting_temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    // Generate unique filenames for this operation
    const timestamp = Date.now();
    const tempImagePath = path.join(tempDir, `temp_image_${timestamp}.jpg`);
    const tempMaskPath = path.join(tempDir, `temp_mask_${timestamp}.png`);
    const tempOutputPath = path.join(tempDir, `temp_output_${timestamp}.jpg`);
    
    // Copy original image to temp location
    await fs.copyFile(path.normalize(imagePath), tempImagePath);
    
    // Save mask from base64 to file
    const base64Data = maskDataUrl.replace(/^data:image\/png;base64,/, '');
    const maskBuffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(tempMaskPath, maskBuffer);
    
    // Determine Python script path (should be in the same directory as main.js)
    const scriptPath = path.join(__dirname, 'inpaint.py');
    
    // Check if Python script exists
    try {
      await fs.access(scriptPath);
    } catch (error) {
      throw new Error(`Python script not found at ${scriptPath}. Please ensure inpaint.py is in the app directory.`);
    }
    
    // Execute Python inpainting script
    const pythonResult = await runPythonInpainting(scriptPath, tempImagePath, tempMaskPath, tempOutputPath);
    
    if (!pythonResult.success) {
      throw new Error(pythonResult.error || 'Python inpainting script failed');
    }
    
    // La ruta del archivo de salida ahora viene del stdout del script de Python
    const successfulOutputPath = pythonResult.output.trim();

    // Check if output file was created
    try {
      await fs.access(successfulOutputPath);
    } catch (error) {
      console.error(`❌ [MAIN] Python script succeeded but output file is missing at ${successfulOutputPath}`);
      throw new Error('Inpainting output file was not created');
    }
    
    // Read the processed image into a buffer
    const outputBuffer = await fs.readFile(successfulOutputPath);
    const outputBase64 = outputBuffer.toString('base64');
    const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

    // Cleanup temporary files
    try {
      await fs.unlink(tempImagePath);
      await fs.unlink(tempMaskPath);
      await fs.unlink(successfulOutputPath);
      await fs.rmdir(tempDir);
    } catch (cleanupError) {
      console.warn('⚠️ [MAIN] Warning: Could not clean up temporary files:', cleanupError.message);
    }
    
    return {
      success: true,
      imageData: `data:${mimeType};base64,${outputBase64}`,
      message: 'Inpainting completed successfully - returning image data'
    };
    
  } catch (error) {
    console.error('❌ [MAIN] Error processing inpainting:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Helper function to run Python inpainting script
function runPythonInpainting(scriptPath, imagePath, maskPath, outputPath, radius = 3) {
  return new Promise((resolve) => {
    // Try different Python commands
    const pythonCommands = ['python3', 'python', 'py'];
    let currentCommandIndex = 0;
    
    function tryNextCommand() {
      if (currentCommandIndex >= pythonCommands.length) {
        resolve({
          success: false,
          error: 'No working Python interpreter found. Please install Python and ensure it\'s in PATH.'
        });
        return;
      }
      
      const pythonCmd = pythonCommands[currentCommandIndex];
      const args = [scriptPath, imagePath, maskPath, outputPath, radius.toString()];
      
      const pythonProcess = spawn(pythonCmd, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
        
          resolve({
            success: true,
            output: stdout.trim() // Trim whitespace from output
          });
        } else {
          
          // If this command failed, try the next one
          currentCommandIndex++;
          tryNextCommand();
        }
      });
      
      pythonProcess.on('error', (error) => {
        // If this command errored, try the next one
        currentCommandIndex++;
        tryNextCommand();
      });
    }
    
    tryNextCommand();
  });
}

// Handler to check if Python and required packages are available
ipcMain.handle('check-python-dependencies', async () => {
  try {
    const result = await checkPythonAndPackages();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Helper function to check Python dependencies
function checkPythonAndPackages() {
  return new Promise((resolve) => {
    const pythonCommands = ['python3', 'python', 'py'];
    let results = [];
    let completed = 0;
    
    pythonCommands.forEach((cmd) => {
      const pythonProcess = spawn(cmd, ['-c', 'import cv2, numpy; print("OK")'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        results.push({
          command: cmd,
          success: code === 0 && stdout.trim() === 'OK',
          output: stdout,
          error: stderr
        });
        
        completed++;
        if (completed === pythonCommands.length) {
          const workingResult = results.find(r => r.success);
          if (workingResult) {
            resolve({
              success: true,
              pythonCommand: workingResult.command,
              message: `Python dependencies OK (using ${workingResult.command})`
            });
          } else {
            resolve({
              success: false,
              error: 'Python or required packages (opencv-python, numpy) not found. Please install them.',
              details: results
            });
          }
        }
      });
      
      pythonProcess.on('error', (error) => {
        results.push({
          command: cmd,
          success: false,
          error: error.message
        });
        
        completed++;
        if (completed === pythonCommands.length) {
          resolve({
            success: false,
            error: 'No working Python interpreter found.',
            details: results
          });
        }
      });
    });
  });
}

// Handler para obtener información detallada de una imagen
ipcMain.handle('get-image-info', async (event, imagePath) => {
  try {
    const metadata = await sharp(imagePath).metadata();
    const stats = await fs.stat(imagePath);
    
    return {
      success: true,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: stats.size,
      channels: metadata.channels,
      density: metadata.density,
      hasAlpha: metadata.channels === 4,
      colorspace: metadata.space
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Handler para cargar imagen
ipcMain.handle('load-image', async (event, imagePath) => {
  try {
    // Verificar si el archivo existe primero
    await fs.access(path.normalize(imagePath));
    
    const imageBuffer = await fs.readFile(imagePath);
    const base64 = imageBuffer.toString('base64');
    const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.log(`⚠️ Imagen no encontrada: ${imagePath}`);
    // En lugar de lanzar error, devolver null para que el componente pueda manejarlo
    return null;
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