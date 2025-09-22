// hooks/useProductFormManager.js
import { useState, useEffect, useMemo } from 'react';

/**
 * Construye una estructura de árbol a partir de una lista plana de categorías.
 * @param {string[]} categories - Array de strings de categorías (ej: "Ropa > Camisetas").
 * @returns {object} - Un objeto que representa la estructura del árbol.
 */
const buildCategoryTree = (categories) => {
  const tree = {};

  categories.forEach(fullPath => {
    const parts = fullPath.split(' > ');
    let currentNode = tree;

    parts.forEach((part, index) => {
      if (!currentNode[part]) {
        currentNode[part] = {
          _children: {},
          _fullPath: parts.slice(0, index + 1).join(' > '),
        };
      }
      currentNode = currentNode[part]._children;
    });
  });

  return tree;
};

export const useProductFormManager = () => {
  // Estados del formulario básico
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productStock, setProductStock] = useState('10');
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [originalCategories, setOriginalCategories] = useState(''); // Categorías originales del CSV

  // Estados de variantes
  const [useColor, setUseColor] = useState(false);
  const [useSize, setUseSize] = useState(false);
  const [useType, setUseType] = useState(false);
  const [selectedColors, setSelectedColors] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [typeName, setTypeName] = useState('');
  const [typeValues, setTypeValues] = useState('');
  const [variantCombinations, setVariantCombinations] = useState([]);

  // Estados para la configuración externa
  const [categories, setCategories] = useState([]);
  const [predefinedColors, setPredefinedColors] = useState([]);
  const [predefinedSizes, setPredefinedSizes] = useState([]);
  const [predefinedTypes, setPredefinedTypes] = useState([]);
  const [defaultTypeName, setDefaultTypeName] = useState('');
  const [defaultTypeValues, setDefaultTypeValues] = useState('');

  // Generar el árbol de categorías usando useMemo para eficiencia
  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  // Cargar configuración desde el hook principal
  const loadConfig = (config) => {
    if (config) {
      setCategories(config.categories || []);
      if (config.variants) {
        setPredefinedColors(config.variants.colors || []);
        setPredefinedSizes(config.variants.sizes || []);
        
        // Unifica 'types' (antiguo) y 'predefinedTypes' (nuevo) para máxima compatibilidad.
        const oldTypes = config.variants.types || [];
        const newTypes = config.variants.predefinedTypes || [];
        
        // Combina ambas listas, evitando duplicados por nombre.
        const combined = [...oldTypes, ...newTypes];
        const uniqueTypes = Array.from(new Map(
          combined
            .filter(item => item && item.name) // <-- AÑADIDO: Filtra objetos inválidos o sin nombre.
            .map(item => [item.name.toLowerCase(), item])).values());

        const rawTypes = uniqueTypes;
        const normalizedTypes = rawTypes.map(type => {
          if (typeof type.values === 'string') {
            // Si 'values' es un string, lo convertimos en un array.
            return { ...type, values: type.values.split('\n').map(v => v.trim()).filter(Boolean) };
          }
          return type; // Si ya es un array, lo dejamos como está.
        });
        setPredefinedTypes(normalizedTypes);
        if (config.variants.defaultType) {
          const { name, values } = config.variants.defaultType;
          setDefaultTypeName(name || 'Tipo');
          setDefaultTypeValues(values || 'Modelo A\nModelo B\nModelo C');
          // Inicializar los estados de tipo con los valores por defecto
          setTypeName(name || 'Tipo');
          setTypeValues(values || 'Modelo A\nModelo B\nModelo C');
        }
      }
    }
  };

  // Resetear los valores de tipo a los por defecto de la configuración
  const resetTypeToDefaults = () => {
    setTypeName(defaultTypeName);
    setTypeValues(defaultTypeValues);
  };


  // Cargar datos del producto desde CSV
  const loadProductData = (filename, data) => {
    const row = data.find(r => r.archivo === filename);

    setSelectedCategories(new Set());

    if (row) {

      setProductName(row.descripcion || '');
      setProductPrice(row.precio?.replace('$', '').replace(',', '.') || '');
      setOriginalCategories(row.categorias || '');

      if (row.categorias) {
        const cats = new Set(row.categorias.split(',').map(c => c.trim()));
        setSelectedCategories(cats);
      }
    } else {
      setProductName('');
      setProductPrice('');
      setOriginalCategories('');
    }

    // Reset variants
    resetVariants();
  };

  // Toggle de categorías
  const toggleCategory = (category) => {
    setSelectedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  // Toggle de colores
  const toggleColor = (color) => {
    setSelectedColors(prev =>
      prev.includes(color)
        ? prev.filter(c => c !== color)
        : [...prev, color]
    );
  };

  // Toggle de talles
  const toggleSize = (size) => {
    setSelectedSizes(prev =>
      prev.includes(size)
        ? prev.filter(s => s !== size)
        : [...prev, size]
    );
  };

  // Seleccionar todos los colores
  const selectAllColors = () => {
    setSelectedColors([...predefinedColors]);
  };

  // Limpiar todos los colores
  const clearAllColors = () => {
    setSelectedColors([]);
  };

  // Seleccionar todos los talles
  const selectAllSizes = () => {
    setSelectedSizes([...predefinedSizes]);
  };

  // Limpiar todos los talles
  const clearAllSizes = () => {
    setSelectedSizes([]);
  };

  // Generar combinaciones de variantes
  const generateVariantCombinations = () => {
    const properties = [];
    const propertyNames = [];

    if (useColor && selectedColors.length > 0) {
      properties.push(selectedColors);
      propertyNames.push("Color");
    }

    if (useSize && selectedSizes.length > 0) {
      properties.push(selectedSizes);
      propertyNames.push("Talle");
    }

    if (useType && typeValues.trim()) {
      const values = typeValues.split('\n').map(v => v.trim()).filter(Boolean);
      if (values.length > 0) {
        properties.push(values);
        propertyNames.push(typeName || "Tipo");
      }
    }

    if (properties.length === 0) {
      setVariantCombinations([]);
      return;
    }

    const combinations = [];
    const generateCombos = (current, remaining) => {
      if (remaining.length === 0) {
        combinations.push([...current]);
        return;
      }

      const [firstProperty, ...restProperties] = remaining;
      for (const value of firstProperty) {
        generateCombos([...current, value], restProperties);
      }
    };

    generateCombos([], properties);

    const variantData = combinations.map((combo, index) => ({
      id: index,
      properties: propertyNames.map((name, i) => ({
        name,
        value: combo[i] || ''
      })),
      price: productPrice || '0',
      stock: '10'
    }));

    setVariantCombinations(variantData);
  };

  // Seleccionar un tipo predefinido de la lista de sugerencias
  const onSelectPredefinedType = (predefinedType, singleValue = null) => {
    setTypeName(predefinedType.name);
    if (singleValue) {
      setTypeValues(singleValue);
    } else {
      setTypeValues(predefinedType.values.join('\n'));
    }
  };

  // Actualizar precio de variante
  const updateVariantPrice = (variantId, price) => {
    setVariantCombinations(prev =>
      prev.map(v => v.id === variantId ? { ...v, price } : v)
    );
  };

  // Actualizar stock de variante
  const updateVariantStock = (variantId, stock) => {
    setVariantCombinations(prev =>
      prev.map(v => v.id === variantId ? { ...v, stock } : v)
    );
  };

  // Reset del formulario completo
  const resetForm = () => {
    setProductName('');
    setProductPrice('');
    setProductStock('10');
    setSelectedCategories([]);
    setOriginalCategories('');
    resetVariants();
  };

  // Reset solo de variantes
  const resetVariants = () => {
    setUseColor(false);
    setUseSize(false);
    setUseType(false);
    setSelectedColors([]);
    setSelectedSizes([]);
    resetTypeToDefaults(); // Usar los valores por defecto cargados
    setVariantCombinations([]);
  };

  // Obtener datos del producto para guardar
  const getProductData = () => {
    return {
      productName,
      productPrice,
      productStock,
      selectedCategories: [...selectedCategories], // Convertir Set a Array para guardar
      originalCategories
    };
  };

  // Validar si el formulario está completo
  const isFormValid = () => {
    return productName.trim() !== '';
  };

  return {
    // Estados del formulario básico
    productName,
    setProductName,
    productPrice,
    setProductPrice,
    productStock,
    setProductStock,
    selectedCategories,
    setSelectedCategories,
    originalCategories,
    categories,
    categoryTree,

    // Estados de variantes
    useColor,
    setUseColor,
    useSize,
    setUseSize,
    useType,
    setUseType,
    selectedColors,
    setSelectedColors,
    selectedSizes,
    setSelectedSizes,
    typeName,
    setTypeName,
    typeValues,
    setTypeValues,
    variantCombinations,
    setVariantCombinations,
    predefinedColors,
    predefinedTypes,
    predefinedSizes,

    // Funciones del formulario básico
    loadConfig,
    loadProductData,
    toggleCategory,
    getProductData,
    isFormValid,
    resetForm,

    // Funciones de variantes
    toggleColor,
    toggleSize,
    selectAllColors,
    clearAllColors,
    selectAllSizes,
    clearAllSizes,
    generateVariantCombinations,
    updateVariantPrice,
    updateVariantStock,
    resetVariants,
    onSelectPredefinedType
  };
};