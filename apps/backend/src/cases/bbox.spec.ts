import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import { MAX_SPAN_DEGREES, bboxContains, parseBbox } from './bbox';

const TIZI = { minLng: 3.9, minLat: 36.5, maxLng: 4.4, maxLat: 36.9 };

describe('parseBbox', () => {
  it('parses the documented shape', () => {
    expect(parseBbox('3.9,36.5,4.4,36.9')).toEqual(TIZI);
  });

  it('tolerates whitespace', () => {
    expect(parseBbox(' 3.9 , 36.5 , 4.4 , 36.9 ')).toEqual(TIZI);
  });

  it('returns null when no bbox is given', () => {
    expect(parseBbox(undefined)).toBeNull();
    expect(parseBbox('')).toBeNull();
  });

  it('rejects the wrong number of values', () => {
    for (const bad of ['3.9,36.5,4.4', '3.9,36.5,4.4,36.9,5', '3.9']) {
      expect(() => parseBbox(bad)).toThrow(BadRequestException);
    }
  });

  it('rejects non-numeric values', () => {
    expect(() => parseBbox('a,b,c,d')).toThrow(/must be numbers/i);
    expect(() => parseBbox(',,,')).toThrow(/must be numbers/i);
    expect(() => parseBbox('3.9,NaN,4.4,36.9')).toThrow(/must be numbers/i);
  });

  it('rejects out-of-range coordinates', () => {
    expect(() => parseBbox('3.9,36.5,181,36.9')).toThrow(/longitudes/i);
    expect(() => parseBbox('3.9,91,4.4,36.9')).toThrow(/latitudes/i);
    expect(() => parseBbox('-181,36.5,4.4,36.9')).toThrow(/longitudes/i);
  });

  it('rejects an inverted latitude pair', () => {
    expect(() => parseBbox('3.9,36.9,4.4,36.5')).toThrow(/minLat below maxLat/i);
  });

  it('repairs an inverted longitude pair instead of failing', () => {
    // a map library that sends lat/lng in the wrong slots
    expect(parseBbox('4.4,36.5,3.9,36.9')).toEqual(TIZI);
  });

  it('rejects a bbox larger than the whole planet', () => {
    expect(() => parseBbox('-180,-90,180,90')).toThrow(/too large/i);
    expect(() => parseBbox('-100,-80,100,80')).toThrow(/too large/i);
  });

  it('accepts a country-sized box', () => {
    const algeria = { minLng: -8.7, minLat: 18.9, maxLng: 12, maxLat: 37.2 };
    expect(parseBbox('-8.7,18.9,12,37.2')).toEqual(algeria);
  });

  it('accepts a maximum-span box exactly, and rejects one degree more', () => {
    // the span is the difference, not the value: -72..72 is exactly the maximum
    expect(parseBbox(`-${MAX_SPAN_DEGREES / 2},0,${MAX_SPAN_DEGREES / 2},0`)).toBeTruthy();
    expect(() => parseBbox(`-${MAX_SPAN_DEGREES / 2},0,${MAX_SPAN_DEGREES / 2 + 1},0`)).toThrow(/too large/i);
  });
});

describe('bboxContains', () => {
  const box = { minLng: 3.9, minLat: 36.5, maxLng: 4.4, maxLat: 36.9 };

  it('includes points inside and on the border', () => {
    expect(bboxContains(box, { lat: 36.75, lng: 4.0 })).toBe(true);
    expect(bboxContains(box, { lat: 36.5, lng: 3.9 })).toBe(true);
    expect(bboxContains(box, { lat: 36.9, lng: 4.4 })).toBe(true);
  });

  it('excludes points outside', () => {
    expect(bboxContains(box, { lat: 36.75, lng: 5.0 })).toBe(false);
    expect(bboxContains(box, { lat: 35.0, lng: 4.0 })).toBe(false);
  });
});
