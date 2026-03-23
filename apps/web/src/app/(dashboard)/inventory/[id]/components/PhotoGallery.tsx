'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Camera,
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  ImageOff,
} from 'lucide-react';
import { getUnitPhotos, uploadUnitPhoto, deleteUnitPhoto, type UnitPhoto } from '@/lib/api';

interface PhotoGalleryProps {
  unitId: string;
}

export default function PhotoGallery({ unitId }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<UnitPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPhotos = useCallback(async () => {
    try {
      setError(null);
      const data = await getUnitPhotos(unitId);
      setPhotos(data.sort((a, b) => a.sort_order - b.sort_order));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load photos');
    } finally {
      setLoading(false);
    }
  }, [unitId]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  // Close lightbox on Escape key
  useEffect(() => {
    if (lightboxIndex === null) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowLeft') navigateLightbox(-1);
      if (e.key === 'ArrowRight') navigateLightbox(1);
    }

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [lightboxIndex, photos.length]);

  function navigateLightbox(direction: number) {
    setLightboxIndex((prev) => {
      if (prev === null || photos.length === 0) return null;
      const next = prev + direction;
      if (next < 0) return photos.length - 1;
      if (next >= photos.length) return 0;
      return next;
    });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const uploaded = await uploadUnitPhoto(unitId, file);
      setPhotos((prev) => [...prev, uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload photo');
    } finally {
      setUploading(false);
      // Reset the file input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function handleDelete(photoId: string) {
    setDeleting(photoId);
    setError(null);

    try {
      await deleteUnitPhoto(unitId, photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      // If the deleted photo was open in lightbox, close or adjust
      if (lightboxIndex !== null) {
        const deletedIdx = photos.findIndex((p) => p.id === photoId);
        if (deletedIdx === lightboxIndex) {
          if (photos.length <= 1) {
            setLightboxIndex(null);
          } else if (lightboxIndex >= photos.length - 1) {
            setLightboxIndex(photos.length - 2);
          }
        } else if (deletedIdx < lightboxIndex) {
          setLightboxIndex(lightboxIndex - 1);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete photo');
    } finally {
      setDeleting(null);
    }
  }

  const uploadButton = (
    <button
      type="button"
      onClick={() => fileInputRef.current?.click()}
      disabled={uploading}
      className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] shadow-sm transition-colors hover:bg-[var(--color-bg-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      {uploading ? 'Uploading...' : 'Upload Photo'}
    </button>
  );

  const hiddenInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      onChange={handleUpload}
      className="hidden"
    />
  );

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 w-24 animate-pulse rounded bg-[var(--color-bg-tertiary)]" />
          <div className="h-9 w-32 animate-pulse rounded-lg bg-[var(--color-bg-tertiary)]" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/3] animate-pulse rounded-xl bg-[var(--color-bg-tertiary)]"
            />
          ))}
        </div>
      </div>
    );
  }

  // ---- Empty state ----
  if (photos.length === 0 && !error) {
    return (
      <div className="space-y-4">
        {hiddenInput}
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--color-border)] px-6 py-16">
          <Camera className="h-12 w-12 text-[var(--color-text-tertiary)]" />
          <p className="mt-4 text-base font-medium text-[var(--color-text-primary)]">
            No photos yet
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Upload photos to showcase this unit.
          </p>
          <div className="mt-6">{uploadButton}</div>
        </div>
      </div>
    );
  }

  // ---- Gallery ----
  return (
    <div className="space-y-4">
      {hiddenInput}

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">
          {photos.length} photo{photos.length !== 1 ? 's' : ''}
        </p>
        {uploadButton}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Photo grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            className="group relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-sm transition-shadow hover:shadow-md"
          >
            {/* Thumbnail */}
            <button
              type="button"
              onClick={() => setLightboxIndex(index)}
              className="block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <div className="relative aspect-[4/3]">
                <img
                  src={photo.thumbnail_url || photo.url}
                  alt={photo.caption || `Unit photo ${index + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling;
                    if (fallback) (fallback as HTMLElement).style.display = 'flex';
                  }}
                />
                <div className="hidden h-full w-full items-center justify-center bg-[var(--color-bg-tertiary)]">
                  <ImageOff className="h-8 w-8 text-[var(--color-text-tertiary)]" />
                </div>
              </div>
            </button>

            {/* Caption */}
            {photo.caption && (
              <div className="px-3 py-2">
                <p className="truncate text-sm text-[var(--color-text-secondary)]">
                  {photo.caption}
                </p>
              </div>
            )}

            {/* Delete overlay */}
            <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(photo.id);
                }}
                disabled={deleting === photo.id}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80 disabled:cursor-not-allowed"
                title="Delete photo"
              >
                {deleting === photo.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox modal */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxIndex(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Previous button */}
          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigateLightbox(-1);
              }}
              className="absolute left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          {/* Image + caption */}
          <div
            className="flex max-h-[90vh] max-w-[90vw] flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={photos[lightboxIndex].url}
              alt={photos[lightboxIndex].caption || `Unit photo ${lightboxIndex + 1}`}
              className="max-h-[80vh] max-w-full rounded-lg object-contain"
            />
            {photos[lightboxIndex].caption && (
              <p className="mt-3 max-w-lg text-center text-sm text-white/80">
                {photos[lightboxIndex].caption}
              </p>
            )}
            <p className="mt-1 text-xs text-white/50">
              {lightboxIndex + 1} / {photos.length}
            </p>
          </div>

          {/* Next button */}
          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigateLightbox(1);
              }}
              className="absolute right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
              aria-label="Next photo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
