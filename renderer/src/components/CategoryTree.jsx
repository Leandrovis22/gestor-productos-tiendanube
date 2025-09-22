// components/CategoryTree.jsx
import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

const CategoryNode = ({ name, node, selectedCategories, onToggleCategory, level = 0 }) => {
  const [isOpen, setIsOpen] = useState(level < 1); // Expandir el primer nivel por defecto
  const children = Object.keys(node._children);
  const hasChildren = children.length > 0;

  const isSelected = selectedCategories.has(node._fullPath);

  // Si el nodo tiene hijos, actúa como un expansor.
  // Si no tiene hijos, es una categoría seleccionable.
  const handleClick = () => {
    if (hasChildren) {
      setIsOpen(!isOpen);
    } else {
      onToggleCategory(node._fullPath);
    }
  };

  return (
    <div style={{ paddingLeft: `${level * 20}px` }}>
      <button
        onClick={handleClick}
        className={`w-full text-left flex items-center gap-2 py-2 px-2 rounded ${
          hasChildren
            ? 'hover:bg-gray-700/50' // Estilo para nodos que son carpetas
            : isSelected
              ? 'bg-blue-600 text-white' // Estilo para categoría seleccionada
              : 'bg-gray-700 hover:bg-gray-600' // Estilo para categoría no seleccionada
        }`}
      >
        {hasChildren && (
          isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
        )}
        <span className={`flex-1 ${!hasChildren && isSelected ? 'font-semibold' : ''}`}>
          {name}
        </span>
      </button>

      {isOpen && hasChildren && (
        <div className="mt-1 space-y-1">
          {children.map(childName => (
            <CategoryNode
              key={childName}
              name={childName}
              node={node._children[childName]}
              selectedCategories={selectedCategories}
              onToggleCategory={onToggleCategory}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const CategoryTree = ({ tree, selectedCategories, onToggleCategory }) => (
  <div className="space-y-1">
    {Object.keys(tree).map(rootName => (
      <CategoryNode key={rootName} name={rootName} node={tree[rootName]} selectedCategories={selectedCategories} onToggleCategory={onToggleCategory} />
    ))}
  </div>
);