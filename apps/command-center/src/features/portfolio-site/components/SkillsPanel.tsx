import { useState } from 'react';
import { View } from 'react-native';
import { Pencil } from '@/components/icons';
import { IconButton } from '@/components/ui';
import { ordered, type Row } from '@/lib/domain/site';
import { useTheme } from '@/theme';
import { useSiteStore } from '../state/siteStore';
import { ItemList } from './ItemList';
import { ItemSheet } from './ItemSheet';

/** Skill areas, each with its skills (added straight into that area). */
export function SkillsPanel() {
  const theme = useTheme();
  const { rows } = useSiteStore();
  const [editingGroup, setEditingGroup] = useState<Row | null>(null);
  const groups = ordered(rows.skill_group);
  return (
    <View style={{ gap: theme.space[4] }}>
      <ItemList
        kind="skill_group"
        title="Skill areas"
        addLabel="Add area"
        empty="Add an area such as Backend or Frontend, then its skills."
      />
      {groups.map((group) => (
        <ItemList
          key={group.id}
          kind="skill"
          title={String(group.name ?? '')}
          addLabel="Add skill"
          empty="No skills in this area yet."
          rows={rows.skill.filter((skill) => skill.group_id === group.id)}
          initial={{ group_id: group.id }}
          headerAction={
            <IconButton
              icon={Pencil}
              accessibilityLabel={`Edit the ${String(group.name ?? '')} area`}
              onPress={() => setEditingGroup(group)}
            />
          }
        />
      ))}
      {editingGroup ? (
        <ItemSheet kind="skill_group" row={editingGroup} onClose={() => setEditingGroup(null)} />
      ) : null}
    </View>
  );
}
