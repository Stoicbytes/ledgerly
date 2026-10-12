/**
 * Layout for the hero's signal field: skills as nodes spread evenly over an area, each
 * linked to its nearest neighbours and to the next skill in its group. Deterministic
 * (seeded by the skill names), so the picture is the same on every visit.
 */
export type FieldSkill = { name: string; featured: boolean; group: number };
export type FieldNode = FieldSkill & { x: number; y: number; phase: number };
export type FieldEdge = [number, number];
export type Area = { x: number; y: number; width: number; height: number };

function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Featured skills first, then the rest, up to `max`. */
export function pickSkills(
  groups: { skills: { name: string; featured: boolean }[] }[],
  max: number,
): FieldSkill[] {
  const all = groups.flatMap((group, groupIndex) =>
    group.skills.map((skill) => ({
      name: skill.name,
      featured: skill.featured,
      group: groupIndex,
    })),
  );
  return [...all.filter((s) => s.featured), ...all.filter((s) => !s.featured)].slice(0, max);
}

const inside = (x: number, y: number, box: Area) =>
  x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;

/** Spreads the skills over `area`, keeping clear of `avoid` (the hero's text). */
export function layoutField(
  skills: FieldSkill[],
  area: Area,
  seed: string,
  avoid: Area[] = [],
): FieldNode[] {
  const rand = seeded(seed);
  const nodes: FieldNode[] = [];
  for (const skill of skills) {
    let best = { x: area.x + area.width / 2, y: area.y + area.height / 2, score: -Infinity };
    for (let attempt = 0; attempt < 18; attempt += 1) {
      const x = area.x + rand() * area.width;
      const y = area.y + rand() * area.height;
      const spread = nodes.length
        ? Math.min(...nodes.map((node) => Math.hypot(node.x - x, (node.y - y) * 1.3)))
        : 1;
      const score = avoid.some((box) => inside(x, y, box)) ? spread - 100000 : spread;
      if (score > best.score) best = { x, y, score };
    }
    nodes.push({ ...skill, x: best.x, y: best.y, phase: rand() * Math.PI * 2 });
  }
  return nodes;
}

export function linkField(nodes: FieldNode[], neighbours = 2): FieldEdge[] {
  const seen = new Set<string>();
  const edges: FieldEdge[] = [];
  const add = (a: number, b: number) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (a === b || seen.has(key)) return;
    seen.add(key);
    edges.push([a, b]);
  };
  nodes.forEach((node, index) => {
    nodes
      .map((other, otherIndex) => ({
        otherIndex,
        d: Math.hypot(other.x - node.x, other.y - node.y),
      }))
      .filter((item) => item.otherIndex !== index)
      .sort((a, b) => a.d - b.d)
      .slice(0, neighbours)
      .forEach((item) => add(index, item.otherIndex));
    const next = nodes.findIndex(
      (other, otherIndex) => otherIndex > index && other.group === node.group,
    );
    if (next > -1) add(index, next);
  });
  return edges;
}
