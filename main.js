// root main.js

const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const Papa = require('papaparse');
const sharp = require('sharp');

const { spawn } = require('child_process');
const os = require('os');

// Función para obtener la ubicación permanente del config
function getPermanentConfigPath() {
  const configDir = path.join(os.homedir(), '.gestor-productos');
  const configPath = path.join(configDir, 'config.json');
  return { configDir, configPath };
}

let mainWindow;

// Registrar protocolo personalizado para servir imágenes locales
app.whenReady().then(() => {
  protocol.registerFileProtocol('local-image', (request, callback) => {
    const url = request.url.substr(13); // Remover 'local-image://'
    const imagePath = decodeURIComponent(url);
    callback({ path: imagePath });
  });
  
  createWindow();
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false // Necesario para el protocolo personalizado
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
    // Determinar el encoding basado en el archivo
    let encoding = 'utf-8';
    
    // Para salida.csv usar latin1 (ANSI)
    if (filePath.includes('salida.csv')) {
      encoding = 'latin1';
    }
    // Para imagen-url.csv usar utf-8
    else if (filePath.includes('imagen-url.csv')) {
      encoding = 'utf-8';
    }
    
    const csvContent = await fs.readFile(filePath, encoding);
    
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

ipcMain.handle('read-config', async (event) => {
  const { configDir, configPath } = getPermanentConfigPath();
  
  // Crear directorio si no existe
  try {
    await fs.mkdir(configDir, { recursive: true });
  } catch (error) {
    console.warn('Error creating config directory:', error);
  }
  
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    let config = JSON.parse(configContent);
    
    // MIGRACIÓN AUTOMÁTICA: Convertir formato antiguo a nuevo si es necesario
    if (config.variants && config.variants.types && Array.isArray(config.variants.types)) {
      if (!config.variants.predefinedTypes) config.variants.predefinedTypes = [];
      
      // Migrar cada tipo del formato antiguo al nuevo
      config.variants.types.forEach(oldType => {
        if (oldType && oldType.name && typeof oldType.name === 'string') {
          // Verificar si ya existe en predefinedTypes
          const existsInNew = config.variants.predefinedTypes.some(pt => 
            pt && pt.name && pt.name.toLowerCase() === oldType.name.toLowerCase()
          );
          
          if (!existsInNew) {
            // Convertir valores de string a array
            let values = [];
            if (typeof oldType.values === 'string') {
              values = oldType.values.split('\n').map(v => v.trim()).filter(Boolean);
            }
            
            // Agregar al formato nuevo
            config.variants.predefinedTypes.push({
              name: oldType.name,
              values: values
            });
          }
        }
      });
      
      // Eliminar la sección types después de la migración
      delete config.variants.types;
      
      // Guardar la configuración migrada
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log('Configuration migrated from old format to new format');
    }
    
    return config;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`Config file not found at ${configPath}. Creating a new one with default values.`);
      const defaultConfig = {
        "categories": [
          "Plata > Conjunto Dijes Cadenas", "Plata > Cadenas", "Plata > Dijes", "Plata > Aros > Argollas",
          "Plata > Aros > Aros Pasantes", "Plata > Aros > Abridores", "Plata > Anillos",
          "Plata > Anillos > Alianzas", "Plata > Pulseras", "Plata > Esclavas",
          "Acero > Acero Blanco > Conjunto Dijes Cadenas", "Acero > Acero Blanco > Cadenas",
          "Acero > Acero Blanco > Dijes", "Acero > Acero Blanco > Aros > Argollas",
          "Acero > Acero Blanco > Aros > Aros Pasantes", "Acero > Acero Blanco > Aros > Abridores",
          "Acero > Acero Blanco > Aros > Cuff", "Acero > Acero Blanco > Anillos",
          "Acero > Acero Blanco > Anillos > Alianzas", "Acero > Acero Blanco > Pulseras",
          "Acero > Acero Blanco > Esclavas", "Acero > Acero Quirúrgico > Conjunto Dijes Cadenas",
          "Acero > Acero Quirúrgico > Cadenas", "Acero > Acero Quirúrgico > Dijes",
          "Acero > Acero Quirúrgico > Aros > Argollas", "Acero > Acero Quirúrgico > Aros > Aros Pasantes",
          "Acero > Acero Quirúrgico > Aros > Abridores", "Acero > Acero Quirúrgico > Aros > Cuff", "Acero > Acero Quirúrgico > Anillos",
          "Acero > Acero Quirúrgico > Anillos > Alianzas", "Acero > Acero Quirúrgico > Pulseras",
          "Acero > Acero Quirúrgico > Esclavas", "Acero > Acero Dorado > Conjunto Dijes Cadenas",
          "Acero > Acero Dorado > Cadenas", "Acero > Acero Dorado > Dijes",
          "Acero > Acero Dorado > Aros > Argollas", "Acero > Acero Dorado > Aros > Aros Pasantes",
          "Acero > Acero Dorado > Aros > Abridores", "Acero > Acero Dorado > Aros > Cuff", "Acero > Acero Dorado > Anillos",
          "Acero > Acero Dorado > Anillos > Alianzas", "Acero > Acero Dorado > Pulseras",
          "Acero > Acero Dorado > Esclavas", "Alhajero", "Strass", "Pulseras"
        ],
        "variants": {
          "colors": [
            "Amarillo", "Azul", "Beige", "Blanco", "Bordó", "Celeste", "Gris",
            "Marrón", "Naranja", "Negro", "Plata", "Rojo", "Rosa", "Verde", "Violeta",
            "Transparente", "Multicolor", "Lila", "Dorado"
          ],
          "colorMap": {
            "Amarillo": "#FFD700",
            "Azul": "#0000FF", 
            "Beige": "#F5F5DC", 
            "Blanco": "#FFFFFF", 
            "Bordó": "#800000",
            "Celeste": "#87CEEB", 
            "Fucsia": "#FF00FF", 
            "Gris": "#808080", 
            "Marrón": "#A52A2A", 
            "Naranja": "#ff7300ff",
            "Negro": "#000000", 
            "Plata": "#C0C0C0", 
            "Rojo": "#b80000ff", 
            "Rosa": "#FFC0CB", 
            "Verde": "#008000",
            "Violeta": "#EE82EE", 
            "Transparente": "#FFFFFF", 
            "Multicolor": "linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)",
            "Lila": "#DDA0DD", 
            "Dorado": "#a16900ff"
          },
          "sizes": ["XS", "S", "M", "L", "XL","40 cm", "45 cm", "50 cm", "55 cm", "60 cm", "65 cm", "70 cm"],
          "predefinedTypes": [
            {
              "name": "Material",
              "values": ["Acero blanco", "Acero dorado"]
            },
            {
              "name": "Medida Anillos",
              "values": ["10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28"]
            },
            {
              "name": "Cierre",
              "values": ["Mosquetón", "Reasa", "Broquel", "Magnético", "Tornillo", "Presión", "Gancho", "Cadena Extensora", "Sin Cierre"]
            },
            {
              "name": "Diseño",
              "values": ["Liso", "Labrado", "Colibri", "Flor", "Corazón", "Estrella", "Geométrico", "Trenzado", "Texturado", "Calado", "Dije transparente", "Dije perla", "Dije naranja", "Medalla", "Dije rosado", "Dije rojo", "Nudo de bruja", "Virgen niña", "Mariposa Perlas Rosa", "Mariposa Perlas Roja", "Mariposa Amarillo Rojo y Azul", "Mariposa Cristal Celeste", "Mariposa Violeta", "Mariposa Naranja", "Mejillón perla", "Estrella mejillón perla", "Canasta Picos", "Canasta Lisa", "Hoja hueca", "Hoja", "Trenza", "Corazón Latido", "Lineas", "Turbillon", "Bola arenada", "Colgante redondo", "Colgante cuadrado", "Gota", "Susanito grande", "Susanito chico", "Inflado"]
            }
          ]
        }
      };
      try {
        await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
        return defaultConfig;
      } catch (writeError) {
        console.error('Error creating default config file:', writeError);
        throw writeError; // Re-throw error if we can't create the file
      }
    }
    console.error('Error reading config file:', error);
    throw error;
  }
});

