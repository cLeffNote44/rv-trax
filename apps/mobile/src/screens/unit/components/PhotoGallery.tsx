import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';
import type { UnitPhoto } from '@rv-trax/shared';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const THUMB_SIZE = 100;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PhotoGalleryProps {
  photos: UnitPhoto[];
  onTakePhoto: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  photos,
  onTakePhoto,
}) => {
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);

  const handlePhotoPress = useCallback((url: string) => {
    setFullscreenUrl(url);
  }, []);

  const handleClose = useCallback(() => {
    setFullscreenUrl(null);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Photos</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {photos.map((photo) => (
          <TouchableOpacity
            key={photo.id}
            onPress={() => handlePhotoPress(photo.url)}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: photo.thumbnail_url || photo.url }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}

        {/* Take Photo button */}
        <TouchableOpacity
          style={styles.takePhotoButton}
          onPress={onTakePhoto}
          activeOpacity={0.7}
        >
          <Text style={styles.cameraIcon}>+</Text>
          <Text style={styles.takePhotoText}>Take Photo</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Fullscreen modal */}
      <Modal
        visible={fullscreenUrl !== null}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.fullscreenOverlay}>
          <TouchableOpacity
            style={styles.fullscreenClose}
            onPress={handleClose}
          >
            <Text style={styles.fullscreenCloseText}>X</Text>
          </TouchableOpacity>
          {fullscreenUrl && (
            <Image
              source={{ uri: fullscreenUrl }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
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
    paddingVertical: spacing.md,
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
    paddingHorizontal: spacing.md,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  thumbnail: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 8,
    backgroundColor: colors.gray100,
  },
  takePhotoButton: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: {
    fontSize: 24,
    color: colors.gray400,
    fontWeight: '300',
  },
  takePhotoText: {
    fontSize: 11,
    color: colors.gray400,
    marginTop: 2,
  },

  // Fullscreen
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCloseText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
});
