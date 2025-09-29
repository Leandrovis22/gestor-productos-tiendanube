// components/CategoryGroups.jsx
import React, { useMemo } from 'react';

/**
 * @file CategoryGroups.jsx
 * @description Este componente se encarga de mostrar y gestionar la selección de categorías de productos.
 * Las categorías se reciben como una lista de rutas completas (ej: "Joyas > Aros > Argollas").
 *
 * Funcionalidades clave:
 * - **Agrupación de categorías:** Agrupa las categorías por su nombre final (la parte después del último ' > ').
 *   Por ejemplo, "Joyas > Aros > Argollas" y "Plata > Aros > Argollas" se agruparían bajo "Argollas".
 * - **Ordenamiento inteligente:** Ordena los grupos para que aquellos que contienen categorías seleccionadas
 *   aparezcan primero, facilitando la visualización de las selecciones actuales. El resto de los grupos se ordena alfabéticamente.
 * - **Renderizado de botones:** Muestra cada ruta de categoría completa como un botón clickeable.
 * - **Gestión de selección:** Utiliza la función `onToggleCategory` (pasada como prop) para comunicar
 *   la selección o deselección de una categoría al componente padre.
 * - **Estilo dinámico:** Cambia el estilo de los botones para resaltar las categorías que están seleccionadas.
 */

/**
 * Agrupa las categorías por su nombre final (ej: "Argollas").
 * @param {string[]} categories - Lista de rutas de categorías completas.
 * @returns {Map<string, string[]>} - Un Map donde la clave es el nombre del grupo
 * y el valor es un array de las rutas de categoría completas.
 */
const groupCategoriesByName = (categories) => {
  const groups = new Map();

  categories.forEach(fullPath => {
    const parts = fullPath.split(' > ');
    const groupName = parts[parts.length - 1]; // El último elemento es el nombre del grupo

    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }
    groups.get(groupName).push(fullPath);
  });

  return groups;
};

export const CategoryGroups = ({ categories, selectedCategories, onToggleCategory }) => {
  const categoryGroups = useMemo(() => groupCategoriesByName(categories), [categories]);

  const sortedGroups = useMemo(() => {
    return Array.from(categoryGroups.entries()).sort(([groupNameA, pathsA], [groupNameB, pathsB]) => {
      const aHasSelection = pathsA.some(path => selectedCategories.has(path));
      const bHasSelection = pathsB.some(path => selectedCategories.has(path));

      if (aHasSelection && !bHasSelection) return -1; // A va primero
      if (!aHasSelection && bHasSelection) return 1;  // B va primero

      // Si ambos tienen o no tienen selección, ordenar alfabéticamente
      return groupNameA.localeCompare(groupNameB);
    });
  }, [categoryGroups, selectedCategories]);

  return (
    <div className="space-y-4">
      {sortedGroups.map(([groupName, categoryPaths]) => {
        const isGroupActive = categoryPaths.some(path => selectedCategories.has(path));
        return (<div key={groupName}>
          <h4 className="text-md font-semibold mb-2 capitalize text-gray-300">{groupName}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {categoryPaths.map(path => (
              <button
                key={path}
                onClick={() => onToggleCategory(path)}
                className={`w-full text-left text-sm px-3 py-2 rounded transition-colors duration-150 ${
                  isGroupActive && selectedCategories.has(path)
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'bg-gray-600 hover:bg-gray-500 text-gray-100'
                }`}
              >
                {path} {/* Muestra la ruta completa */}
              </button>
            ))}
          </div>
        </div>)
      })}
    </div>
  );
};