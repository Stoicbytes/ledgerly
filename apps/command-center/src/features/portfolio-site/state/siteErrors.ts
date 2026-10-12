import { RpcError } from '@/lib/data/rpc';
import { PreviewOnlyError } from './siteStore';

/** A sentence for a failed save or publish (the database's codes, never its details). */
export function siteErrorMessage(error: unknown): string {
  if (error instanceof PreviewOnlyError)
    return 'Sign in to publish: this is the preview with sample content.';
  if (error instanceof RpcError) {
    if (error.code === '23505') return 'That address is already used. Choose another one.';
    if (error.code === '23514' || error.code === '22023' || error.code === '22P02')
      return 'Something in the form is not valid. Check the highlighted fields.';
    if (error.status === 403 || error.code === '42501')
      return 'Not allowed. If you use two-step sign-in, sign in again with your code.';
    if (error.retryable) return 'Could not reach the server. Check your connection and try again.';
  }
  return 'That did not work. Try again.';
}
