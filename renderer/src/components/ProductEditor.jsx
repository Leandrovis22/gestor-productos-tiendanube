/**
 * @file ProductEditor.jsx
 * @description Este archivo define el editor de detalles de un producto, que está dividido en dos secciones principales:
 * "General" y "Variantes". Permite al usuario modificar el nombre, precio, stock, categorías y variantes de un producto.
 *
 * `GeneralForm`:
 * - Un componente de formulario para editar los datos básicos del producto: nombre, precio y stock (si no hay variantes).
 * - Muestra las categorías seleccionadas actualmente.
 * - Incluye el componente `CategoryGroups` para permitir al usuario seleccionar y deseleccionar categorías de una lista completa.
 *
 * `VariantsForm`:
 * - Un componente de formulario para crear y gestionar las variantes de un producto.
 * - Permite al usuario habilitar y seleccionar propiedades como "Color", "Talle" y un tipo personalizable (ej: "Material").
 * - Para "Color" y "Talle", muestra botones predefinidos que el usuario puede seleccionar. Incluye opciones para
 *   seleccionar/deseleccionar todos.
 * - Para el tipo personalizable, el usuario puede definir un nombre (ej: "Material") y una lista de valores (ej: "Plata", "Acero").
 * - Ofrece sugerencias de tipos y valores predefinidos para agilizar la entrada de datos.
 * - Incluye una funcionalidad para agregar nuevos colores al sistema, con un selector de color y guardado en la configuración.
 * - Muestra los colores con su correspondiente fondo de color para una mejor visualización.
 * - Una vez que se seleccionan las propiedades, un botón "Generar Combinaciones" crea todas las posibles variantes
 *   (ej: "Rojo - S", "Rojo - M", "Azul - S", "Azul - M").
 * - Muestra una lista de las combinaciones generadas, permitiendo al usuario establecer un precio y stock específico para cada una.
 *
 * `ProductEditor` (Componente principal):
 * - El componente que organiza las pestañas "General" y "Variantes".
 * - Recibe todo el estado y las funciones de manejo de estado desde un componente padre (probablemente a través de un hook como `useProductFormManager`).
 * - Renderiza `GeneralForm` o `VariantsForm` según la pestaña activa (`activeTab`).
 * - Actúa como un contenedor que pasa todas las props necesarias a los formularios correspondientes.
 */

// components/ProductEditor.js
import React from 'react';
import { CategoryGroups } from './CategoryGroups';

