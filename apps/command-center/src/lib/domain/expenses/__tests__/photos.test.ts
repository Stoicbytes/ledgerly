import { dataUrlBytes, PHOTO_MAX_BYTES, photoError } from '../photos';

describe('photos', () => {
  it('accepts common photo types up to 10 MB', () => {
    expect(photoError('image/jpeg', 1_000)).toBeNull();
    expect(photoError('IMAGE/PNG', PHOTO_MAX_BYTES)).toBeNull();
    expect(photoError('image/heic', 5)).toBeNull();
  });

  it('rejects other files and oversized photos', () => {
    expect(photoError('application/pdf', 10)).toMatch(/Choose a photo/);
    expect(photoError('image/svg+xml', 10)).toMatch(/Choose a photo/);
    expect(photoError(null, 10)).toMatch(/Choose a photo/);
    expect(photoError('image/jpeg', PHOTO_MAX_BYTES + 1)).toMatch(/larger than 10 MB/);
  });

  it('measures data URLs', () => {
    expect(dataUrlBytes('data:image/png;base64,AAAA')).toBe(3);
    expect(dataUrlBytes('data:image/png;base64,AAA=')).toBe(2);
    expect(dataUrlBytes('file:///photo.jpg')).toBe(0);
  });
});