ipcMain.handle('savePredefinedType', async (event, newType) => {
  const { configDir, configPath } = getPermanentConfigPath();
  
  // Crear directorio si no existe
  try {
    await fs.mkdir(configDir, { recursive: true });
  } catch (error) {
    console.warn('Error creating config directory:', error);
  }
  
  try {
    let config = {};
    try {
      const configContent = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(configContent);
    } catch (error) {
      // Si el archivo no existe o hay un error de parseo, empezamos con un objeto vacío.
      if (error.code !== 'ENOENT') console.error('Error reading or parsing config for update:', error);
    }

    if (!config.variants) config.variants = {};
    if (!config.variants.predefinedTypes) config.variants.predefinedTypes = [];

    // MIGRACIÓN: Convertir tipos del formato antiguo al nuevo si existen
    if (config.variants.types && Array.isArray(config.variants.types)) {
      config.variants.types.forEach(oldType => {
        if (oldType && oldType.name && typeof oldType.name === 'string') {
          // Verificar si ya existe en predefinedTypes
          const existsInNew = config.variants.predefinedTypes.some(pt => 
            pt && pt.name && pt.name.toLowerCase() === oldType.name.toLowerCase()
          );
          
          if (!existsInNew) {
            // Convertir valores de string a array
            let values = [];
            if (typeof oldType.values === 'string') {
              values = oldType.values.split('\n').map(v => v.trim()).filter(Boolean);
            }
            
            // Agregar al formato nuevo
            config.variants.predefinedTypes.push({
              name: oldType.name,
              values: values
            });
          }
        }
      });
      
      // Eliminar la sección types después de la migración
      delete config.variants.types;
    }

    // Función auxiliar para buscar tipos por nombre (case insensitive)
    const findTypeByName = (typesArray, targetName) => {
      return typesArray.findIndex(pt => 
        (pt && typeof pt.name === 'string' && typeof targetName === 'string') ? 
          pt.name.toLowerCase() === targetName.toLowerCase() : false
      );
    };

    // Buscar si ya existe el tipo en predefinedTypes
    const existingTypeIndex = findTypeByName(config.variants.predefinedTypes, newType.name);

    if (existingTypeIndex !== -1) {
      // Actualizar tipo existente
      const existingType = config.variants.predefinedTypes[existingTypeIndex];
      const existingValues = existingType.values || [];
      const newValues = newType.values || [];
      
      // Combinar valores únicos manteniendo el orden (los nuevos al final)
      const combinedValues = [...existingValues];
      newValues.forEach(newValue => {
        if (!combinedValues.includes(newValue)) {
          combinedValues.push(newValue);
        }
      });
      
      // Actualizar el tipo existente
      config.variants.predefinedTypes[existingTypeIndex] = {
        ...existingType,
        values: combinedValues
      };
    } else {
      // Agregar nuevo tipo
      config.variants.predefinedTypes.push({
        name: newType.name,
        values: newType.values || []
      });
    }

    // Limpiar objetos vacíos o inválidos
    config.variants.predefinedTypes = config.variants.predefinedTypes.filter(type => 
      type && 
      type.name && 
      typeof type.name === 'string' && 
      type.name.trim() !== ''
    );
    
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return { success: true, config };
  } catch (error) {
    console.error('Error saving predefined type:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('saveColor', async (event, newColor, hexColor = null) => {
  const { configDir, configPath } = getPermanentConfigPath();
  
  // Crear directorio si no existe
  try {
    await fs.mkdir(configDir, { recursive: true });
  } catch (error) {
    console.warn('Error creating config directory:', error);
  }
  
  try {
    let config = {};
    try {
      const configContent = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(configContent);
    } catch (error) {
      // Si el archivo no existe o hay un error de parseo, empezamos con un objeto vacío.
      if (error.code !== 'ENOENT') console.error('Error reading or parsing config for color update:', error);
    }

    if (!config.variants) config.variants = {};
    if (!config.variants.colors) config.variants.colors = [];
    if (!config.variants.colorMap) config.variants.colorMap = {};

    // Verificar si el color ya existe (case insensitive)
    const existingColorIndex = config.variants.colors.findIndex(color => 
      typeof color === 'string' && typeof newColor === 'string' && 
      color.toLowerCase() === newColor.toLowerCase()
    );

    if (existingColorIndex === -1) {
      // Agregar el nuevo color si no existe
      config.variants.colors.push(newColor);
      
      // Agregar al colorMap con el hex proporcionado o un color por defecto
      config.variants.colorMap[newColor] = hexColor || '#CCCCCC';
      
      // Opcional: ordenar los colores alfabéticamente
      config.variants.colors.sort();
      
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log(`Color "${newColor}" with hex "${hexColor || '#CCCCCC'}" added to config`);
      return { success: true, config, message: `Color "${newColor}" agregado exitosamente` };
    } else {
      // Si el color existe pero se proporciona un nuevo hex, actualizar el colorMap
      if (hexColor) {
        config.variants.colorMap[newColor] = hexColor;
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
        console.log(`Color "${newColor}" updated with new hex "${hexColor}"`);
        return { success: true, config, message: `Color "${newColor}" actualizado con nuevo código hex` };
      }
      return { success: true, config, message: `El color "${newColor}" ya existe` };
    }
  } catch (error) {
    console.error('Error saving color:', error);
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
      const seconds = pad(now.getSeconds());
      const timestamp = `${day}-${month}-${hours}-${minutes}-${seconds}`;
      
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
    
    // Verificar si el archivo existe y si la última línea termina correctamente
    let dataToAppend = csvRows;
    try {
      const fileExists = await fs.access(csvPath).then(() => true).catch(() => false);
      if (fileExists) {
        // Leer el contenido actual para verificar si termina con salto de línea
        const existingContent = await fs.readFile(csvPath, 'latin1');
        if (existingContent.length > 0 && !existingContent.endsWith('\n')) {
          // Si no termina con salto de línea, agregamos uno antes de los nuevos datos
          dataToAppend = '\n' + csvRows;
        }
      }
    } catch (error) {
      console.warn('Warning: Could not check file ending, proceeding with normal append');
    }
    
    await fs.appendFile(csvPath, dataToAppend, 'latin1');

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
    const csvContent = await fs.readFile(resultadoPath, 'utf8');
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
      await fs.writeFile(resultadoPath, updatedLines.join('\n') + '\n', 'utf8');
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
      return { success: true };
    }

    // Read the CSV file
    const csvContent = await fs.readFile(resultadoPath, 'utf8');
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
      await fs.writeFile(resultadoPath, filteredLines.join('\n') + '\n', 'utf8');
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

    // Cleanup temporary files with retry mechanism
    try {
      await fs.unlink(tempImagePath);
      await fs.unlink(tempMaskPath);
      await fs.unlink(successfulOutputPath);
      
      // Try to remove directory, but don't fail if it's not empty
      try {
        await fs.rmdir(tempDir);
      } catch (rmdirError) {
        if (rmdirError.code !== 'ENOTEMPTY') {
          console.warn('⚠️ [MAIN] Warning: Could not remove temp directory:', rmdirError.message);
        }
        // If directory is not empty, that's okay - it will be cleaned up later
      }
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

// Nuevas funciones python:

let cachedScriptPath = null;
let cachedScriptVersion = "2.0"; // Incrementar para forzar regeneración

// Función para asegurar que el script Python existe
async function ensurePythonScript() {
  const versionMarker = `# Version: ${cachedScriptVersion}`;
  
  // Verificar si tenemos script cached y si está actualizado
  if (cachedScriptPath) {
    try {
      const existingContent = await fs.readFile(cachedScriptPath, 'utf-8');
      if (existingContent.includes(versionMarker)) {
        return cachedScriptPath; // Script está actualizado
      }
    } catch (error) {
      // Script no existe o no se puede leer, continúa para recrearlo
    }
  }
  
  // Crear directorio permanente para el script
  const scriptsDir = path.join(os.homedir(), '.gestor-productos', 'scripts');
  await fs.mkdir(scriptsDir, { recursive: true });
  
  const scriptPath = path.join(scriptsDir, 'inpaint.py');
  
  // Script Python optimizado con radio adaptativo y selección de algoritmo
  const pythonScript = `#!/usr/bin/env python3
# Version: ${cachedScriptVersion}
import sys
import cv2
import numpy as np
import os

def calculate_optimal_radius(mask):
    """
    Calcula el radio óptimo basado en el área de la máscara
    """
    try:
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return 3
        
        # Calcular área total de todos los contornos
        total_area = sum(cv2.contourArea(contour) for contour in contours)
        
        if total_area == 0:
            return 3
        
        # Radio proporcional al área (ajustado para mejores resultados)
        # Fórmula: radio = max(3, min(50, sqrt(area) * factor))
        radius = max(3, min(50, int(np.sqrt(total_area) * 0.15)))
        
        print(f"DEBUG: Área total máscara: {total_area}, Radio calculado: {radius}", file=sys.stderr)
        return radius
        
    except Exception as e:
        print(f"WARNING: Error calculando radio óptimo: {e}, usando radio por defecto", file=sys.stderr)
        return 3

def select_inpaint_algorithm(mask):
    """
    Selecciona el algoritmo de inpainting basado en las características de la máscara
    """
    try:
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return cv2.INPAINT_TELEA
        
        total_area = sum(cv2.contourArea(contour) for contour in contours)
        
        # Calcular factor de forma promedio (perímetro^2 / área)
        # Valores altos indican formas más complejas/irregulares
        total_perimeter = sum(cv2.arcLength(contour, True) for contour in contours)
        
        if total_area > 0:
            shape_factor = (total_perimeter ** 2) / total_area
        else:
            shape_factor = 0
        
        # Criterios de selección:
        # - Áreas grandes (>8000 píxeles): NAVIER_STOKES es mejor para regiones suaves
        # - Formas muy irregulares (shape_factor > 50): TELEA es mejor para detalles
        # - Por defecto: TELEA para texturas y detalles finos
        
        if total_area > 8000 and shape_factor <= 50:
            algorithm = cv2.INPAINT_NS
            algorithm_name = "NAVIER_STOKES"
        else:
            algorithm = cv2.INPAINT_TELEA
            algorithm_name = "TELEA"
        
        print(f"DEBUG: Área: {total_area}, Factor forma: {shape_factor:.2f}, Algoritmo: {algorithm_name}", file=sys.stderr)
        return algorithm
        
    except Exception as e:
        print(f"WARNING: Error seleccionando algoritmo: {e}, usando TELEA por defecto", file=sys.stderr)
        return cv2.INPAINT_TELEA

def main():
    if len(sys.argv) != 5:
        print(f"ERROR: Uso incorrecto. Recibidos {len(sys.argv)} argumentos, esperados 5", file=sys.stderr)
        print(f"Argumentos recibidos: {sys.argv}", file=sys.stderr)
        sys.exit(1)
    
    image_path = sys.argv[1]
    mask_path = sys.argv[2]
    output_path = sys.argv[3]
    base_radius = int(sys.argv[4])  # Ahora se usa como referencia, no como valor fijo
    
    # Debug info
    print(f"DEBUG: image_path='{image_path}'", file=sys.stderr)
    print(f"DEBUG: mask_path='{mask_path}'", file=sys.stderr)
    print(f"DEBUG: output_path='{output_path}'", file=sys.stderr)
    print(f"DEBUG: base_radius={base_radius}", file=sys.stderr)
    
    try:
        if not os.path.exists(image_path):
            print(f"ERROR: Imagen no encontrada en: '{image_path}'", file=sys.stderr)
            print(f"ERROR: Directorio existe: {os.path.exists(os.path.dirname(image_path))}", file=sys.stderr)
            sys.exit(1)
            
        if not os.path.exists(mask_path):
            print(f"ERROR: Máscara no encontrada en: '{mask_path}'", file=sys.stderr)
            print(f"ERROR: Directorio existe: {os.path.exists(os.path.dirname(mask_path))}", file=sys.stderr)
            sys.exit(1)
        
        image = cv2.imread(image_path)
        mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
        
        if image is None:
            print(f"ERROR: No se pudo cargar la imagen desde '{image_path}'", file=sys.stderr)
            sys.exit(1)
            
        if mask is None:
            print(f"ERROR: No se pudo cargar la máscara desde '{mask_path}'", file=sys.stderr)
            sys.exit(1)
        
        if mask.shape[:2] != image.shape[:2]:
            mask = cv2.resize(mask, (image.shape[1], image.shape[0]))
        
        _, mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)
        
        # Calcular radio óptimo basado en la máscara
        optimal_radius = calculate_optimal_radius(mask)
        
        # Si el radio base es muy diferente del óptimo, usar una combinación
        # Esto permite cierto control manual pero con optimización automática
        if abs(optimal_radius - base_radius) > 10:
            # Usar el radio óptimo si la diferencia es significativa
            final_radius = optimal_radius
        else:
            # Usar promedio ponderado favoreciendo el radio óptimo
            final_radius = int(optimal_radius * 0.7 + base_radius * 0.3)
        
        # Seleccionar algoritmo óptimo
        algorithm = select_inpaint_algorithm(mask)
        
        print(f"DEBUG: Radio final: {final_radius}", file=sys.stderr)
        
        # Aplicar inpainting con parámetros optimizados
        result = cv2.inpaint(image, mask, final_radius, algorithm)
        
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
        
        success = cv2.imwrite(output_path, result, [cv2.IMWRITE_JPEG_QUALITY, 98])
        
        if success:
            print(output_path)
        else:
            print(f"ERROR: No se pudo guardar en: '{output_path}'", file=sys.stderr)
            sys.exit(1)
            
    except Exception as e:
        print(f"ERROR: Excepción durante procesamiento: {str(e)}", file=sys.stderr)
        import traceback
        print(f"TRACEBACK: {traceback.format_exc()}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
`;
  
  // Escribir script solo si no existe o necesita actualización
  try {
    await fs.writeFile(scriptPath, pythonScript, 'utf-8');
    cachedScriptPath = scriptPath;
    console.log(`🐍 [MAIN] Script Python actualizado en: ${scriptPath}`);
    return scriptPath;
  } catch (error) {
    console.error('❌ Error creando script Python:', error);
    throw error;
  }
}

async function runPythonInpainting(scriptPath, imagePath, maskPath, outputPath, radius = 3) {
  return new Promise(async (resolve) => {
    try {
      // Asegurar que el script Python existe
      const actualScriptPath = await ensurePythonScript();
      
      // Normalizar rutas
      const normalizedImagePath = path.normalize(imagePath);
      const normalizedMaskPath = path.normalize(maskPath);
      const normalizedOutputPath = path.normalize(outputPath);
      const normalizedScriptPath = path.normalize(actualScriptPath);
      
      // En Windows, usar array de argumentos maneja automáticamente las rutas con espacios
      const args = [
        '-3', 
        normalizedScriptPath, 
        normalizedImagePath, 
        normalizedMaskPath, 
        normalizedOutputPath, 
        radius.toString()
      ];
      
      console.log(`🐍 [MAIN] Ejecutando Python con argumentos:`, args);
      console.log(`🐍 [MAIN] Script path: "${normalizedScriptPath}"`);
      console.log(`🐍 [MAIN] Working directory: "${process.cwd()}"`);
      console.log(`🐍 [MAIN] Home directory: "${os.homedir()}"`);
      
      const pythonProcess = spawn('py', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false, // Cambiar a false para mejor manejo de argumentos con espacios
        windowsHide: true,
        env: { ...process.env } // Asegurar que se mantengan las variables de entorno
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
        if (stderr) console.log(`❌ STDERR: ${stderr}`);
        
        if (code === 0) {
          resolve({
            success: true,
            output: stdout.trim()
          });
        } else {
          resolve({
            success: false,
            error: `Python inpainting falló. Código: ${code}\nError: ${stderr}`
          });
        }
      });
      
      pythonProcess.on('error', (error) => {
        console.log(`❌ Error spawn:`, error.message);
        resolve({
          success: false,
          error: `No se pudo ejecutar Python. Error: ${error.message}`
        });
      });
      
    } catch (setupError) {
      console.error('❌ Error preparando script:', setupError);
      resolve({
        success: false,
        error: `Error preparando inpainting: ${setupError.message}`
      });
    }
  });
}

// 2. REEMPLAZA la función checkPythonAndPackages existente (línea ~410 aprox) con esta:
function checkPythonAndPackages() {
  return new Promise((resolve) => {
    const pythonProcess = spawn('py', ['-3', '-c', 'import cv2, numpy; print("OK")'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
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
      if (code === 0 && stdout.trim() === 'OK') {
        resolve({
          success: true,
          message: '✅ Python 3.13 y dependencias OK',
          pythonCommand: 'py -3'
        });
      } else {
        let errorMsg = '❌ Problema con Python o dependencias.\n\n';
        
        if (stderr.includes('No Python at')) {
          errorMsg += 'Python 3.13 no encontrado. Instala desde python.org\n';
        } else if (stderr.includes('No module named')) {
          errorMsg += 'Dependencias faltantes. Ejecuta:\npy -3 -m pip install opencv-python numpy\n';
        } else {
          errorMsg += `Error: ${stderr}\n`;
        }
        
        resolve({
          success: false,
          error: errorMsg
        });
      }
    });
    
    pythonProcess.on('error', (error) => {
      resolve({
        success: false,
        error: 'Python Launcher no encontrado. Reinstala Python 3.13 y marca "Add Python to PATH"'
      });
    });
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

// ===== UTILITY FUNCTIONS =====

// Función utilitaria para validar que una fila CSV tiene contenido
function rowHasContent(row) {
  return Object.values(row).some(value => value && value.toString().trim() !== '');
}

// ===== HANDLERS PARA GESTIÓN DE PRODUCTOS =====

// Handler para leer y procesar productos desde salida.csv específico del proyecto
ipcMain.handle('read-products-from-csv', async (event, directoryPath) => {
  try {
    const csvPath = path.join(directoryPath, 'salida.csv');
    const exists = await fs.access(csvPath).then(() => true).catch(() => false);
    
    if (!exists) {
      return { success: true, products: [] };
    }

    // Leer CSV con encoding latin1 (ANSI)
    const csvContent = await fs.readFile(csvPath, 'latin1');
    
    return new Promise((resolve) => {
      Papa.parse(csvContent, {
        header: true,
        delimiter: ';',
        skipEmptyLines: true,
        complete: (results) => {
          try {
            // Cargar mapeo de imágenes desde imagen-url.csv
            const loadImageMapping = async () => {
              const imagenUrlCsvPath = path.join(directoryPath, 'imagen-url.csv');
              const imagenUrlExists = await fs.access(imagenUrlCsvPath).then(() => true).catch(() => false);
              
              let imageMapping = new Map();
              if (imagenUrlExists) {
                try {
                  const imageUrlContent = await fs.readFile(imagenUrlCsvPath, 'utf-8');
                  const imageUrlResults = Papa.parse(imageUrlContent, {
                    header: true,
                    delimiter: ';',
                    skipEmptyLines: true
                  });
                  
                  imageUrlResults.data.forEach(row => {
                    const url = row.url || '';
                    const imagenes = row.imagenes || '';
                    if (url && imagenes) {
                      const imageList = imagenes.split(',').map(img => img.trim()).filter(img => img);
                      imageMapping.set(url, imageList);
                    }
                  });
                } catch (error) {
                  console.warn('Error reading imagen-url.csv:', error);
                }
              }
              return imageMapping;
            };

            loadImageMapping().then(imageMapping => {
              // Procesar datos CSV para extraer productos únicos
              const productMap = new Map();
              
              results.data.forEach(row => {
                const urlId = row['Identificador de URL'] || '';
                const name = row['Nombre'] || '';
                const categories = row['Categorías'] || '';
                const price = row['Precio'] || '';
                const stock = row['Stock'] || '';
                
                if (urlId && name) {
                  if (!productMap.has(urlId)) {
                    // Obtener imágenes del mapeo
                    const productImages = imageMapping.get(urlId) || [];
                    
                    productMap.set(urlId, {
                      id: urlId,
                      name: name,
                      categories: categories,
                      price: price,
                      stock: stock,
                      variants: [],
                      images: productImages,
                      csvLineIndex: results.data.indexOf(row)
                    });
                  }
                  
                  // Agregar variante si tiene propiedades específicas
                  const variant = {
                    price: price,
                    stock: stock,
                    properties: [],
                    csvLineIndex: results.data.indexOf(row)
                  };
                  
                  // Extraer propiedades de variante (1-3)
                  for (let i = 1; i <= 3; i++) {
                    const propName = row[`Nombre de propiedad ${i}`] || '';
                    const propValue = row[`Valor de propiedad ${i}`] || '';
                    if (propName && propValue) {
                      variant.properties.push({ name: propName, value: propValue });
                    }
                  }
                  
                  productMap.get(urlId).variants.push(variant);
                }
              });
              
              const products = Array.from(productMap.values());
              resolve({ success: true, products });
            });
          } catch (error) {
            console.error('Error processing CSV data:', error);
            resolve({ success: false, error: error.message });
          }
        },
        error: (error) => {
          console.error('Error parsing CSV:', error);
          resolve({ success: false, error: error.message });
        }
      });
    });
  } catch (error) {
    console.error('Error reading products from CSV:', error);
    return { success: false, error: error.message };
  }
});

// Handler para actualizar producto en salida.csv específico del proyecto
ipcMain.handle('update-product-in-csv', async (event, directoryPath, productId, updatedData) => {
  try {
    console.log('=== UPDATE PRODUCT IN CSV ===');
    console.log('Product ID:', productId);
    console.log('Updated Data:', JSON.stringify(updatedData, null, 2));
    
    const csvPath = path.join(directoryPath, 'salida.csv');
    const backupPath = path.join(directoryPath, 'salida_backup.csv');
    
    // Crear backup
    await fs.copyFile(csvPath, backupPath);
    
    // Leer CSV con encoding latin1 (ANSI)
    const csvContent = await fs.readFile(csvPath, 'latin1');
    
    return new Promise((resolve) => {
      Papa.parse(csvContent, {
        header: true,
        delimiter: ';',
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            console.log('CSV Headers:', results.meta.fields);
            let variantIndex = 0;
            
            // Filtrar filas vacías antes de procesar
            const filteredData = results.data.filter(rowHasContent);
            console.log('Total rows to process:', filteredData.length);
            
            // Actualizar las filas que corresponden al producto
            const processedData = filteredData.map((row, rowIndex) => {
              const urlId = row['Identificador de URL'] || '';
              
              if (urlId === productId) {
                console.log(`Row ${rowIndex} matches product ${productId}`);
                console.log('Processing row for product:', productId);
                console.log('Row data:', Object.keys(row));
                console.log('Variant index:', variantIndex);
                
                // Actualizar la fila principal (que tiene nombre)
                if (row['Nombre'] && row['Nombre'].trim()) {
                  const updatedRow = {
                    ...row,
                    'Nombre': updatedData.name || row['Nombre'],
                    'Categorías': updatedData.categories || row['Categorías']
                  };
                  
                  // Actualizar precio y stock de la variante correspondiente si existe
                  if (updatedData.variants && updatedData.variants[variantIndex]) {
                    const variant = updatedData.variants[variantIndex];
                    console.log('Updating main row variant:', variantIndex, variant);
                    updatedRow['Precio'] = variant.price || row['Precio'];
                    updatedRow['Stock'] = variant.stock || row['Stock'];
                    
                    // Actualizar propiedades de la variante (hasta 3 propiedades)
                    for (let i = 1; i <= 3; i++) {
                      const propNameKey = `Nombre de propiedad ${i}`;
                      const propValueKey = `Valor de propiedad ${i}`;
                      
                      if (variant.properties && variant.properties[i-1]) {
                        console.log(`Setting property ${i}:`, variant.properties[i-1]);
                        updatedRow[propNameKey] = variant.properties[i-1].name || '';
                        updatedRow[propValueKey] = variant.properties[i-1].value || '';
                      } else {
                        updatedRow[propNameKey] = '';
                        updatedRow[propValueKey] = '';
                      }
                    }
                  }
                  
                  variantIndex++;
                  return updatedRow;
                } else {
                  // Para filas de variantes (sin nombre), actualizar precio y stock
                  const updatedRow = { ...row };
                  
                  if (updatedData.variants && updatedData.variants[variantIndex]) {
                    const variant = updatedData.variants[variantIndex];
                    updatedRow['Precio'] = variant.price || row['Precio'];
                    updatedRow['Stock'] = variant.stock || row['Stock'];
                    
                    // Actualizar propiedades de la variante (hasta 3 propiedades)
                    for (let i = 1; i <= 3; i++) {
                      const propNameKey = `Nombre de propiedad ${i}`;
                      const propValueKey = `Valor de propiedad ${i}`;
                      
                      if (variant.properties && variant.properties[i-1]) {
                        updatedRow[propNameKey] = variant.properties[i-1].name || '';
                        updatedRow[propValueKey] = variant.properties[i-1].value || '';
                      } else {
                        updatedRow[propNameKey] = '';
                        updatedRow[propValueKey] = '';
                      }
                    }
                  }
                  
                  variantIndex++;
                  return updatedRow;
                }
              }
              return row;
            });

            // Convertir de vuelta a CSV
            const newCsvContent = Papa.unparse(processedData, {
              delimiter: ';',
              header: true,
              skipEmptyLines: true
            });

            // Limpiar el contenido del CSV para evitar líneas vacías
            const cleanedContent = newCsvContent
              .split('\n')
              .filter(line => line.trim() !== '' && !line.match(/^;*$/))
              .join('\n');

            // Guardar con encoding latin1 (ANSI)
            await fs.writeFile(csvPath, cleanedContent, 'latin1');
            resolve({ success: true });
          } catch (error) {
            console.error('Error updating CSV:', error);
            resolve({ success: false, error: error.message });
          }
        },
        error: (error) => {
          console.error('Error parsing CSV for update:', error);
          resolve({ success: false, error: error.message });
        }
      });
    });
  } catch (error) {
    console.error('Error updating product in CSV:', error);
    return { success: false, error: error.message };
  }
});

// Handler para eliminar producto específico del proyecto (mover a carpeta eliminados)
ipcMain.handle('delete-product', async (event, directoryPath, productId) => {
  try {
    const csvPath = path.join(directoryPath, 'salida.csv');
    const deletedDir = path.join(directoryPath, 'eliminados');
    const deletedCsvPath = path.join(deletedDir, 'salida.csv');
    const deletedImagesDir = path.join(deletedDir, 'procesadas');
    
    // Crear directorios eliminados si no existen
    await fs.mkdir(deletedDir, { recursive: true });
    await fs.mkdir(deletedImagesDir, { recursive: true });
    
    // Leer CSV original con encoding latin1 (ANSI)
    const csvContent = await fs.readFile(csvPath, 'latin1');
    
    return new Promise(async (resolve) => {
      Papa.parse(csvContent, {
        header: true,
        delimiter: ';',
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const allRows = results.data;
            const remainingRows = [];
            const deletedRows = [];
            
            // Separar filas del producto a eliminar
            allRows.forEach(row => {
              const urlId = row['Identificador de URL'] || '';
              if (urlId === productId) {
                deletedRows.push(row);
              } else {
                // Solo agregar filas que no estén completamente vacías
                if (rowHasContent(row)) {
                  remainingRows.push(row);
                }
              }
            });
            
            if (deletedRows.length === 0) {
              resolve({ success: false, error: 'Product not found' });
              return;
            }
            
            // Guardar CSV actualizado (sin el producto eliminado)
            const remainingCsvContent = Papa.unparse(remainingRows, {
              delimiter: ';',
              header: true,
              skipEmptyLines: true
            });
            
            // Limpiar el contenido del CSV para evitar líneas vacías al final
            const cleanedContent = remainingCsvContent
              .split('\n')
              .filter(line => line.trim() !== '' && !line.match(/^;*$/))
              .join('\n');
            
            await fs.writeFile(csvPath, cleanedContent, 'latin1');
            
            // Crear o actualizar CSV de eliminados
            let deletedCsvContent = '';
            const deletedExists = await fs.access(deletedCsvPath).then(() => true).catch(() => false);
            
            if (deletedExists) {
              const existingDeletedContent = await fs.readFile(deletedCsvPath, 'latin1');
              const existingDeletedResults = Papa.parse(existingDeletedContent, {
                header: true,
                delimiter: ';',
                skipEmptyLines: false
              });
              
              const combinedDeletedRows = [...existingDeletedResults.data, ...deletedRows];
              deletedCsvContent = Papa.unparse(combinedDeletedRows, {
                delimiter: ';',
                header: true,
                skipEmptyLines: false
              });
            } else {
              deletedCsvContent = Papa.unparse(deletedRows, {
                delimiter: ';',
                header: true,
                skipEmptyLines: false
              });
            }
            
            await fs.writeFile(deletedCsvPath, deletedCsvContent, 'latin1');
            
            // Mover imágenes del producto a carpeta eliminados
            let movedImages = 0;
            try {
              // Leer mapeo de imágenes desde imagen-url.csv
              const imagenUrlCsvPath = path.join(directoryPath, 'imagen-url.csv');
              const imagenUrlExists = await fs.access(imagenUrlCsvPath).then(() => true).catch(() => false);
              
              if (imagenUrlExists) {
                const imageUrlContent = await fs.readFile(imagenUrlCsvPath, 'utf-8');
                const imageUrlResults = Papa.parse(imageUrlContent, {
                  header: true,
                  delimiter: ';',
                  skipEmptyLines: true
                });
                
                const productImageMapping = imageUrlResults.data.find(row => row.url === productId);
                if (productImageMapping && productImageMapping.imagenes) {
                  const imageList = productImageMapping.imagenes.split(',').map(img => img.trim()).filter(img => img);
                  
                  const procesadasDir = path.join(directoryPath, 'procesadas');
                  
                  for (const imageName of imageList) {
                    const sourcePath = path.join(procesadasDir, imageName);
                    const destPath = path.join(deletedImagesDir, imageName);
                    
                    try {
                      await fs.access(sourcePath);
                      await fs.rename(sourcePath, destPath);
                      movedImages++;
                    } catch (error) {
                      console.warn(`Could not move image ${imageName}:`, error.message);
                    }
                  }
                  
                  // Actualizar imagen-url.csv para remover el producto eliminado
                  const updatedImageUrlData = imageUrlResults.data.filter(row => row.url !== productId);
                  const updatedImageUrlContent = Papa.unparse(updatedImageUrlData, {
                    delimiter: ';',
                    header: true
                  });
                  await fs.writeFile(imagenUrlCsvPath, updatedImageUrlContent, 'utf-8');
                  
                  // Crear entrada en imagen-url.csv de eliminados si es necesario
                  const deletedImageUrlCsvPath = path.join(deletedDir, 'imagen-url.csv');
                  const deletedImageUrlExists = await fs.access(deletedImageUrlCsvPath).then(() => true).catch(() => false);
                  
                  if (deletedImageUrlExists) {
                    const existingDeletedImageUrlContent = await fs.readFile(deletedImageUrlCsvPath, 'utf-8');
                    const existingDeletedImageUrlResults = Papa.parse(existingDeletedImageUrlContent, {
                      header: true,
                      delimiter: ';',
                      skipEmptyLines: true
                    });
                    
                    const combinedImageUrlData = [...existingDeletedImageUrlResults.data, productImageMapping];
                    const combinedImageUrlContent = Papa.unparse(combinedImageUrlData, {
                      delimiter: ';',
                      header: true
                    });
                    await fs.writeFile(deletedImageUrlCsvPath, combinedImageUrlContent, 'utf-8');
                  } else {
                    const newDeletedImageUrlContent = Papa.unparse([productImageMapping], {
                      delimiter: ';',
                      header: true
                    });
                    await fs.writeFile(deletedImageUrlCsvPath, newDeletedImageUrlContent, 'utf-8');
                  }
                }
              }
            } catch (error) {
              console.warn('Error moving images:', error);
            }
            
            resolve({ 
              success: true, 
              deletedImages: movedImages,
              deletedVariants: deletedRows.length
            });
          } catch (error) {
            console.error('Error processing deletion:', error);
            resolve({ success: false, error: error.message });
          }
        },
        error: (error) => {
          console.error('Error parsing CSV for deletion:', error);
          resolve({ success: false, error: error.message });
        }
      });
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    return { success: false, error: error.message };
  }
});

// Handler para leer productos eliminados específico del proyecto
ipcMain.handle('read-deleted-products', async (event, directoryPath) => {
  try {
    const deletedDir = path.join(directoryPath, 'eliminados');
    const deletedCsvPath = path.join(deletedDir, 'salida.csv');
    
    const exists = await fs.access(deletedCsvPath).then(() => true).catch(() => false);
    
    if (!exists) {
      return { success: true, products: [] };
    }

    // Leer CSV con encoding latin1 (ANSI)
    const csvContent = await fs.readFile(deletedCsvPath, 'latin1');
    
    return new Promise((resolve) => {
      Papa.parse(csvContent, {
        header: true,
        delimiter: ';',
        skipEmptyLines: true,
        complete: (results) => {
          try {
            // Procesar productos eliminados
            const productMap = new Map();
            
            results.data.forEach(row => {
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
            
            resolve({ success: true, products: Array.from(productMap.values()) });
          } catch (error) {
            console.error('Error processing deleted products:', error);
            resolve({ success: false, error: error.message });
          }
        },
        error: (error) => {
          console.error('Error parsing deleted CSV:', error);
          resolve({ success: false, error: error.message });
        }
      });
    });
  } catch (error) {
    console.error('Error reading deleted products:', error);
    return { success: false, error: error.message };
  }
});

// Handler para restaurar producto eliminado específico del proyecto
ipcMain.handle('restore-product', async (event, directoryPath, productId) => {
  try {
    const csvPath = path.join(directoryPath, 'salida.csv');
    const deletedDir = path.join(directoryPath, 'eliminados');
    const deletedCsvPath = path.join(deletedDir, 'salida.csv');
    const deletedImagesDir = path.join(deletedDir, 'procesadas');
    
    // Leer CSV de eliminados con encoding latin1 (ANSI)
    const deletedCsvContent = await fs.readFile(deletedCsvPath, 'latin1');
    
    return new Promise(async (resolve) => {
      Papa.parse(deletedCsvContent, {
        header: true,
        delimiter: ';',
        skipEmptyLines: false,
        complete: async (deletedResults) => {
          try {
            const allDeletedRows = deletedResults.data;
            const remainingDeletedRows = [];
            const restoredRows = [];
            
            // Separar filas del producto a restaurar
            allDeletedRows.forEach(row => {
              const urlId = row['Identificador de URL'] || '';
              if (urlId === productId) {
                restoredRows.push(row);
              } else {
                remainingDeletedRows.push(row);
              }
            });
            
            if (restoredRows.length === 0) {
              resolve({ success: false, error: 'Product not found in deleted items' });
              return;
            }
            
            // Actualizar CSV de eliminados
            const updatedDeletedCsvContent = Papa.unparse(remainingDeletedRows, {
              delimiter: ';',
              header: true,
              skipEmptyLines: false
            });
            await fs.writeFile(deletedCsvPath, updatedDeletedCsvContent, 'latin1');
            
            // Restaurar en CSV principal
            const mainExists = await fs.access(csvPath).then(() => true).catch(() => false);
            let mainCsvContent = '';
            
            if (mainExists) {
              const existingMainContent = await fs.readFile(csvPath, 'latin1');
              const existingMainResults = Papa.parse(existingMainContent, {
                header: true,
                delimiter: ';',
                skipEmptyLines: false
              });
              
              const combinedMainRows = [...existingMainResults.data, ...restoredRows];
              mainCsvContent = Papa.unparse(combinedMainRows, {
                delimiter: ';',
                header: true,
                skipEmptyLines: false
              });
            } else {
              mainCsvContent = Papa.unparse(restoredRows, {
                delimiter: ';',
                header: true,
                skipEmptyLines: false
              });
            }
            
            await fs.writeFile(csvPath, mainCsvContent, 'latin1');
            
            // Restaurar imágenes
            let restoredImages = 0;
            try {
              // Restaurar mapeo de imágenes desde imagen-url.csv eliminado
              const deletedImageUrlCsvPath = path.join(deletedDir, 'imagen-url.csv');
              const deletedImageUrlExists = await fs.access(deletedImageUrlCsvPath).then(() => true).catch(() => false);
              
              if (deletedImageUrlExists) {
                const deletedImageUrlContent = await fs.readFile(deletedImageUrlCsvPath, 'utf-8');
                const deletedImageUrlResults = Papa.parse(deletedImageUrlContent, {
                  header: true,
                  delimiter: ';',
                  skipEmptyLines: true
                });
                
                const productImageMapping = deletedImageUrlResults.data.find(row => row.url === productId);
                if (productImageMapping && productImageMapping.imagenes) {
                  const imageList = productImageMapping.imagenes.split(',').map(img => img.trim()).filter(img => img);
                  
                  const procesadasDir = path.join(directoryPath, 'procesadas');
                  await fs.mkdir(procesadasDir, { recursive: true });
                  
                  for (const imageName of imageList) {
                    const sourcePath = path.join(deletedImagesDir, imageName);
                    const destPath = path.join(procesadasDir, imageName);
                    
                    try {
                      await fs.access(sourcePath);
                      await fs.rename(sourcePath, destPath);
                      restoredImages++;
                    } catch (error) {
                      console.warn(`Could not restore image ${imageName}:`, error.message);
                    }
                  }
                  
                  // Restaurar entrada en imagen-url.csv principal
                  const imagenUrlCsvPath = path.join(directoryPath, 'imagen-url.csv');
                  const imagenUrlExists = await fs.access(imagenUrlCsvPath).then(() => true).catch(() => false);
                  
                  if (imagenUrlExists) {
                    const existingImageUrlContent = await fs.readFile(imagenUrlCsvPath, 'utf-8');
                    const existingImageUrlResults = Papa.parse(existingImageUrlContent, {
                      header: true,
                      delimiter: ';',
                      skipEmptyLines: true
                    });
                    
                    const combinedImageUrlData = [...existingImageUrlResults.data, productImageMapping];
                    const combinedImageUrlContent = Papa.unparse(combinedImageUrlData, {
                      delimiter: ';',
                      header: true
                    });
                    await fs.writeFile(imagenUrlCsvPath, combinedImageUrlContent, 'utf-8');
                  } else {
                    const newImageUrlContent = Papa.unparse([productImageMapping], {
                      delimiter: ';',
                      header: true
                    });
                    await fs.writeFile(imagenUrlCsvPath, newImageUrlContent, 'utf-8');
                  }
                  
                  // Remover entrada del imagen-url.csv eliminado
                  const updatedDeletedImageUrlData = deletedImageUrlResults.data.filter(row => row.url !== productId);
                  const updatedDeletedImageUrlContent = Papa.unparse(updatedDeletedImageUrlData, {
                    delimiter: ';',
                    header: true
                  });
                  await fs.writeFile(deletedImageUrlCsvPath, updatedDeletedImageUrlContent, 'utf-8');
                }
              }
            } catch (error) {
              console.warn('Error restoring images:', error);
            }
            
            resolve({ 
              success: true, 
              restoredImages,
              restoredVariants: restoredRows.length
            });
          } catch (error) {
            console.error('Error processing restoration:', error);
            resolve({ success: false, error: error.message });
          }
        },
        error: (error) => {
          console.error('Error parsing deleted CSV for restoration:', error);
          resolve({ success: false, error: error.message });
        }
      });
    });
  } catch (error) {
    console.error('Error restoring product:', error);
    return { success: false, error: error.message };
  }
});

// Handler para eliminar imagen permanentemente del proyecto
ipcMain.handle('delete-image-permanently', async (event, imagePath) => {
  try {
    await fs.unlink(path.normalize(imagePath));
    return { success: true };
  } catch (error) {
    console.error('Error deleting image permanently:', error);
    return { success: false, error: error.message };
  }
});

// Handler para actualizar imagen-url.csv
ipcMain.handle('update-image-url-csv', async (event, directoryPath, productId, imageName, action) => {
  try {
    const imagenUrlCsvPath = path.join(directoryPath, 'imagen-url.csv');
    const exists = await fs.access(imagenUrlCsvPath).then(() => true).catch(() => false);
    
    if (!exists) {
      return { success: false, error: 'imagen-url.csv not found' };
    }

    const imageUrlContent = await fs.readFile(imagenUrlCsvPath, 'utf-8');
    
    return new Promise((resolve) => {
      Papa.parse(imageUrlContent, {
        header: true,
        delimiter: ';',
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            // Actualizar datos
            const updatedData = results.data.map(row => {
              if (row.url === productId) {
                let imageList = row.imagenes ? row.imagenes.split(',').map(img => img.trim()) : [];
                
                if (action === 'remove') {
                  imageList = imageList.filter(img => img !== imageName);
                } else if (action === 'add') {
                  if (!imageList.includes(imageName)) {
                    imageList.push(imageName);
                  }
                }
                
                return {
                  ...row,
                  imagenes: imageList.join(',')
                };
              }
              return row;
            });

            // Guardar archivo actualizado
            const updatedContent = Papa.unparse(updatedData, {
              delimiter: ';',
              header: true
            });
            
            await fs.writeFile(imagenUrlCsvPath, updatedContent, 'utf-8');
            resolve({ success: true });
          } catch (error) {
            console.error('Error updating imagen-url.csv:', error);
            resolve({ success: false, error: error.message });
          }
        },
        error: (error) => {
          console.error('Error parsing imagen-url.csv:', error);
          resolve({ success: false, error: error.message });
        }
      });
    });
  } catch (error) {
    console.error('Error updating imagen-url.csv:', error);
    return { success: false, error: error.message };
  }
});



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