// Sección del formulario general (movido fuera del componente principal)
const GeneralForm = ({
  productName,
  setProductName,
  productPrice,
  setProductPrice,
  productStock,
  setProductStock,
  selectedCategories,
  categories, // Necesitamos la lista plana de categorías
  onToggleCategory,
}) => (
  <div>
    <div className="mb-1">
      <label className="block text-sm font-medium mb-2">Nombre del Producto:</label>
      <textarea
        value={productName}
        onChange={(e) => setProductName(e.target.value)}
        className="w-full h-[3rem] bg-gray-800 border border-gray-600 rounded px-3 py-2"
        rows={3}
      />
    </div>

    <div className="flex gap-4 mb-1">
      <div className="flex-1">
        <label className="block text-sm font-medium mb-2">Precio:</label>
        <input
          type="text"
          value={productPrice}
          onChange={(e) => setProductPrice(e.target.value)}
          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2"
        />
      </div>
      <div className="flex-1">
        <label className="block text-sm font-medium mb-2">Stock (si no hay variantes):</label>
        <input
          type="text"
          value={productStock}
          onChange={(e) => setProductStock(e.target.value)}
          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2"
        />
      </div>
    </div>

    <div className="mt-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium mb-2">Categorías Activas</h3>
        <div className="p-3 bg-gray-800 border border-gray-700 rounded min-h-[50px]">
          {selectedCategories.size > 0 ? (
            <div className="flex flex-wrap gap-2">
              {[...selectedCategories].map(cat => (
                <span key={cat} className="bg-blue-600 text-white text-xs font-medium px-2.5 py-1 rounded-full">
                  {cat}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Ninguna categoría seleccionada.</p>
          )}
        </div>
      </div>

      <h3 className="text-lg font-medium mb-2">Todas las Categorías</h3>
      <div className="max-h-[20rem] overflow-y-auto border border-gray-700 rounded p-4 bg-gray-800">
        <CategoryGroups
          categories={categories}
          selectedCategories={selectedCategories}
          onToggleCategory={onToggleCategory}
        />
      </div>
    </div>
  </div>
);

// Sección del formulario de variantes (movido fuera del componente principal)
const VariantsForm = ({
  useColor, setUseColor, useSize, setUseSize, useType, setUseType,
  selectedColors, onToggleColor, onSelectAllColors, onClearAllColors, predefinedColors,
  selectedSizes, onToggleSize, onSelectAllSizes, onClearAllSizes, predefinedSizes,
  typeName, setTypeName, typeValues, setTypeValues, predefinedTypes, onSelectPredefinedType,
  onGenerateVariants, variantCombinations, onUpdateVariantPrice, onUpdateVariantStock,
  onSaveColor, // Nueva prop para guardar colores
  colorMap // Nueva prop para el mapa de colores desde config
}) => {
  const [valueSuggestions, setValueSuggestions] = React.useState([]);
  const [newColorName, setNewColorName] = React.useState('');
  const [newColorHex, setNewColorHex] = React.useState('#000000');
  const [showAddColor, setShowAddColor] = React.useState(false);
  
  // Usar el colorMap desde la configuración, con fallback a valores por defecto
  const defaultColorMap = {
    Amarillo: '#FFD700', Azul: '#0000FF', Beige: '#F5F5DC', Blanco: '#FFFFFF', Bordó: '#800000',
    Celeste: '#87CEEB', Fucsia: '#FF00FF', Gris: '#808080', Marrón: '#A52A2A', Naranja: '#FFA500',
    Negro: '#000000', Plata: '#C0C0C0', Rojo: '#FF0000', Rosa: '#FFC0CB', Verde: '#008000',
    Violeta: '#EE82EE', Transparente: '#FFFFFF', Multicolor: 'linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)',
    Lila: '#DDA0DD', Dorado: '#FFD700'
  };
  
  const currentColorMap = colorMap || defaultColorMap;

  const getFontColor = (hexColor) => {
    if (!hexColor || hexColor === '#FFFFFF') return '#000000';
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#FFFFFF';
  };

  // Función para agregar un nuevo color
  const handleAddColor = async () => {
    if (!newColorName.trim()) {
      alert('Por favor, ingresa un nombre para el color');
      return;
    }

    try {
      const result = await onSaveColor(newColorName.trim(), newColorHex);
      if (result.success) {
        alert(result.message);
        setNewColorName('');
        setNewColorHex('#000000');
        setShowAddColor(false);
        // Los colores se actualizarán automáticamente a través de la prop predefinedColors
        // que se actualiza cuando se llama a productForm.loadConfig(result.config)
      } else {
        alert('Error al guardar el color: ' + result.error);
      }
    } catch (error) {
      console.error('Error saving color:', error);
      alert('Error al guardar el color');
    }
  };

  // Muestra todos los tipos si el input está vacío, o filtra si se está escribiendo.
  const filteredTypes = typeName.trim() === ''
    ? predefinedTypes
    : predefinedTypes.filter(pt => pt.name.toLowerCase().includes(typeName.toLowerCase()));

  // Manejar cambio en el textarea de valores para mostrar sugerencias
  const handleTypeValuesChange = (e) => {
    const currentValue = e.target.value;
    setTypeValues(currentValue);

    if (currentValue.trim() === '' || currentValue.includes('\n')) {
      setValueSuggestions([]);
      return;
    }

    const suggestions = [];
    predefinedTypes.forEach(type => {
      type.values.forEach(value => {
        if (value.toLowerCase().includes(currentValue.toLowerCase())) {
          suggestions.push({ value, type });
        }
      });
    });
    setValueSuggestions(suggestions.slice(0, 10)); // Limitar a 10 sugerencias
  };

  return (
    <div>
    <div className="border border-gray-700 rounded">
      <div className="p-3 bg-gray-800 border-b border-gray-600">
        <h3 className="font-medium">Variantes</h3>
        <p className="text-sm text-gray-400 mt-1">
          Selecciona las propiedades que tendrá el producto. Se generarán todas las combinaciones.
        </p>
      </div>

      <div className="p-4">
        <div className="flex flex-col gap-4 mb-4">
          <div className="grid grid-cols-2 gap-4">
          {/* Sección de Colores */}
          <div className="border border-gray-600 rounded p-3">
            <label className="flex items-center gap-2 mb-3">
              <input type="checkbox" checked={useColor} onChange={(e) => setUseColor(e.target.checked)} />
              <span className="font-medium">Color</span>
              <button
                onClick={() => setShowAddColor(!showAddColor)}
                className="ml-auto px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-xs"
                title="Agregar nuevo color"
              >
                + Color
              </button>
            </label>
            
            {/* Formulario para agregar nuevo color */}
            {showAddColor && (
              <div className="mb-3 p-3 bg-gray-900/50 rounded border border-gray-500">
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Nombre del nuevo color"
                      value={newColorName}
                      onChange={(e) => setNewColorName(e.target.value)}
                      className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddColor();
                        }
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newColorHex}
                        onChange={(e) => setNewColorHex(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-gray-600"
                        title="Seleccionar color"
                      />
                      <input
                        type="text"
                        value={newColorHex}
                        onChange={(e) => setNewColorHex(e.target.value)}
                        className="w-20 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs font-mono"
                        placeholder="#000000"
                        pattern="^#[0-9A-Fa-f]{6}$"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddColor}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs"
                    >
                      Agregar Color
                    </button>
                    <button
                      onClick={() => {
                        setShowAddColor(false);
                        setNewColorName('');
                        setNewColorHex('#000000');
                      }}
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs"
                    >
                      Cancelar
                    </button>
                    {/* Preview del color */}
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-xs text-gray-400">Vista previa:</span>
                      <div
                        className="w-6 h-6 rounded border border-gray-600"
                        style={{ backgroundColor: newColorHex }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {useColor && (
              <div>
                <div className="flex flex-wrap gap-2 mb-2 p-2 bg-gray-900/50 rounded">
                  {predefinedColors.map(color => (
                    <button
                      key={color}
                      onClick={() => onToggleColor(color)}
                      className={`px-3 py-1 text-xs font-medium rounded-full border-[3px] ${selectedColors.includes(color) ? 'border-red-600' : 'border-transparent'}`}
                      style={{
                        background: currentColorMap[color] || '#CCCCCC',
                        color: getFontColor(currentColorMap[color]),
                        backgroundImage: color === 'Multicolor' ? currentColorMap[color] : 'none',
                        textShadow: color === 'Transparente' ? '0 0 2px #000' : 'none'
                      }}
                    >
                      {color}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1">
                  <button onClick={onSelectAllColors} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">Todos</button>
                  <button onClick={onClearAllColors} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">Ninguno</button>
                </div>
              </div>
            )}
          </div>

          {/* Sección de Talles */}
          <div className="border border-gray-600 rounded p-3">
            <label className="flex items-center gap-2 mb-3">
              <input type="checkbox" checked={useSize} onChange={(e) => setUseSize(e.target.checked)} />
              <span className="font-medium">Talle</span>
            </label>
            {useSize && (
              <div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {predefinedSizes.map(size => (
                     <button
                      key={size}
                      onClick={() => onToggleSize(size)}
                      className={`px-3 py-1 text-sm rounded ${
                        selectedSizes.includes(size) ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1">
                  <button onClick={onSelectAllSizes} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">Todos</button>
                  <button onClick={onClearAllSizes} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">Ninguno</button>
                </div>
              </div>
            )}
          </div>
          </div>

          {/* Sección de Tipos personalizados */}
          <div className="border border-gray-600 rounded p-3">
            <div className="flex items-center gap-2 mb-3">
              <input type="checkbox" checked={useType} onChange={(e) => setUseType(e.target.checked)} className="flex-shrink-0" />
              <div className="relative flex-1">
                <input type="text" placeholder="Tipo (ej: Material)" value={typeName} onChange={(e) => setTypeName(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm" />
                {/* Dropdown para seleccionar tipos predefinidos */}
                <div className="absolute right-1 top-1/2 -translate-y-1/2">
                  <select 
                    onChange={(e) => {
                      const selectedType = predefinedTypes.find(pt => pt.name === e.target.value);
                      if (selectedType) onSelectPredefinedType(selectedType);
                      e.target.value = ''; // Reset select
                    }}
                    className="bg-gray-700 border-none rounded text-xs h-5 w-5 appearance-none text-center cursor-pointer"
                    value=""
                  >
                    <option value="" disabled>▼</option>
                    {predefinedTypes.map(pt => <option key={pt.name} value={pt.name} title={`Valores:\n${pt.values.join('\n')}`}>{pt.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            {useType && (
              <div className="flex gap-4 mt-4">
                {/* Columna de Input de Valores */}
                <div className="w-[50%]">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Valores (uno por línea):</label>
                    <textarea 
                      placeholder="Valor A&#10;Valor B&#10;Valor C"
                      value={typeValues} 
                      onChange={handleTypeValuesChange} 
                      className="w-full h-48 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm" />
                    <p className="text-xs text-gray-500 mt-1">(Un valor por línea)</p>
                  </div>
                </div>

                {/* Columna de Sugerencias de Tipos */}
                <div className="w-1/2">
                  {filteredTypes.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-300 mb-2">Sugerencias de Tipos:</p>
                      <div className="max-h-48 overflow-y-auto flex flex-col gap-1 pr-2">
                        {filteredTypes.map(pt => (
                          <button key={pt.name} onClick={() => onSelectPredefinedType(pt)} className="text-left text-sm bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded">
                            {pt.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {/* Columna de Sugerencias de Valores */}
                <div className="w-1/2">
                  {valueSuggestions.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-300 mb-2">Sugerencias de Valores:</p>
                      <div className="max-h-48 overflow-y-auto flex flex-col gap-1 pr-2">
                        {valueSuggestions.map(({ value, type }) => (
                          <button key={`${type.name}-${value}`} onClick={() => { onSelectPredefinedType(type, value); setValueSuggestions([]); }} className="text-left text-sm bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded">
                            {value} <span className="text-gray-400">({type.name})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <button onClick={onGenerateVariants} className="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded mb-4">
          Generar Combinaciones
        </button>

        {/* Lista de combinaciones generadas */}
        {variantCombinations.length > 0 && (
          <div className="border border-gray-600 rounded">
            <div className="p-3 bg-gray-800 border-b border-gray-600">
              <h4 className="font-medium">Combinaciones generadas ({variantCombinations.length})</h4>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {variantCombinations.map((variant, index) => (
                <div key={variant.id} className="p-3 border-b border-gray-700 last:border-b-0">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="text-sm font-medium">{index + 1}. </span>
                      {variant.properties.map((prop, i) => (
                        <span key={i} className="text-sm">
                          {prop.value && `${prop.name}: ${prop.value}`}
                          {prop.value && i < variant.properties.length - 1 && variant.properties[i + 1].value && ' + '}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-sm">$</span>
                      <input type="text" value={variant.price} onChange={(e) => onUpdateVariantPrice(variant.id, e.target.value)} className="w-20 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm" />
                      <span className="text-sm ml-2">Stock:</span>
                      <input type="text" value={variant.stock} onChange={(e) => onUpdateVariantStock(variant.id, e.target.value)} className="w-16 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>);
};

export const ProductEditor = ({
  // Datos básicos del producto
  productName,
  setProductName,
  productPrice,
  setProductPrice,
  productStock,
  setProductStock,
  selectedCategories,
  categories,
  onToggleCategory,

  // Estados de variantes
  useColor,
  setUseColor,
  useSize,
  setUseSize,
  useType,
  setUseType,
  selectedColors,
  selectedSizes,
  typeName,
  setTypeName,
  typeValues,
  setTypeValues,
  variantCombinations,
  predefinedColors,
  predefinedSizes,
  predefinedTypes,
  onSelectPredefinedType,
  colorMap, // Nueva prop para el mapa de colores

  // Funciones de variantes
  onToggleColor,
  onToggleSize,
  onSelectAllColors,
  onClearAllColors,
  onSelectAllSizes,
  onClearAllSizes,
  onGenerateVariants,
  onUpdateVariantPrice,
  onUpdateVariantStock,
  onSaveColor, // Nueva prop para guardar colores

  // Control de pestañas
  activeTab
}) => {

  // Renderizar contenido según la pestaña activa
  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralForm 
          productName={productName}
          setProductName={setProductName}
          productPrice={productPrice}
          setProductPrice={setProductPrice}
          productStock={productStock}
          setProductStock={setProductStock}
          selectedCategories={selectedCategories}
          categories={categories}
          onToggleCategory={onToggleCategory}
        />;
      case 'variantes':
        return <VariantsForm 
          useColor={useColor} setUseColor={setUseColor} useSize={useSize} setUseSize={setUseSize} useType={useType} setUseType={setUseType}
          selectedColors={selectedColors} onToggleColor={onToggleColor} onSelectAllColors={onSelectAllColors} onClearAllColors={onClearAllColors} predefinedColors={predefinedColors}
          selectedSizes={selectedSizes} onToggleSize={onToggleSize} onSelectAllSizes={onSelectAllSizes} onClearAllSizes={onClearAllSizes} predefinedSizes={predefinedSizes} predefinedTypes={predefinedTypes} onSelectPredefinedType={onSelectPredefinedType}
          typeName={typeName} setTypeName={setTypeName} typeValues={typeValues} setTypeValues={setTypeValues}
          onGenerateVariants={onGenerateVariants} variantCombinations={variantCombinations} onUpdateVariantPrice={onUpdateVariantPrice} onUpdateVariantStock={onUpdateVariantStock}
          onSaveColor={onSaveColor} // Pasar la función para guardar colores
          colorMap={colorMap} // Pasar el mapa de colores
        />;
      default:
        return <GeneralForm 
          productName={productName}
          setProductName={setProductName}
          productPrice={productPrice}
          setProductPrice={setProductPrice}
          productStock={productStock}
          setProductStock={setProductStock}
          selectedCategories={selectedCategories}
          categories={categories}
          onToggleCategory={onToggleCategory}
        />;
    }
  };

  return (
    <div className="p-6 overflow-y-auto">
      {renderTabContent()}
    </div>
  );
};