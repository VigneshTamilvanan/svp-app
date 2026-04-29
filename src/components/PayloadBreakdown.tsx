import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ParsedQR } from '../lib/parser';

interface Props {
  result: ParsedQR | {
    dataset: {
      security: unknown;
      version: unknown;
      commonData: unknown;
      dynamicData: unknown;
      ticketBlock: unknown;
    };
  };
  defaultOpen?: boolean;
}

type Tag = {
  tag: string;
  label: string;
  totalBytes?: number;
  fields?: Array<{ name: string; size: number; hex: string; desc?: string }>;
  opId?: string;
  noTkts?: string;
  valInfo?: string;
  ticket?: Array<{ name: string; size: number; hex: string; desc?: string }>;
};

function Section({ tag, defaultOpen }: { tag: Tag; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const fields = tag.fields ?? tag.ticket ?? [];
  const headerFields = tag.ticket
    ? [
        { name: 'Operator ID',     size: 2, hex: tag.opId   ?? '', desc: '' },
        { name: 'No of Tickets',   size: 1, hex: tag.noTkts ?? '', desc: '' },
        { name: 'Validator Info',  size: 1, hex: tag.valInfo ?? '', desc: '' },
      ]
    : [];
  const allFields = [...headerFields, ...fields];

  return (
    <View style={s.section}>
      <TouchableOpacity style={s.header} onPress={() => setOpen(o => !o)}>
        <View style={s.tagBadge}><Text style={s.tagText}>TAG {tag.tag}</Text></View>
        <Text style={s.sectionTitle}>{tag.label}</Text>
        {tag.totalBytes != null && <Text style={s.bytes}>{tag.totalBytes}B</Text>}
        <Text style={s.chevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={s.body}>
          {allFields.map((f, i) => (
            <View key={i} style={[s.row, i % 2 === 0 && s.rowAlt]}>
              <View style={s.rowLeft}>
                <Text style={s.fieldName}>{f.name}</Text>
                {f.desc ? <Text style={s.fieldDesc}>{f.desc}</Text> : null}
              </View>
              <View style={s.rowRight}>
                <Text style={s.fieldSize}>{f.size}B</Text>
                <Text style={s.fieldHex} numberOfLines={1} ellipsizeMode="middle">
                  {f.hex}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function PayloadBreakdown({ result, defaultOpen = false }: Props) {
  const { dataset } = result as { dataset: { security: Tag; version: Tag; commonData: Tag; dynamicData: Tag; ticketBlock: Tag } };

  const sections: Tag[] = [
    dataset.security,
    dataset.version,
    dataset.commonData,
    dataset.dynamicData,
    dataset.ticketBlock,
  ];

  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Payload Breakdown</Text>
      {sections.map(tag => (
        <Section key={tag.tag} tag={tag} defaultOpen={defaultOpen} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  card:         { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 16 },
  cardTitle:    { fontSize: 16, fontWeight: '700', color: '#e2e8f0', marginBottom: 12, letterSpacing: 0.3 },
  section:      { borderRadius: 10, overflow: 'hidden', marginBottom: 8, borderWidth: 1, borderColor: '#334155' },
  header:       { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#0f172a', gap: 8 },
  tagBadge:     { backgroundColor: '#1e3a5f', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  tagText:      { fontSize: 10, fontWeight: '800', color: '#60a5fa', fontFamily: 'monospace' },
  sectionTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: '#cbd5e1' },
  bytes:        { fontSize: 11, color: '#475569' },
  chevron:      { fontSize: 10, color: '#475569', marginLeft: 4 },
  body:         { backgroundColor: '#1e293b' },
  row:          { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderTopColor: '#0f172a' },
  rowAlt:       { backgroundColor: '#1a2540' },
  rowLeft:      { flex: 1, paddingRight: 8 },
  rowRight:     { alignItems: 'flex-end', minWidth: 90 },
  fieldName:    { fontSize: 12, color: '#94a3b8', fontWeight: '600', marginBottom: 2 },
  fieldDesc:    { fontSize: 11, color: '#475569', lineHeight: 16 },
  fieldSize:    { fontSize: 10, color: '#334155', fontFamily: 'monospace' },
  fieldHex:     { fontSize: 11, color: '#a5b4fc', fontFamily: 'monospace', marginTop: 2, maxWidth: 110 },
});
