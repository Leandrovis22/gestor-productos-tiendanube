import React, { useState, useEffect, useCallback } from 'react';
import { 
  Package, 
  Plus, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  Search, 
  Image,
  Save,
  X,
  FolderOpen,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { CategoryGroups } from './CategoryGroups';

// Componente de selección de directorio (fuera del componente principal)
const DirectorySelector = ({ selectWorkingDirectory, workingDirectory, setActiveTab }) => (
  <div className="bg-gray-800 p-6 rounded-lg mb-6">
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Package size={20} />
        Gestión de Productos
      </h2>
      <button
        onClick={() => setActiveTab('general')}
        className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded text-sm"
      >
        Volver al Editor
      </button>
    </div>
    <div className="flex items-center gap-4">
      <button
        onClick={selectWorkingDirectory}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded"
      >
        <FolderOpen size={16} />
        Seleccionar Carpeta de Trabajo
      </button>
      {workingDirectory && (
        <span className="text-gray-300 text-sm">
          Carpeta: {workingDirectory.split('\\').pop()}
        </span>
      )}
    </div>
  </div>
);

// Vista principal (lista de productos) - Movida fuera del componente principal
const ListView = ({ 
  searchTerm, 
  setSearchTerm, 
  filteredProducts, 
  loading, 
  setActiveTab, 
  setView, 
  editProduct, 
  workingDirectory
}) => (
  <div className="space-y-4">
    {/* Controles superiores */}
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <span className="text-gray-400 text-sm">
          {filteredProducts.length} productos total
        </span>
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('general')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm"
        >
          Volver al Editor
        </button>
        <button
          onClick={() => setView('deleted')}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-500 px-4 py-2 rounded text-sm"
        >
          <Trash2 size={16} />
          Ver Eliminados
        </button>
        <button
          onClick={() => {/* TODO: Implementar crear nuevo producto */}}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 px-4 py-2 rounded"
        >
          <Plus size={16} />
          Nuevo Producto
        </button>
      </div>
    </div>

    {/* Lista de productos */}
    <div className="h-[calc(100vh-70px)] overflow-y-auto pr-2">
      <div className="grid grid-cols-9 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-400">Cargando productos...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-400">
            <Package size={48} className="mx-auto mb-4 opacity-50" />
            <p>No hay productos disponibles</p>
            <p className="text-sm">Selecciona una carpeta de trabajo para comenzar</p>
          </div>
        ) : (
          filteredProducts.map(product => (
            <div 
              key={product.id} 
              className="relative border-4 border-gray-600 hover:border-blue-500 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 hover:scale-105"
              onClick={() => editProduct(product)}
            >
              {/* Imagen del producto */}
              <div className="w-full aspect-[3/4] bg-gray-700 flex items-center justify-center relative">
                {product.images?.length > 0 ? (
                  <img 
                    src={window.electronAPI.getLocalImageUrl(
                      `${workingDirectory}\\procesadas\\${product.images[0]}`
                    )}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className={`w-full h-full bg-gray-600 items-center justify-center ${
                    product.images?.length > 0 ? 'hidden' : 'flex'
                  }`}
                >
                  <Image size={24} className="text-gray-500" />
                </div>

                {/* Información superpuesta - solo fotos, variantes y precio */}
                <div className="absolute top-0 left-0 right-0 bg-black bg-opacity-70 text-white p-[0.3rem]">
                  <div className="flex items-center justify-between text-xs text-gray-300">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Image size={12} />
                        {product.images?.length || 0}
                      </span>
                      <span className="text-gray-400">•</span>
                      <span className="flex items-center gap-1">
                        <Package size={12} />
                        {product.variants?.length || 0}
                      </span>
                    </div>
                    <span>${Math.floor(parseFloat((product.price || '0').replace(/,/g, ''))).toLocaleString('es-AR')}</span>
                  </div>
                </div>
              </div>

              {/* Información del producto - nombre abajo */}
              <div className="bg-black bg-opacity-75 text-white p-[0.3rem]  min-h-[54.6px]">
                <h3 className="font-semibold text-xs leading-tight" title={product.name}>
                  {product.name}
                </h3>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  </div>
);

// Vista de productos eliminados - Movida fuera del componente principal
const DeletedView = ({ deletedProducts, setView, restoreProduct }) => (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Trash2 size={20} />
        Productos Eliminados
      </h2>
      <button
        onClick={() => setView('list')}
        className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded"
      >
        <X size={16} />
        Volver
      </button>
    </div>

    {deletedProducts.length === 0 ? (
      <div className="text-center py-8 text-gray-400">
        <Trash2 size={48} className="mx-auto mb-4 opacity-50" />
        <p>No hay productos eliminados</p>
      </div>
    ) : (
      <div className="grid gap-4">
        {deletedProducts.map(product => (
          <div key={product.id} className="bg-red-900/20 border border-red-500/30 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{product.name}</h3>
                <p className="text-gray-400 text-sm">{product.categories}</p>
                <p className="text-red-400 text-xs mt-1">
                  Eliminado el: {product.deletedAt}
                </p>
              </div>
              <button
                onClick={() => restoreProduct(product)}
                className="flex items-center gap-1 bg-green-600 hover:bg-green-500 px-3 py-1 rounded text-sm"
              >
                <RotateCcw size={14} />
                Restaurar
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// Vista de edición de producto - Nueva versión con pestañas y variantes
const EditView = ({ 
  currentProduct, 
  editForm, 
  updateEditForm, 
  updateVariant, 
  setView, 
  deleteProduct, 
  saveProduct, 
  productImages, 
  workingDirectory, 
  deleteImage,
  // Nuevos props para variantes
  config,
  selectedCategories,
  toggleCategory,
  editActiveTab,
  setEditActiveTab,
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
  editVariantCombinations,
  toggleColor,
  toggleSize,
  selectAllColors,
  clearAllColors,
  selectAllSizes,
  clearAllSizes,
  generateVariantCombinations,
  updateVariantPrice,
  updateVariantStock,
  // Nuevas props para sugerencias
  valueSuggestions,
  handleTypeValuesChange,
  selectPredefinedType,
  selectValueSuggestion
}) => {
  // Función auxiliar para obtener color del mapa de colores
  const getColorStyle = (colorName) => {
    const colorMap = {
      Amarillo: '#FFD700', Azul: '#0000FF', Beige: '#F5F5DC', Blanco: '#FFFFFF', Bordó: '#800000',
      Celeste: '#87CEEB', Fucsia: '#FF00FF', Gris: '#808080', Marrón: '#A52A2A', Naranja: '#FFA500',
      Negro: '#000000', Plata: '#C0C0C0', Rojo: '#FF0000', Rosa: '#FFC0CB', Verde: '#008000',
      Violeta: '#EE82EE', Transparente: '#FFFFFF', Multicolor: 'linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)'
    };

    const getFontColor = (hexColor) => {
      if (!hexColor || hexColor === '#FFFFFF') return '#000000';
      const r = parseInt(hexColor.substr(1, 2), 16);
      const g = parseInt(hexColor.substr(3, 2), 16);
      const b = parseInt(hexColor.substr(5, 2), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return (yiq >= 128) ? '#000000' : '#FFFFFF';
    };

    return {
      background: colorName === 'Multicolor' ? colorMap[colorName] : (colorMap[colorName] || '#FFFFFF'),
      color: getFontColor(colorMap[colorName]),
      backgroundImage: colorName === 'Multicolor' ? colorMap[colorName] : 'none',
      textShadow: colorName === 'Transparente' ? '0 0 2px #000' : 'none'
    };
  };

  return (
    <div className="h-[calc(100vh-90px)] overflow-y-auto pr-2">
      <div className="space-y-6">
        <div className="flex justify-between items-center sticky top-0 bg-gray-900 z-10 py-2">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Edit3 size={20} />
            Editar Producto: {currentProduct?.name}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setView('list')}
              className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded"
            >
              <X size={16} />
              Cancelar
            </button>
            <button
              onClick={() => deleteProduct(currentProduct)}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 px-4 py-2 rounded"
            >
              <Trash2 size={16} />
              Eliminar
            </button>
            <button
              onClick={saveProduct}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-500 px-4 py-2 rounded"
            >
              <Save size={16} />
              Guardar
            </button>
          </div>
        </div>

        {/* Tabs de edición */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setEditActiveTab('general')}
            className={`px-4 py-2 text-sm font-medium ${
              editActiveTab === 'general' 
                ? 'bg-gray-800 border-b-2 border-blue-500' 
                : 'text-gray-400 hover:bg-gray-800'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setEditActiveTab('variantes')}
            className={`px-4 py-2 text-sm font-medium ${
              editActiveTab === 'variantes' 
                ? 'bg-gray-800 border-b-2 border-blue-500' 
                : 'text-gray-400 hover:bg-gray-800'
            }`}
          >
            Variantes
          </button>
        </div>

        {editActiveTab === 'general' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Columna izquierda: Datos del producto */}
            <div className="space-y-6">
              <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">Datos del Producto</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Nombre</label>
                    <textarea
                      value={editForm.name}
                      onChange={(e) => updateEditForm('name', e.target.value)}
                      className="w-full h-[3rem] bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Precio (si no hay variantes)</label>
                      <input
                        type="text"
                        value={editForm.price}
                        onChange={(e) => updateEditForm('price', e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Stock (si no hay variantes)</label>
                      <input
                        type="text"
                        value={editForm.stock}
                        onChange={(e) => updateEditForm('stock', e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Categorías */}
              <div className="bg-gray-800 p-6 rounded-lg">
                <div className="mb-4">
                  <h3 className="text-lg font-medium mb-2">Categorías Activas</h3>
                  <div className="p-3 bg-gray-700 border border-gray-600 rounded min-h-[50px]">
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
                <div className="max-h-[20rem] overflow-y-auto border border-gray-600 rounded p-4 bg-gray-700">
                  {config && config.categories && (
                    <CategoryGroups
                      categories={config.categories}
                      selectedCategories={selectedCategories}
                      onToggleCategory={toggleCategory}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Columna derecha: Imágenes */}
            <div className="bg-gray-800 p-6 rounded-lg h-fit">
              <h3 className="text-lg font-semibold mb-4">Imágenes del Producto</h3>
              <div className="space-y-4">
                {productImages.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">No hay imágenes disponibles</p>
                ) : (
                  <div className="overflow-y-auto pr-2">
                    <div className="grid grid-cols-2 gap-3">
                      {productImages.map(image => (
                        <div key={image} className="relative group">
                          <div className="aspect-[3/4] bg-gray-700 rounded-lg overflow-hidden">
                            <img 
                              src={window.electronAPI.getLocalImageUrl(
                                `${workingDirectory}\\procesadas\\${image}`
                              )}
                              alt={image}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                            <div className="hidden w-full h-full bg-gray-600 items-center justify-center text-xs text-gray-400">
                              <div className="text-center">
                                Error al cargar imagen
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => deleteImage(image)}
                            className="absolute top-2 right-2 bg-red-600 hover:bg-red-500 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={12} />
                          </button>
                          <p className="text-xs text-gray-400 mt-1 truncate">{image}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {editActiveTab === 'variantes' && (
          <div className="space-y-6">
            {/* Controles de variantes */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Variantes del Producto</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Sección de Colores */}
                  <div className="border border-gray-600 rounded p-3">
                    <label className="flex items-center gap-2 mb-3">
                      <input 
                        type="checkbox" 
                        checked={useColor} 
                        onChange={(e) => setUseColor(e.target.checked)} 
                      />
                      <span className="font-medium">Color</span>
                    </label>
                    {useColor && config?.variants?.colors && (
                      <div>
                        <div className="flex flex-wrap gap-2 mb-2 p-2 bg-gray-900/50 rounded">
                          {config.variants.colors.map(color => (
                            <button
                              key={color}
                              onClick={() => toggleColor(color)}
                              className={`px-3 py-1 text-xs font-medium rounded-full border-2 ${
                                selectedColors.includes(color) ? 'border-cyan-400' : 'border-transparent'
                              }`}
                              style={getColorStyle(color)}
                            >
                              {color}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <button 
                            onClick={selectAllColors} 
                            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                          >
                            Todos
                          </button>
                          <button 
                            onClick={clearAllColors} 
                            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                          >
                            Ninguno
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sección de Talles */}
                  <div className="border border-gray-600 rounded p-3">
                    <label className="flex items-center gap-2 mb-3">
                      <input 
                        type="checkbox" 
                        checked={useSize} 
                        onChange={(e) => setUseSize(e.target.checked)} 
                      />
                      <span className="font-medium">Talle</span>
                    </label>
                    {useSize && config?.variants?.sizes && (
                      <div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {config.variants.sizes.map(size => (
                            <button
                              key={size}
                              onClick={() => toggleSize(size)}
                              className={`px-3 py-1 text-sm rounded ${
                                selectedSizes.includes(size) ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'
                              }`}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <button 
                            onClick={selectAllSizes} 
                            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                          >
                            Todos
                          </button>
                          <button 
                            onClick={clearAllSizes} 
                            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                          >
                            Ninguno
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sección de Tipos personalizados */}
                <div className="border border-gray-600 rounded p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <input 
                      type="checkbox" 
                      checked={useType} 
                      onChange={(e) => setUseType(e.target.checked)} 
                    />
                    <div className="flex-1 relative">
                      <input 
                        type="text" 
                        placeholder="Tipo (ej: Material)" 
                        value={typeName} 
                        onChange={(e) => setTypeName(e.target.value)} 
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {useType && (
                    <div className="flex gap-2">
                      {/* Columna 1: Input de valores */}
                      <div className="flex-1">
                        <label className="block text-xs text-gray-400 mb-1">Valores (uno por línea):</label>
                        <textarea 
                          placeholder="Valor A&#10;Valor B&#10;Valor C"
                          value={typeValues} 
                          onChange={handleTypeValuesChange} 
                          className="w-full h-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">(Un valor por línea)</p>
                      </div>

                      {/* Columna 2: Tipos predefinidos */}
                      {config?.variants?.predefinedTypes && (
                        <div className="w-1/3">
                          <label className="block text-xs text-gray-400 mb-1">Tipos disponibles:</label>
                          <div className="h-24 overflow-y-auto border border-gray-600 rounded bg-gray-700">
                            {(() => {
                              // Filtrar tipos según el input
                              const filteredTypes = typeName.trim() === ''
                                ? config.variants.predefinedTypes
                                : config.variants.predefinedTypes.filter(pt => 
                                    pt.name.toLowerCase().includes(typeName.toLowerCase())
                                  );
                              
                              return filteredTypes.map((type, index) => (
                                <button
                                  key={index}
                                  onClick={() => selectPredefinedType(type)}
                                  className="w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-gray-600"
                                >
                                  {type.name}
                                </button>
                              ));
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Columna 3: Sugerencias de valores */}
                      {valueSuggestions.length > 0 && (
                        <div className="w-1/3">
                          <label className="block text-xs text-gray-400 mb-1">Sugerencias:</label>
                          <div className="h-24 overflow-y-auto border border-gray-600 rounded bg-gray-700">
                            {valueSuggestions.map((suggestion, index) => (
                              <button
                                key={index}
                                onClick={() => selectValueSuggestion(suggestion)}
                                className="w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-gray-600"
                              >
                                <div className="font-semibold">{suggestion.value}</div>
                                <div className="text-xs text-gray-500">{suggestion.type.name}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button 
                  onClick={generateVariantCombinations} 
                  className="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded"
                >
                  Generar Combinaciones
                </button>

                {/* Lista de combinaciones generadas */}
                {editVariantCombinations.length > 0 && (
                  <div className="border border-gray-600 rounded">
                    <div className="p-3 bg-gray-700 border-b border-gray-600">
                      <h4 className="font-medium">Combinaciones generadas ({editVariantCombinations.length})</h4>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {editVariantCombinations.map((variant, index) => (
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
                              <input 
                                type="text" 
                                value={variant.price} 
                                onChange={(e) => updateVariantPrice(variant.id, e.target.value)} 
                                className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-sm ml-2">Stock:</span>
                              <input 
                                type="text" 
                                value={variant.stock} 
                                onChange={(e) => updateVariantStock(variant.id, e.target.value)} 
                                className="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ProductsTab = ({ setActiveTab }) => {
  // Estados principales
  const [workingDirectory, setWorkingDirectory] = useState(null);
  const [products, setProducts] = useState([]);
  const [deletedProducts, setDeletedProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('list'); // 'list', 'edit', 'deleted'
  const [currentProduct, setCurrentProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [config, setConfig] = useState(null);

  // Estados del formulario de edición
  const [editForm, setEditForm] = useState({
    name: '',
    categories: '',
    price: '',
    stock: '',
    variants: []
  });

  // Estados para manejo de imágenes
  const [productImages, setProductImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [imageDataCache, setImageDataCache] = useState(new Map());

  // Estados para edición de variantes
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [useColor, setUseColor] = useState(false);
  const [useSize, setUseSize] = useState(false);
  const [useType, setUseType] = useState(false);
  const [selectedColors, setSelectedColors] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [typeName, setTypeName] = useState('');
  const [typeValues, setTypeValues] = useState('');
  const [editVariantCombinations, setEditVariantCombinations] = useState([]);
  const [editActiveTab, setEditActiveTab] = useState('general'); // 'general' o 'variantes'
  const [valueSuggestions, setValueSuggestions] = useState([]);

  // Función para actualizar formulario con useCallback para evitar re-renders
  const updateEditForm = useCallback((field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Función para actualizar variante con useCallback
  const updateVariant = useCallback((index, field, value) => {
    setEditForm(prev => {
      const updatedVariants = [...prev.variants];
      updatedVariants[index][field] = value;
      return {
        ...prev,
        variants: updatedVariants
      };
    });
  }, []);

  // Cargar configuración al montar el componente
  useEffect(() => {
    loadConfig();
  }, []);

  // Función para seleccionar directorio de trabajo
  const selectWorkingDirectory = async () => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.selectDirectory();
        if (!result.canceled && result.directoryPath) {
          setWorkingDirectory(result.directoryPath);
          await loadProducts(result.directoryPath);
          await loadConfig();
        }
      }
    } catch (error) {
      console.error('Error selecting directory:', error);
    }
  };

  // Función para cargar configuración desde ubicación permanente
  const loadConfig = async () => {
    try {
      if (window.electronAPI) {
        const configData = await window.electronAPI.readConfig();
        setConfig(configData);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  // Función para cargar productos desde salida.csv y imagen-url.csv
  const loadProducts = async (directory) => {
    setLoading(true);
    try {
      if (window.electronAPI) {
        // Cargar productos desde salida.csv
        const salidaCsvPath = await window.electronAPI.joinPaths(directory, 'salida.csv');
        const salidaExists = await window.electronAPI.fileExists(salidaCsvPath);
        
        if (!salidaExists) {
          console.warn('salida.csv no encontrado');
          setProducts([]);
          return;
        }

        // Leer salida.csv con encoding adecuado
        const csvData = await window.electronAPI.readCsv(salidaCsvPath);
        
        // Cargar mapeo de imágenes desde imagen-url.csv
        const imagenUrlCsvPath = await window.electronAPI.joinPaths(directory, 'imagen-url.csv');
        const imagenUrlExists = await window.electronAPI.fileExists(imagenUrlCsvPath);
        
        let imageMapping = new Map();
        if (imagenUrlExists) {
          try {
            const imageUrlData = await window.electronAPI.readCsv(imagenUrlCsvPath);
            imageUrlData.forEach(row => {
              const url = row.url || '';
              const imagenes = row.imagenes || '';
              if (url && imagenes) {
                // Separar múltiples imágenes por coma
                const imageList = imagenes.split(',').map(img => img.trim()).filter(img => img);
                imageMapping.set(url, imageList);
              }
            });
          } catch (error) {
            console.warn('Error reading imagen-url.csv:', error);
          }
        }

        // Procesar datos CSV para extraer productos únicos y sus variantes
        const productMap = new Map();
        
        csvData.forEach(row => {
          const urlId = row['Identificador de URL'] || '';
          const name = row['Nombre'] || '';
          const categories = row['Categorías'] || '';
          const price = row['Precio'] || '';
          const stock = row['Stock'] || '';
          
          if (urlId) {
            // Si el producto no existe y tiene nombre, es la fila principal del producto
            if (!productMap.has(urlId) && name) {
              // Obtener imágenes del mapeo
              const productImages = imageMapping.get(urlId) || [];
              
              productMap.set(urlId, {
                id: urlId,
                name: name,
                categories: categories,
                price: price,
                stock: stock,
                variants: [],
                images: productImages
              });
            }
            
            // Siempre agregar la fila como variante (incluyendo la principal)
            if (productMap.has(urlId)) {
              const variant = {
                price: price,
                stock: stock,
                properties: []
              };
              
              // Extraer propiedades de variante (1-3)
              for (let i = 1; i <= 3; i++) {
                const propName = row[`Nombre de propiedad ${i}`] || '';
                const propValue = row[`Valor de propiedad ${i}`] || '';
                if (propName && propValue) {
                  variant.properties.push({ name: propName, value: propValue });
                }
              }
              
              // Marcar si es la variante principal (tiene nombre del producto)
              variant.isMain = !!name;
              
              productMap.get(urlId).variants.push(variant);
            }
          }
        });
        
        const productsArray = Array.from(productMap.values());
        setProducts(productsArray);
        
        // Ya no necesitamos cargar imágenes en base64, usaremos protocolo local-image://
      }
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Función para cargar imágenes de productos desde carpeta procesadas
  const loadProductImages = async (productId, directory) => {
    try {
      if (window.electronAPI) {
        const procesadasDir = await window.electronAPI.joinPaths(directory, 'procesadas');
        const procesadasExists = await window.electronAPI.fileExists(procesadasDir);
        
        if (!procesadasExists) {
          console.warn('Carpeta procesadas no encontrada');
          setProductImages([]);
          return;
        }

        // Cargar mapeo de imágenes desde imagen-url.csv
        const imagenUrlCsvPath = await window.electronAPI.joinPaths(directory, 'imagen-url.csv');
        const imagenUrlExists = await window.electronAPI.fileExists(imagenUrlCsvPath);
        
        let productImageFiles = [];
        if (imagenUrlExists) {
          try {
            const imageUrlData = await window.electronAPI.readCsv(imagenUrlCsvPath);
            const productMapping = imageUrlData.find(row => row.url === productId);
            
            if (productMapping && productMapping.imagenes) {
              productImageFiles = productMapping.imagenes
                .split(',')
                .map(img => img.trim())
                .filter(img => img);
            }
          } catch (error) {
            console.warn('Error reading imagen-url.csv:', error);
          }
        }

        setProductImages(productImageFiles);
        // Ya no necesitamos cargar base64, usamos protocolo local-image://
      }
    } catch (error) {
      console.error('Error loading product images:', error);
      setProductImages([]);
    }
  };

  // DEPRECATED: Función para cargar datos de imagen como base64 - Ya no necesaria
  // const loadImageDataForFiles = async (imageFiles, directory) => {
  //   const newImageDataCache = new Map(imageDataCache); // Mantener cache existente
    
  //   for (const imageName of imageFiles) {
  //     try {
  //       // Solo cargar si no está ya en cache
  //       if (!newImageDataCache.has(imageName)) {
  //         const imagePath = await window.electronAPI.joinPaths(directory, 'procesadas', imageName);
  //         const imageData = await window.electronAPI.loadImage(imagePath);
          
  //         if (imageData) {
  //           newImageDataCache.set(imageName, imageData);
  //         }
  //       }
  //     } catch (error) {
  //       console.warn(`Error loading image ${imageName}:`, error);
  //     }
  //   }
    
  //   setImageDataCache(newImageDataCache);
  // };

  // Función para cargar productos eliminados
  const loadDeletedProducts = async () => {
    if (!workingDirectory) return;
    
    try {
      if (window.electronAPI) {
        const deletedDir = await window.electronAPI.joinPaths(workingDirectory, 'eliminados');
        const deletedCsvPath = await window.electronAPI.joinPaths(deletedDir, 'salida.csv');
        const csvExists = await window.electronAPI.fileExists(deletedCsvPath);
        
        if (!csvExists) {
          setDeletedProducts([]);
          return;
        }

        const csvData = await window.electronAPI.readCsv(deletedCsvPath);
        const productMap = new Map();
        
        csvData.forEach(row => {
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
        
        setDeletedProducts(Array.from(productMap.values()));
      }
    } catch (error) {
      console.error('Error loading deleted products:', error);
      setDeletedProducts([]);
    }
  };

  // Función para editar producto
  const editProduct = async (product) => {
    setCurrentProduct(product);
    
    // Configurar formulario básico
    setEditForm({
      name: product.name,
      categories: product.categories,
      price: product.price,
      stock: product.stock,
      variants: [...product.variants]
    });
    
    // Configurar categorías seleccionadas
    const categoriesArray = product.categories ? product.categories.split(',').map(c => c.trim()) : [];
    setSelectedCategories(new Set(categoriesArray));
    
    // Analizar variantes para configurar los controles de variación
    if (product.variants && product.variants.length > 0) {
      analyzeVariantsForEditing(product.variants);
    } else {
      resetVariantControls();
    }
    
    // Cargar imágenes del producto
    if (workingDirectory) {
      await loadProductImages(product.id, workingDirectory);
    }
    
    setView('edit');
  };

  // Función para guardar cambios del producto
  const saveProduct = async () => {
    if (!currentProduct || !workingDirectory) return;
    
    try {
      setLoading(true);
      
      // Formatear precio correctamente
      const formattedPrice = formatPrice(editForm.price);
      
      // Preparar variantes con precios formateados
      let formattedVariants = [];
      
      // Prioridad: 
      // 1. Si se han generado nuevas combinaciones, usar esas
      // 2. Si no hay nuevas combinaciones pero hay controles activos, usar las variantes del formulario
      // 3. Si no hay controles activos, crear una variante base
      
      if (editVariantCombinations.length > 0) {
        // Si hay nuevas combinaciones generadas - formatear precios solo al guardar
        formattedVariants = editVariantCombinations.map(variant => ({
          properties: variant.properties || [],
          price: formatPrice(variant.price),
          stock: variant.stock || '0'
        }));
      } else if ((useColor || useSize || useType) && editForm.variants && editForm.variants.length > 0) {
        // Si hay controles de variantes activos y variantes en el formulario - formatear precios solo al guardar
        formattedVariants = editForm.variants.map(variant => ({
          properties: variant.properties || [],
          price: formatPrice(variant.price || editForm.price),
          stock: variant.stock || '0'
        }));
      } else {
        // Si no hay variantes específicas, crear una variante base
        formattedVariants = [{
          properties: [],
          price: formattedPrice,
          stock: editForm.stock || '0'
        }];
      }
      
      // Preparar datos del formulario antes de guardar
      const formDataToSave = {
        name: editForm.name,
        categories: [...selectedCategories].join(', '), // Actualizar categorías desde selectedCategories
        price: formattedPrice, // Precio principal formateado
        stock: editForm.stock,
        variants: formattedVariants
      };
      
      // Actualizar producto en CSV
      const result = await window.electronAPI.updateProductInCsv(
        workingDirectory, 
        currentProduct.id, 
        formDataToSave
      );
      
      if (result.success) {
        // Actualizar estado local
        const updatedProducts = products.map(p => 
          p.id === currentProduct.id 
            ? { ...p, ...formDataToSave }
            : p
        );
        
        setProducts(updatedProducts);
        setView('list');
        setCurrentProduct(null);
        
        // Resetear estados de edición
        resetVariantControls();
        setEditActiveTab('general');
      } else {
        console.error('Error del servidor:', result.error);
        alert(`Error al guardar producto: ${result.error}`);
      }
      
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error al guardar el producto');
    } finally {
      setLoading(false);
    }
  };

  // Función para eliminar producto
  const deleteProduct = async (product) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar el producto "${product.name}"?`)) {
      return;
    }
    
    try {
      setLoading(true);
      
      const result = await window.electronAPI.deleteProduct(workingDirectory, product.id);
      
      if (result.success) {
        // Remover del estado local
        setProducts(products.filter(p => p.id !== product.id));
        
        // Regresar a la vista de lista de productos
        setView('list');
        setCurrentProduct(null);
        
        alert(`Producto eliminado correctamente. Se movieron ${result.deletedImages} imágenes y ${result.deletedVariants} variantes a la carpeta 'eliminados'.`);
      } else {
        alert(`Error al eliminar producto: ${result.error}`);
      }
      
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Error al eliminar el producto');
    } finally {
      setLoading(false);
    }
  };

  // Función para limpiar CSV manualmente
  const restoreProduct = async (product) => {
    if (!confirm(`¿Estás seguro de que quieres restaurar el producto "${product.name}"?`)) {
      return;
    }
    
    try {
      setLoading(true);
      
      const result = await window.electronAPI.restoreProduct(workingDirectory, product.id);
      
      if (result.success) {
        // Remover de productos eliminados
        setDeletedProducts(deletedProducts.filter(p => p.id !== product.id));
        
        // Recargar productos principales
        await loadProducts(workingDirectory);
        
        alert(`Producto restaurado correctamente. Se restauraron ${result.restoredImages} imágenes y ${result.restoredVariants} variantes.`);
      } else {
        alert(`Error al restaurar producto: ${result.error}`);
      }
      
    } catch (error) {
      console.error('Error restoring product:', error);
      alert('Error al restaurar el producto');
    } finally {
      setLoading(false);
    }
  };

  // Función para eliminar imagen permanentemente
  const deleteImage = async (imageName) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar permanentemente la imagen "${imageName}"?`)) {
      return;
    }
    
    try {
      if (window.electronAPI && workingDirectory) {
        // Las imágenes están en la carpeta procesadas
        const procesadasDir = await window.electronAPI.joinPaths(workingDirectory, 'procesadas');
        const imagePath = await window.electronAPI.joinPaths(procesadasDir, imageName);
        const result = await window.electronAPI.deleteImagePermanently(imagePath);
        
        if (result.success) {
          // Actualizar estado local
          setProductImages(productImages.filter(img => img !== imageName));
          
          // Limpiar cache de imagen
          const newCache = new Map(imageDataCache);
          newCache.delete(imageName);
          setImageDataCache(newCache);
          
          // También actualizar el archivo imagen-url.csv
          await window.electronAPI.updateImageUrlCsv(workingDirectory, currentProduct.id, imageName, 'remove');
        } else {
          alert(`Error al eliminar imagen: ${result.error}`);
        }
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Error al eliminar la imagen');
    }
  };

  // Funciones auxiliares para manejo de variantes
  const resetVariantControls = () => {
    setUseColor(false);
    setUseSize(false);
    setUseType(false);
    setSelectedColors([]);
    setSelectedSizes([]);
    setTypeName('');
    setTypeValues('');
    setEditVariantCombinations([]);
  };

  const analyzeVariantsForEditing = (variants) => {
    if (!variants || variants.length === 0) {
      resetVariantControls();
      return;
    }

    // Resetear controles
    resetVariantControls();

    // Analizar propiedades de las variantes
    const colorsSet = new Set();
    const sizesSet = new Set();
    const typesMap = new Map();

    variants.forEach(variant => {
      variant.properties.forEach(prop => {
        if (prop.name === 'Color') {
          colorsSet.add(prop.value);
        } else if (prop.name === 'Talle') {
          sizesSet.add(prop.value);
        } else {
          // Otros tipos
          if (!typesMap.has(prop.name)) {
            typesMap.set(prop.name, new Set());
          }
          typesMap.get(prop.name).add(prop.value);
        }
      });
    });

    // Configurar colores
    if (colorsSet.size > 0) {
      setUseColor(true);
      setSelectedColors([...colorsSet]);
    }

    // Configurar talles
    if (sizesSet.size > 0) {
      setUseSize(true);
      setSelectedSizes([...sizesSet]);
    }

    // Configurar tipos personalizados
    if (typesMap.size > 0) {
      const [firstTypeName, firstTypeValues] = typesMap.entries().next().value;
      setUseType(true);
      setTypeName(firstTypeName);
      setTypeValues([...firstTypeValues].join('\n'));
    }

    // Convertir variantes al formato de edición
    const convertedVariants = variants.map((variant, index) => ({
      id: index,
      properties: variant.properties,
      price: variant.price || '0',
      stock: variant.stock || '10'
    }));

    setEditVariantCombinations(convertedVariants);
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

    // Actualizar editForm con las categorías seleccionadas
    const categoriesStr = [...selectedCategories].join(', ');
    setEditForm(prev => ({ ...prev, categories: categoriesStr }));
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

  // Seleccionar/limpiar todos los colores
  const selectAllColors = () => {
    if (config && config.variants && config.variants.colors) {
      setSelectedColors([...config.variants.colors]);
    }
  };

  const clearAllColors = () => {
    setSelectedColors([]);
  };

  // Seleccionar/limpiar todos los talles
  const selectAllSizes = () => {
    if (config && config.variants && config.variants.sizes) {
      setSelectedSizes([...config.variants.sizes]);
    }
  };

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
      setEditVariantCombinations([]);
      setEditForm(prev => ({ ...prev, variants: [] }));
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
      price: editForm.price || '0', // No formatear aquí, usar el precio tal como está
      stock: '10'
    }));

    setEditVariantCombinations(variantData);
    
    // Actualizar editForm con las nuevas variantes
    const formattedVariants = variantData.map(variant => ({
      properties: variant.properties,
      price: variant.price,
      stock: variant.stock
    }));
    
    setEditForm(prev => ({ ...prev, variants: formattedVariants }));
  };

  // Actualizar precio de variante
  const updateVariantPrice = (variantId, price) => {
    // No formatear inmediatamente, solo almacenar el valor tal como lo escribe el usuario
    setEditVariantCombinations(prev =>
      prev.map(v => v.id === variantId ? { ...v, price } : v)
    );
    
    // Actualizar también en editForm
    setEditForm(prev => {
      const updatedVariants = [...prev.variants];
      if (updatedVariants[variantId]) {
        updatedVariants[variantId].price = price;
      }
      return { ...prev, variants: updatedVariants };
    });
  };

  // Actualizar stock de variante
  const updateVariantStock = (variantId, stock) => {
    setEditVariantCombinations(prev =>
      prev.map(v => v.id === variantId ? { ...v, stock } : v)
    );
    
    // Actualizar también en editForm
    setEditForm(prev => {
      const updatedVariants = [...prev.variants];
      if (updatedVariants[variantId]) {
        updatedVariants[variantId].stock = stock;
      }
      return { ...prev, variants: updatedVariants };
    });
  };

  // Función para formatear precio correctamente
  const formatPrice = (priceInput) => {
    if (!priceInput) return '0.00';
    
    // Remover todo lo que no sea número o coma/punto
    let cleanPrice = priceInput.toString().replace(/[^\d,.]/g, '');
    
    // Si está vacío, retornar 0.00
    if (!cleanPrice) return '0.00';
    
    // Convertir a número para procesamiento
    let numberValue;
    
    // Si contiene tanto coma como punto, asumir que el último es decimal
    if (cleanPrice.includes(',') && cleanPrice.includes('.')) {
      const lastComma = cleanPrice.lastIndexOf(',');
      const lastDot = cleanPrice.lastIndexOf('.');
      
      if (lastDot > lastComma) {
        // Punto es decimal, coma es separador de miles
        numberValue = parseFloat(cleanPrice.replace(/,/g, ''));
      } else {
        // Coma es decimal, punto es separador de miles  
        numberValue = parseFloat(cleanPrice.replace(/\./g, '').replace(',', '.'));
      }
    } else if (cleanPrice.includes(',')) {
      // Solo comas - puede ser decimal o separador de miles
      const commaCount = (cleanPrice.match(/,/g) || []).length;
      if (commaCount === 1 && cleanPrice.indexOf(',') > cleanPrice.length - 4) {
        // Probablemente decimal (coma cerca del final)
        numberValue = parseFloat(cleanPrice.replace(',', '.'));
      } else {
        // Probablemente separador de miles
        numberValue = parseFloat(cleanPrice.replace(/,/g, ''));
      }
    } else if (cleanPrice.includes('.')) {
      // Solo puntos - puede ser decimal o separador de miles
      const dotCount = (cleanPrice.match(/\./g) || []).length;
      if (dotCount === 1 && cleanPrice.indexOf('.') > cleanPrice.length - 4) {
        // Probablemente decimal (punto cerca del final)
        numberValue = parseFloat(cleanPrice);
      } else {
        // Probablemente separador de miles
        numberValue = parseFloat(cleanPrice.replace(/\./g, ''));
      }
    } else {
      // Solo números
      numberValue = parseFloat(cleanPrice);
    }
    
    // Si no es un número válido, retornar 0.00
    if (isNaN(numberValue)) return '0.00';
    
    // Formatear como número con coma para miles y punto para decimales (formato americano/internacional)
    return numberValue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Función para manejar cambios en el textarea de valores y mostrar sugerencias
  const handleTypeValuesChange = (e) => {
    const currentValue = e.target.value;
    setTypeValues(currentValue);

    if (currentValue.trim() === '' || currentValue.includes('\n')) {
      setValueSuggestions([]);
      return;
    }

    const suggestions = [];
    const predefinedTypes = config?.variants?.predefinedTypes || [];
    predefinedTypes.forEach(type => {
      if (type?.values && Array.isArray(type.values)) {
        type.values.forEach(value => {
          if (value.toLowerCase().includes(currentValue.toLowerCase())) {
            suggestions.push({ value, type });
          }
        });
      }
    });
    setValueSuggestions(suggestions.slice(0, 10)); // Limitar a 10 sugerencias
  };

  // Función para seleccionar tipo predefinido
  const selectPredefinedType = (type) => {
    setTypeName(type.name);
    if (Array.isArray(type.values)) {
      setTypeValues(type.values.join('\n'));
    } else {
      setTypeValues('');
    }
    setValueSuggestions([]);
  };

  // Función para seleccionar sugerencia de valor
  const selectValueSuggestion = (suggestion) => {
    setTypeValues(suggestion.value);
    setValueSuggestions([]);
  };

  // Filtrar productos según término de búsqueda
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.categories.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Cargar productos eliminados cuando se cambia a esa vista
  useEffect(() => {
    if (view === 'deleted') {
      loadDeletedProducts();
    }
  }, [view, workingDirectory]);

  // Renderizado principal
  return (
    <div className="min-h-screen bg-gray-900 text-white p-1">
      {!workingDirectory ? (
        <DirectorySelector 
          selectWorkingDirectory={selectWorkingDirectory}
          workingDirectory={workingDirectory}
          setActiveTab={setActiveTab}
        />
      ) : (
        <div className="space-y-6">
          {view === 'list' && (
            <ListView 
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              filteredProducts={filteredProducts}
              loading={loading}
              setActiveTab={setActiveTab}
              setView={setView}
              editProduct={editProduct}
              workingDirectory={workingDirectory}
            />
          )}
          {view === 'edit' && (
            <EditView 
              currentProduct={currentProduct}
              editForm={editForm}
              updateEditForm={updateEditForm}
              updateVariant={updateVariant}
              setView={setView}
              deleteProduct={deleteProduct}
              saveProduct={saveProduct}
              productImages={productImages}
              workingDirectory={workingDirectory}
              deleteImage={deleteImage}
              config={config}
              selectedCategories={selectedCategories}
              toggleCategory={toggleCategory}
              editActiveTab={editActiveTab}
              setEditActiveTab={setEditActiveTab}
              useColor={useColor}
              setUseColor={setUseColor}
              useSize={useSize}
              setUseSize={setUseSize}
              useType={useType}
              setUseType={setUseType}
              selectedColors={selectedColors}
              selectedSizes={selectedSizes}
              typeName={typeName}
              setTypeName={setTypeName}
              typeValues={typeValues}
              setTypeValues={setTypeValues}
              editVariantCombinations={editVariantCombinations}
              toggleColor={toggleColor}
              toggleSize={toggleSize}
              selectAllColors={selectAllColors}
              clearAllColors={clearAllColors}
              selectAllSizes={selectAllSizes}
              clearAllSizes={clearAllSizes}
              generateVariantCombinations={generateVariantCombinations}
              updateVariantPrice={updateVariantPrice}
              updateVariantStock={updateVariantStock}
              valueSuggestions={valueSuggestions}
              handleTypeValuesChange={handleTypeValuesChange}
              selectPredefinedType={selectPredefinedType}
              selectValueSuggestion={selectValueSuggestion}
            />
          )}
          {view === 'deleted' && (
            <DeletedView 
              deletedProducts={deletedProducts}
              setView={setView}
              restoreProduct={restoreProduct}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default ProductsTab;