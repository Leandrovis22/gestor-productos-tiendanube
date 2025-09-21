# inpaint.py
import cv2
import numpy as np
import sys
import os

def inpaint_image(image_path, mask_path, output_path, radius=3):
    """
    Apply Telea inpainting to an image using the provided mask.
    
    Args:
        image_path: Path to the input image
        mask_path: Path to the mask image (white areas will be inpainted)
        output_path: Path to save the inpainted result
        radius: Inpainting radius (3-5 recommended)
    
    Returns:
        bool: Success status
    """
    try:
        # Read the original image
        img = cv2.imread(image_path)
        if img is None:
            print(f"Error: Could not load image from {image_path}")
            return False
        
        # Read the mask
        mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
        if mask is None:
            print(f"Error: Could not load mask from {mask_path}")
            return False
        
        # Ensure mask dimensions match image dimensions
        if mask.shape[:2] != img.shape[:2]:
            mask = cv2.resize(mask, (img.shape[1], img.shape[0]))
        
        # Ensure mask is binary (0 or 255)
        _, mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)
        
        # Apply Telea inpainting
        result = cv2.inpaint(img, mask, inpaintRadius=radius, flags=cv2.INPAINT_TELEA)
        
        # Save the result
        success = cv2.imwrite(output_path, result, [cv2.IMWRITE_JPEG_QUALITY, 98])
        if not success:
            print(f"Error: Could not save result to {output_path}")
            return False
        
        print(f"Inpainting completed successfully. Output saved to {output_path}")
        return True
        
    except Exception as e:
        print(f"Error during inpainting: {str(e)}")
        return False

def main():
    if len(sys.argv) != 4 and len(sys.argv) != 5:
        print("Usage: python inpaint.py <image_path> <mask_path> <output_path> [radius]")
        print("Example: python inpaint.py input.jpg mask.png output.jpg 3")
        sys.exit(1)
    
    image_path = sys.argv[1]
    mask_path = sys.argv[2]
    output_path = sys.argv[3]
    radius = int(sys.argv[4]) if len(sys.argv) == 5 else 3
    
    # Validate input files exist
    if not os.path.exists(image_path):
        print(f"Error: Image file does not exist: {image_path}")
        sys.exit(1)
    
    if not os.path.exists(mask_path):
        print(f"Error: Mask file does not exist: {mask_path}")
        sys.exit(1)
    
    # Ensure output directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
    
    # Perform inpainting
    success = inpaint_image(image_path, mask_path, output_path, radius)
    
    if success:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()