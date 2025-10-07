'use client';

import React, {useState, useRef, useEffect} from 'react';
import {Dialog, DialogContent, DialogTrigger} from '../ui/dialog';
import {Button} from '../ui/button';
import Sectiontitle from './Sectiontitle';

type ImageData = {
  url: string;
  altText?: string;
};

interface ThreeDViewModalProps {
  images: ImageData[];
}

export default function ThreeDViewModal({images}: ThreeDViewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);
  const isHovering = useRef(false);

  const speed = 1; // scroll sensitivity

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isHovering.current || !barRef.current || images.length === 0) return;

      const rect = barRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const percent = relativeX / rect.width;

      const index = Math.floor(percent * speed * images.length);
      setCurrentIndex(Math.min(images.length - 1, Math.max(0, index)));
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [speed, images.length]);

  return (
    <Dialog>
      {/* Button to open modal */}
      <DialogTrigger asChild>
        <Button
          className="mt-4 bg-secondary hover:bg-primary border text-white w-48"
          size="lg"
        >
          360˚ View
        </Button>
      </DialogTrigger>

      {/* Modal content */}
      <DialogContent className="max-w-5xl bg-background border text-white p-8 rounded-2xl border-none three-d-carousel">
        <div className="w-full flex flex-col items-center justify-center select-none">
          <Sectiontitle text="360˚ View" />
          <hr />
          <br />

          {/* Image display */}
          <div className="w-full h-[60vh] flex items-center justify-center overflow-hidden">
            {images.length > 0 ? (
              <img
                src={images[currentIndex].url}
                alt={
                  images[currentIndex].altText || `Frame ${currentIndex + 1}`
                }
                className="w-auto h-full object-contain transition-opacity duration-75 ease-out"
                draggable="false"
              />
            ) : (
              <p>No 360° images available.</p>
            )}
          </div>

          {/* Scroll bar */}
          {images.length > 1 && (
            <div
              ref={barRef}
              onMouseEnter={() => (isHovering.current = true)}
              onMouseLeave={() => (isHovering.current = false)}
              className="relative w-[50%] h-12 mt-8 rounded-full bg-neutral-800 cursor-ew-resize overflow-hidden"
            >
              <div
                className="absolute top-0 left-0 h-full bg-white/70 transition-all duration-75"
                style={{
                  width: `${(currentIndex / (images.length - 1)) * 100}%`,
                }}
              />
              <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                ← Scroll →
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
