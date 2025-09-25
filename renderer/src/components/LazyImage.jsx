import { useState, useEffect, useRef } from 'react';

const LazyImage = ({ imagePath, alt, className, placeholder = null }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [src, setSrc] = useState('');
  const imgRef = useRef(null);

  // Intersection Observer para detectar cuando la imagen está visible
  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px', // Comenzar a cargar 50px antes de que sea visible
        threshold: 0.1
      }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, []);

  // Cargar imagen solo cuando está en vista
  useEffect(() => {
    if (!isInView || !imagePath) return;

    let isMounted = true;

    const loadImage = async () => {
      try {
        // Resolver el path si es una Promise
        const resolvedPath = await Promise.resolve(imagePath);
        
        // Usar el protocolo local-image en lugar de loadImage para mejor rendimiento
        const imageUrl = window.electronAPI.getLocalImageUrl(resolvedPath);
        
        // Precargar la imagen para detectar errores
        const img = new Image();
        img.onload = () => {
          if (isMounted) {
            setSrc(imageUrl);
            setIsLoaded(true);
          }
        };
        img.onerror = () => {
          console.warn(`Imagen no disponible: ${resolvedPath}`);
          if (isMounted) {
            setIsLoaded(true); // Marcar como "cargada" para mostrar placeholder
          }
        };
        img.src = imageUrl;
      } catch (error) {
        console.warn(`Error cargando imagen: ${imagePath}`, error);
        if (isMounted) {
          setIsLoaded(true);
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
    };
  }, [isInView, imagePath]);

  return (
    <div ref={imgRef} className={className}>
      {!isInView || !isLoaded ? (
        // Placeholder mientras carga
        placeholder || (
          <div className={`${className} bg-gray-700 animate-pulse flex items-center justify-center`}>
            <div className="w-6 h-6 bg-gray-600 rounded"></div>
          </div>
        )
      ) : src ? (
        <img 
          src={src} 
          alt={alt} 
          className={className}
          loading="lazy"
        />
      ) : (
        // Fallback si no se pudo cargar
        <div className={`${className} bg-gray-700 flex items-center justify-center`}>
          <span className="text-gray-500 text-xs">Sin imagen</span>
        </div>
      )}
    </div>
  );
};

export default LazyImage;