/**
 * @file main.jsx
 * @description Este es el punto de entrada principal de la aplicación React.
 * Se encarga de renderizar el componente raíz, `TiendaNubeProductManager`, en el elemento del DOM con el id 'root'.
 * También importa el archivo de estilos principal `index.css` para que se aplique a toda la aplicación.
 */

import { createRoot } from 'react-dom/client'
import './index.css'
import TiendaNubeProductManager from './components/TiendaNubeProductManager'


createRoot(document.getElementById('root')).render(
    <TiendaNubeProductManager />
)
