// hooks/useProductFormManager.js
import { useState } from 'react';

export const useProductFormManager = () => {
  // Estados del formulario básico
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productStock, setProductStock] = useState('10');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [originalCategories, setOriginalCategories] = useState('');

  // Estados de variantes
  const [useColor, setUseColor] = useState(false);
  const [useSize, setUseSize] = useState(false);
  const [useType, setUseType] = useState(false);
  const [selectedColors, setSelectedColors] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [typeName, setTypeName] = useState('Tipo');
  const [typeValues, setTypeValues] = useState('Modelo A\nModelo B\nModelo C');
  const [variantCombinations, setVariantCombinations] = useState([]);

  // Categorías predefinidas
  const categories = [
    "Plata > Conjuntos",
    "Plata > Cadenas",
    "Plata > Dijes",
    "Plata > Aros > Argollas",
    "Plata > Aros > Aros pasantes",
    "Plata > Aros > Abridores",
    "Acero > Acero Blanco > Aros > Cuff",
    "Acero > Acero Blanco > Aros > Aros Pasantes",
    "Acero > Acero Blanco > Aros > Abridores",
    "Acero > Acero Blanco > Aros > Argollas",
    "Acero > Acero Blanco > Anillos",
    "Acero > Acero Blanco > Anillos > Alianzas",
    "Acero > Acero Blanco > Cadena",
    "Acero > Acero Blanco > Dijes",
    "Acero > Acero Blanco > Pulseras",
    "Acero > Acero Blanco > Esclavas",
    "Acero > Acero Quirúrgico > Aros",
    "Acero > Acero Quirúrgico > Anillos",
    "Acero > Acero Dorado > Aros > Aros Pasantes",
    "Acero > Acero Dorado > Aros > Abridores",
    "Acero > Acero Dorado > Aros > Argollas",
    "Acero > Acero Dorado > Cadena",
    "Acero > Acero Dorado > Dijes",
    "Acero > Acero Dorado > Pulseras",
    "Acero > Acero Dorado > Esclavas",
    "Acero > Acero Dorado > Anillos",
    "Alhajero",
    "Cristal",
    "Pulseras"
  ];

  // Colores y talles predefinidos
  const predefinedColors = [
    "Amarillo", "Azul", "Beige", "Blanco", "Bordó", "Celeste",
    "Fucsia", "Gris", "Marrón", "Naranja", "Negro", "Plata",
    "Rojo", "Rosa", "Verde", "Violeta", "Transparente", "Multicolor"
  ];

  const predefinedSizes = ["XS", "S", "M", "L", "XL", "XXL"];

  // Cargar datos del producto desde CSV
  const loadProductData = (filename, data) => {
    const row = data.find(r => r.archivo === filename);

    setSelectedCategories([]);

    if (row) {

      setProductName(row.descripcion || '');
      setProductPrice(row.precio?.replace('$', '').replace(',', '.') || '');
      setOriginalCategories(row.categorias || '');

      if (row.categorias) {
        const cats = row.categorias.split(',').map(c => c.trim());
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
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
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
    setTypeName('Tipo');
    setTypeValues('Modelo A\nModelo B\nModelo C');
    setVariantCombinations([]);
  };

  // Obtener datos del producto para guardar
  const getProductData = () => {
    return {
      productName,
      productPrice,
      productStock,
      selectedCategories,
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
    predefinedSizes,

    // Funciones del formulario básico
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
    resetVariants
  };
};