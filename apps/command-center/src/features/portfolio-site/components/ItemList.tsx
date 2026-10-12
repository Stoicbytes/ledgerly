import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useToast } from '@/components/feedback';
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus } from '@/components/icons';
import { Badge, Button, Card, IconButton, Text } from '@/components/ui';
import {
  formValues,
  ordered,
  rowSummary,
  type Row,
  type SiteKind,
  type Values,
} from '@/lib/domain/site';
import { useTheme } from '@/theme';
import { siteErrorMessage } from '../state/siteErrors';
import { useSiteStore } from '../state/siteStore';
import { ItemSheet } from './ItemSheet';

type Props = {
  kind: SiteKind;
  title: string;
  addLabel: string;
  empty: string;
  /** Only these rows (e.g. the skills of one area). */
  rows?: Row[];
  initial?: Values;
  headerAction?: React.ReactNode;
};

/** One kind of content as an ordered list: add, edit, reorder, show or hide as draft. */
export function ItemList({ kind, title, addLabel, empty, rows, initial, headerAction }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const store = useSiteStore();
  const list = ordered(rows ?? store.rows[kind]);
  const [editing, setEditing] = useState<Row | 'new' | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      toast.show({ message: siteErrorMessage(error) });
    }
  };
  const toggle = (row: Row) =>
    run(() =>
      store.save(kind, { ...formValues(kind, row), visible: row.visible === false }, row.id),
    );

  return (
    <Card padding={4}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[2],
          marginBottom: theme.space[3],
        }}
      >
        <Text variant="title" style={{ flex: 1 }}>
          {title}
        </Text>
        {headerAction}
        <Button
          label={addLabel}
          icon={Plus}
          size="sm"
          variant="secondary"
          onPress={() => setEditing('new')}
        />
      </View>
      {list.length ? (
        list.map((row, index) => {
          const { title: label, detail } = rowSummary(kind, row);
          const hidden = row.visible === false;
          return (
            <View
              key={row.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space[2],
                paddingVertical: theme.space[2],
                borderTopWidth: index ? 1 : 0,
                borderTopColor: theme.colors.border,
              }}
            >
              <Pressable
                role="button"
                accessibilityLabel={`Edit ${label}`}
                onPress={() => setEditing(row)}
                style={{ flex: 1, minWidth: 0, gap: 2, opacity: hidden ? 0.6 : 1 }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.space[2],
                    flexWrap: 'wrap',
                  }}
                >
                  <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {label || 'Untitled'}
                  </Text>
                  {hidden ? <Badge label="Draft" tone="warning" /> : null}
                  {row.featured === true ? <Badge label="Featured" tone="accent" /> : null}
                </View>
                {detail ? (
                  <Text variant="caption" color="textTertiary" numberOfLines={1}>
                    {detail}
                  </Text>
                ) : null}
              </Pressable>
              <IconButton
                icon={hidden ? EyeOff : Eye}
                accessibilityLabel={
                  hidden ? `Show ${label} on the portfolio` : `Hide ${label} (draft)`
                }
                onPress={() => toggle(row)}
              />
              <IconButton
                icon={ArrowUp}
                accessibilityLabel={`Move ${label} up`}
                disabled={index === 0}
                onPress={() => run(() => store.move(kind, row.id, -1))}
              />
              <IconButton
                icon={ArrowDown}
                accessibilityLabel={`Move ${label} down`}
                disabled={index === list.length - 1}
                onPress={() => run(() => store.move(kind, row.id, 1))}
              />
            </View>
          );
        })
      ) : (
        <Text variant="body" color="textTertiary">
          {empty}
        </Text>
      )}
      {editing ? (
        <ItemSheet
          kind={kind}
          row={editing === 'new' ? null : editing}
          initial={editing === 'new' ? initial : undefined}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Card>
  );
}
