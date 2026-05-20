import { useEffect, useRef } from 'react';
import bwipjs from 'bwip-js';

interface BarcodeProps {
  value: string;
  type: 'barcode' | 'qrcode';
  width?: number;
  height?: number;
  showText?: boolean;
  textSize?: number;
}

export default function Barcode({
  value,
  type,
  width = 200,
  height = 80,
  showText = true,
  textSize = 10
}: BarcodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;

    try {
      if (type === 'qrcode') {
        bwipjs.toCanvas(canvasRef.current, {
          bcid: 'qrcode',
          text: value,
          scale: 3,
          height: Math.min(width, height) / 3,
          width: Math.min(width, height) / 3,
          includetext: false,
        });
      } else {
        bwipjs.toCanvas(canvasRef.current, {
          bcid: 'code128',
          text: value,
          scale: 2,
          height: showText ? height * 0.6 : height * 0.8,
          includetext: showText,
          textxalign: 'center',
          textsize: textSize,
        });
      }
    } catch (err) {
      console.error('Barcode generation error:', err);
      // Draw error placeholder
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#fee2e2';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#ef4444';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Invalid code', width / 2, height / 2);
      }
    }
  }, [value, type, width, height, showText, textSize]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        maxWidth: width,
        maxHeight: height,
        display: 'block',
      }}
    />
  );
}

// Utility function to generate barcode as data URL (for printing/exporting)
export async function generateBarcodeDataURL(
  value: string,
  type: 'barcode' | 'qrcode',
  options?: {
    width?: number;
    height?: number;
    showText?: boolean;
  }
): Promise<string> {
  const canvas = document.createElement('canvas');
  const { width = 200, height = 80, showText = true } = options || {};

  try {
    if (type === 'qrcode') {
      bwipjs.toCanvas(canvas, {
        bcid: 'qrcode',
        text: value,
        scale: 3,
        height: Math.min(width, height) / 3,
        width: Math.min(width, height) / 3,
        includetext: false,
      });
    } else {
      bwipjs.toCanvas(canvas, {
        bcid: 'code128',
        text: value,
        scale: 2,
        height: showText ? height * 0.6 : height * 0.8,
        includetext: showText,
        textxalign: 'center',
      });
    }
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.error('Barcode generation error:', err);
    return '';
  }
}
