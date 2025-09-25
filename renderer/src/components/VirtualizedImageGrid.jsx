import { useState, useEffect, useMemo } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import LazyImage from './components/LazyImage';

const VirtualizedImageGrid = ({ 
  images, 
  workingDirectory, 
  selectedImages, 
  primaryImage, 
  existingPrimaryImages,
  onImageClick,
  onSetPrimary,
  getBorderColor,
  containerHeight = 500,
  itemsPerRow = 8,
  itemWidth = 150,
  itemHeight = 180
}) => {
  const gridData = useMemo(() => {
    const rows = Math.ceil(images.length / itemsPerRow);
    const data = [];
    
    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      const rowItems = [];
      for (let colIndex = 0; colIndex < itemsPerRow; colIndex++) {
        const imageIndex = rowIndex * itemsPerRow + colIndex;
        if (imageIndex < images.length) {
          rowItems.push(images[imageIndex]);
        } else {
          rowItems.push(null);
        }
      }
      data.push(rowItems);
    }
    
    return { rows, data };
  }, [images, itemsPerRow]);

  const Cell = ({ columnIndex, rowIndex, style }) => {
    const imageName = gridData.data[rowIndex]?.[columnIndex];
    
    if (!imageName) {
      return <div style={style} />;
    }

    return (
      <div style={style} className="p-2">
        <div
          className={`relative border-4 rounded-lg overflow-hidden cursor-pointer transition-all ${getBorderColor(imageName)}`}
          onClick={() => onImageClick(imageName)}
        >
          <LazyImage
            imagePath={`${workingDirectory}\\${imageName}`}
            alt={imageName}
            className="w-full h-32 object-cover"
          />
          
          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
            {imageName}
          </div>
          
          {selectedImages.includes(imageName) && (
            <div className="absolute top-1 right-1">
              <button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onSetPrimary(imageName); 
                }}
                className={`w-6 h-6 rounded-full text-xs font-bold ${
                  imageName === primaryImage 
                    ? 'bg-yellow-500 text-white' 
                    : 'bg-gray-200 text-gray-800 hover:bg-yellow-300'
                }`}
                title="Marcar como principal"
              >
                P
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Grid
      height={containerHeight}
      width="100%"
      columnCount={itemsPerRow}
      columnWidth={itemWidth}
      rowCount={gridData.rows}
      rowHeight={itemHeight}
    >
      {Cell}
    </Grid>
  );
};

export default VirtualizedImageGrid;