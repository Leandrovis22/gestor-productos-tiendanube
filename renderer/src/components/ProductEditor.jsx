// components/ProductEditor.js

// Sección del formulario general (movido fuera del componente principal)
const GeneralForm = ({
  productName,
  setProductName,
  productPrice,
  setProductPrice,
  productStock,
  setProductStock,
  selectedCategories,
  categories,
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
        <div className="p-3 bg-gray-800 border border-gray-700 rounded min-h-[60px]">
          {selectedCategories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedCategories.map(cat => (
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
      <div className="max-h-64 overflow-y-auto border border-gray-700 rounded p-2 bg-gray-800">
        <div className="grid grid-cols-2 gap-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => onToggleCategory(category)}
              className={`w-full text-left text-sm px-3 py-2 rounded ${
                selectedCategories.includes(category)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
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
  onGenerateVariants, variantCombinations, onUpdateVariantPrice, onUpdateVariantStock
}) => {
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

  const filteredTypes = predefinedTypes.filter(pt => pt.name.toLowerCase().includes(typeName.toLowerCase()));

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
        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* Sección de Colores */}
          <div className="border border-gray-600 rounded p-3">
            <label className="flex items-center gap-2 mb-3">
              <input type="checkbox" checked={useColor} onChange={(e) => setUseColor(e.target.checked)} />
              <span className="font-medium">Color</span>
            </label>
            {useColor && (
              <div>
                <div className="flex flex-wrap gap-2 mb-2 p-2 bg-gray-900/50 rounded">
                  {predefinedColors.map(color => (
                    <button
                      key={color}
                      onClick={() => onToggleColor(color)}
                      className={`px-3 py-1 text-xs font-medium rounded-full border-2 ${selectedColors.includes(color) ? 'border-cyan-400' : 'border-transparent'}`}
                      style={{
                        background: colorMap[color] || '#FFFFFF',
                        color: getFontColor(colorMap[color]),
                        backgroundImage: color === 'Multicolor' ? colorMap[color] : 'none',
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

          {/* Sección de Tipos personalizados */}
          <div className="border border-gray-600 rounded p-3">
            <div className="flex items-center gap-2 mb-3">
              <input type="checkbox" checked={useType} onChange={(e) => setUseType(e.target.checked)} />
              <input type="text" placeholder="Nombre (ej: Material)" value={typeName} onChange={(e) => setTypeName(e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm" />
            </div>
            {useType && (
              <div>
                {typeName && filteredTypes.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-gray-400 mb-1">Sugerencias:</p>
                    <div className="max-h-20 overflow-y-auto flex flex-col gap-1">
                      {filteredTypes.map(pt => (
                        <button key={pt.name} onClick={() => onSelectPredefinedType(pt)} className="text-left text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">
                          {pt.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <label className="block text-xs text-gray-400 mb-1">Valores (uno por línea):</label>
                <textarea 
                  placeholder="Valor A&#10;Valor B&#10;Valor C"
                  value={typeValues} onChange={(e) => setTypeValues(e.target.value)} 
                  className="w-full h-24 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm" />
                <p className="text-xs text-gray-500 mt-1">(Un valor por línea)</p>
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
          selectedSizes={selectedSizes} onToggleSize={onToggleSize} onSelectAllSizes={onSelectAllSizes} onClearAllSizes={onClearAllSizes} predefinedSizes={predefinedSizes} predefinedTypes={predefinedTypes} onSelectPredefinedType={onSelectPredefinedType} // Pasamos las props
          typeName={typeName} setTypeName={setTypeName} typeValues={typeValues} setTypeValues={setTypeValues}
          onGenerateVariants={onGenerateVariants} variantCombinations={variantCombinations} onUpdateVariantPrice={onUpdateVariantPrice} onUpdateVariantStock={onUpdateVariantStock}
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