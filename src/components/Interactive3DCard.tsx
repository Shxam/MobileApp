import React, { useState, useRef } from 'react';

interface Interactive3DCardProps {
  children: React.ReactNode;
  className?: string;
  depth?: number; // translateZ for inner content
  onClick?: () => void;
}

export const Interactive3DCard: React.FC<Interactive3DCardProps> = ({
  children,
  className = '',
  depth = 30,
  onClick,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;

    // Calculate rotation angles (max ~15deg)
    const rotateX = (-mouseY / (rect.height / 2)) * 14;
    const rotateY = (mouseX / (rect.width / 2)) * 14;

    setRotation({ x: rotateX, y: rotateY });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotation({ x: 0, y: 0 });
  };

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`perspective-1000 cursor-pointer ${className}`}
    >
      <div
        className="preserve-3d transition-transform duration-200 ease-out w-full h-full"
        style={{
          transform: isHovered
            ? `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale3d(1.02, 1.02, 1.02)`
            : 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
        }}
      >
        <div
          className="w-full h-full preserve-3d"
          style={{
            transform: isHovered ? `translateZ(${depth}px)` : 'translateZ(0px)',
            transition: 'transform 0.3s ease-out',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
