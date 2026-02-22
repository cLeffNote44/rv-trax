import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import type { UnitNote } from '@rv-trax/shared';
import { api } from '@/services/api';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NotesSectionProps {
  unitId: string;
  notes: UnitNote[];
  onNoteAdded: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const NotesSection: React.FC<NotesSectionProps> = ({
  unitId,
  notes,
  onNoteAdded,
}) => {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAddNote = useCallback(async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`api/v1/units/${unitId}/notes`, {
        json: { content: text.trim() },
      });
      setText('');
      onNoteAdded();
    } catch {
      // Handle error silently for now
    } finally {
      setSubmitting(false);
    }
  }, [unitId, text, onNoteAdded]);

  const renderNote = useCallback(
    ({ item }: { item: UnitNote }) => (
      <View style={styles.noteItem}>
        <View style={styles.noteHeader}>
          <Text style={styles.noteAuthor}>{item.author_id}</Text>
          <Text style={styles.noteDate}>{formatDate(item.created_at)}</Text>
        </View>
        <Text style={styles.noteContent}>{item.content}</Text>
        {item.is_pinned && (
          <Text style={styles.pinnedBadge}>Pinned</Text>
        )}
      </View>
    ),
    [],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notes</Text>

      {notes.length === 0 ? (
        <Text style={styles.emptyText}>No notes yet.</Text>
      ) : (
        <FlatList
          data={notes}
          renderItem={renderNote}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />
      )}

      {/* Add note input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Add a note..."
          placeholderTextColor={colors.gray400}
          value={text}
          onChangeText={setText}
          multiline
          editable={!submitting}
        />
        <TouchableOpacity
          style={[
            styles.addButton,
            (!text.trim() || submitting) && styles.addButtonDisabled,
          ]}
          onPress={handleAddNote}
          disabled={!text.trim() || submitting}
          activeOpacity={0.7}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.addButtonText}>Add</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: colors.gray400,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  noteItem: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  noteAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray700,
  },
  noteDate: {
    fontSize: 12,
    color: colors.gray400,
  },
  noteContent: {
    fontSize: 14,
    color: colors.gray800,
    lineHeight: 20,
  },
  pinnedBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.gray900,
    maxHeight: 100,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 56,
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  addButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
});
