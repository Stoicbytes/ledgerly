import { mediaUrl, type SiteConfig } from '../lib/config';
import type { Media } from '../lib/types';

type Props = {
  media: Media;
  config: SiteConfig | null;
  /** How wide the image is shown, for picking the small or large file. */
  sizes: string;
  className?: string;
  /** The first large image on the page: load at once instead of lazily. */
  priority?: boolean;
  style?: React.CSSProperties;
};

/**
 * An uploaded image with its true width and height (no layout shift), a small and a
 * large file to choose from, lazy loading, and the alt text written in the dashboard.
 */
export function Img({ media, config, sizes, className, priority, style }: Props) {
  const src = mediaUrl(config, media.path);
  const srcSet = media.small
    ? `${mediaUrl(config, media.small)} 640w, ${src} ${Math.max(641, Math.round(media.width))}w`
    : undefined;
  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      width={Math.round(media.width)}
      height={Math.round(media.height)}
      alt={media.alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      className={className}
      style={style}
    />
  );
}
