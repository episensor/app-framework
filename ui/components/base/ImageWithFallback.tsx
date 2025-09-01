import React from 'react';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallbackSrc?: string;
  hideOnError?: boolean;
}

/**
 * Image component with fallback support
 * Handles image loading errors gracefully by either showing a fallback image or hiding the element
 */
export function ImageWithFallback({ 
  src, 
  fallbackSrc, 
  hideOnError = false,
  onError,
  ...props 
}: ImageWithFallbackProps) {
  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    
    if (hideOnError) {
      target.style.display = 'none';
    } else if (fallbackSrc && target.src !== fallbackSrc) {
      target.src = fallbackSrc;
    }
    
    // Call original onError if provided
    if (onError) {
      onError(e);
    }
  };

  return (
    <img 
      src={src} 
      onError={handleError}
      {...props}
    />
  );
}

export default ImageWithFallback;