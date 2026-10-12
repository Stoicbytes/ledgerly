import { create } from 'zustand';
import { useSession } from '@/features/auth/sessionStore';
import {
  createPreviewToken,
  deleteSiteItem,
  loadSite,
  markSiteMessage,
  publishSite,
  reorderSiteItems,
  saveSiteItem,
  unpublishSite,
} from '@/lib/data/siteRepository';
import {
  emptySiteData,
  moved,
  savePayload,
  type EditKind,
  type Row,
  type SiteData,
  type SiteKind,
  type Values,
} from '@/lib/domain/site';
import { newId } from '@/lib/ids';
import { cleanUnusedMedia } from './siteMedia';
import { sampleSite } from './sampleSite';

/**
 * The portfolio editor's state. Signed in, every change is saved at once through the
 * database functions (which check it again) and the publication is marked as having
 * unpublished changes. In preview mode it edits labelled sample content in memory and
 * cannot publish.
 */
type Mode = 'preview' | 'cloud';
type Status = 'idle' | 'loading' | 'ready' | 'failed';

type SiteStore = SiteData & {
  mode: Mode;
  status: Status;
  start: (mode: Mode) => Promise<void>;
  reset: () => void;
  save: (kind: EditKind, values: Values, id?: string | null) => Promise<Row>;
  remove: (kind: SiteKind | 'message', id: string) => Promise<void>;
  move: (kind: SiteKind, id: string, delta: -1 | 1) => Promise<void>;
  publish: () => Promise<void>;
  unpublish: () => Promise<void>;
  previewToken: () => Promise<string>;
  markMessage: (id: string, read: boolean) => Promise<void>;
};

export class PreviewOnlyError extends Error {}

const touched = (state: SiteData) =>
  state.publication ? { publication: { ...state.publication, dirty: true } } : {};

export const useSiteStore = create<SiteStore>((set, get) => ({
  ...emptySiteData(),
  mode: 'preview',
  status: 'idle',

  start: async (mode) => {
    if (mode === 'preview') {
      set({ ...sampleSite(), mode, status: 'ready' });
      return;
    }
    set({ ...emptySiteData(), mode, status: 'loading' });
    try {
      const data = await loadSite();
      if (get().mode === 'cloud') set({ ...data, status: 'ready' });
    } catch {
      if (get().mode === 'cloud') set({ status: 'failed' });
    }
  },

  reset: () => set({ ...emptySiteData(), mode: 'preview', status: 'idle' }),

  save: async (kind, values, id) => {
    const payload = savePayload(kind, values, id);
    let row: Row;
    if (get().mode === 'cloud') row = await saveSiteItem(kind, payload);
    else {
      const existing =
        kind === 'profile' ? get().profile : get().rows[kind].find((r) => r.id === id);
      const order = kind === 'profile' ? 0 : get().rows[kind].length;
      row = { sort_order: order, ...existing, ...payload, id: existing?.id ?? newId() } as Row;
    }
    set((state) => {
      if (kind === 'profile') return { profile: row, ...touched(state) };
      const list = state.rows[kind];
      const next = list.some((r) => r.id === row.id)
        ? list.map((r) => (r.id === row.id ? row : r))
        : [...list, row];
      return { rows: { ...state.rows, [kind]: next }, ...touched(state) };
    });
    return row;
  },

  remove: async (kind, id) => {
    if (get().mode === 'cloud') await deleteSiteItem(kind, id);
    set((state) => {
      if (kind === 'message') return { messages: state.messages.filter((m) => m.id !== id) };
      const rows = { ...state.rows, [kind]: state.rows[kind].filter((r) => r.id !== id) };
      // A deleted area takes its skills with it (as in the database).
      if (kind === 'skill_group') rows.skill = rows.skill.filter((s) => s.group_id !== id);
      return { rows, ...touched(state) };
    });
  },

  move: async (kind, id, delta) => {
    const list =
      kind === 'skill'
        ? get().rows.skill.filter(
            (s) => s.group_id === get().rows.skill.find((r) => r.id === id)?.group_id,
          )
        : get().rows[kind];
    const ids = moved(list, id, delta);
    if (!ids) return;
    if (get().mode === 'cloud') await reorderSiteItems(kind, ids);
    set((state) => ({
      rows: {
        ...state.rows,
        [kind]: state.rows[kind].map((r) =>
          ids.includes(r.id) ? { ...r, sort_order: ids.indexOf(r.id) } : r,
        ),
      },
      ...touched(state),
    }));
  },

  publish: async () => {
    if (get().mode !== 'cloud') throw new PreviewOnlyError();
    const publication = await publishSite();
    set({ publication });
    // Files nothing uses any more (replaced images, deleted items) are removed quietly.
    void cleanUnusedMedia().catch(() => {});
  },

  unpublish: async () => {
    if (get().mode !== 'cloud') throw new PreviewOnlyError();
    await unpublishSite();
    set({ publication: null });
  },

  previewToken: async () => {
    if (get().mode !== 'cloud') throw new PreviewOnlyError();
    return createPreviewToken();
  },

  markMessage: async (id, read) => {
    if (get().mode === 'cloud') await markSiteMessage(id, read);
    const readAt = read ? new Date().toISOString() : null;
    set((state) => ({ messages: state.messages.map((m) => (m.id === id ? { ...m, readAt } : m)) }));
  },
}));

// Signing out clears the editor, so the next account never sees this one's content.
useSession.subscribe((session) => {
  if (session.status !== 'signedIn' && useSiteStore.getState().mode === 'cloud') {
    useSiteStore.getState().reset();
  }
});
