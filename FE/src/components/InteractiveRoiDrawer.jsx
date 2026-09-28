import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Crop, RotateCcw, Crosshair, Check, Info } from 'lucide-react';

/**
 * InteractiveRoiDrawer
 * Component cho phép bác sĩ dùng chuột hoặc cảm ứng kéo thả khoanh vùng khối u trực tiếp trên ảnh MRI.
 * Tự động tính toán tỷ lệ co giãn (aspect-ratio contain) để quy đổi tọa độ hiển thị sang tọa độ pixel thực tế của ảnh gốc.
 *
 * Props:
 * - imageUrl: Đường dẫn hoặc base64 ảnh MRI
 * - initialBox: { x, y, w, h } (Tọa độ trên ảnh gốc)
 * - onBoxChange: ({ x, y, w, h }) => void (Callback khi tọa độ thay đổi)
 * - disabled: boolean (Vô hiệu hóa chế độ vẽ, vd: khi chọn notumor)
 * - containerHeight: chiều cao khung hiển thị (mặc định 360)
 */
export default function InteractiveRoiDrawer({
  imageUrl,
  initialBox = { x: 0, y: 0, w: 0, h: 0 },
  onBoxChange,
  disabled = false,
  containerHeight = 360,
}) {
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [layoutSize, setLayoutSize] = useState({ width: 0, height: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDrawingModeActive, setIsDrawingModeActive] = useState(true);

  // Vị trí hiển thị trên màn hình (CSS display pixels relative to container)
  const [displayBox, setDisplayBox] = useState(null);
  const startPointRef = useRef(null);
  const containerRef = useRef(null);

  // 1. Lấy kích thước ảnh gốc (natural dimensions)
  useEffect(() => {
    if (!imageUrl) return;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const img = new window.Image();
      img.onload = () => {
        setNaturalSize({
          width: img.naturalWidth || 224,
          height: img.naturalHeight || 224,
        });
      };
      img.onerror = () => {
        setNaturalSize({ width: 224, height: 224 });
      };
      img.src = imageUrl;
    } else {
      Image.getSize(
        imageUrl,
        (width, height) => setNaturalSize({ width, height }),
        () => setNaturalSize({ width: 224, height: 224 })
      );
    }
  }, [imageUrl]);

  // 2. Tính toán vùng hiển thị thực tế của ảnh bên trong container (resizeMode="contain")
  const getRenderMetrics = useCallback(() => {
    const { width: cW, height: cH } = layoutSize;
    const { width: nW, height: nH } = naturalSize;

    if (cW <= 0 || cH <= 0 || nW <= 0 || nH <= 0) {
      return { renderW: cW, renderH: cH, offsetX: 0, offsetY: 0, scale: 1 };
    }

    const containerAspect = cW / cH;
    const imageAspect = nW / nH;

    let renderW = cW;
    let renderH = cH;
    let offsetX = 0;
    let offsetY = 0;

    if (containerAspect > imageAspect) {
      // Bị giới hạn bởi chiều cao
      renderH = cH;
      renderW = cH * imageAspect;
      offsetX = (cW - renderW) / 2;
    } else {
      // Bị giới hạn bởi chiều rộng
      renderW = cW;
      renderH = cW / imageAspect;
      offsetY = (cH - renderH) / 2;
    }

    const scale = nW / renderW; // 1 display pixel = scale real pixels
    return { renderW, renderH, offsetX, offsetY, scale };
  }, [layoutSize, naturalSize]);

  // 3. Đồng bộ initialBox sang displayBox khi lần đầu tải xong metrics
  useEffect(() => {
    if (!naturalSize.width || !layoutSize.width) return;
    const { renderW, renderH, offsetX, offsetY, scale } = getRenderMetrics();

    if (initialBox && initialBox.w > 0 && initialBox.h > 0) {
      const dispX = offsetX + initialBox.x / scale;
      const dispY = offsetY + initialBox.y / scale;
      const dispW = initialBox.w / scale;
      const dispH = initialBox.h / scale;

      setDisplayBox({
        x: Math.max(offsetX, Math.min(dispX, offsetX + renderW - 10)),
        y: Math.max(offsetY, Math.min(dispY, offsetY + renderH - 10)),
        w: Math.min(dispW, renderW),
        h: Math.min(dispH, renderH),
      });
    } else if (displayBox === null && !disabled) {
      // Mặc định tạo 1 khung trung tâm nhỏ nếu chưa có
      const defaultW = renderW * 0.35;
      const defaultH = renderH * 0.35;
      const dispX = offsetX + (renderW - defaultW) / 2;
      const dispY = offsetY + (renderH - defaultH) / 2;

      const newDispBox = { x: dispX, y: dispY, w: defaultW, h: defaultH };
      setDisplayBox(newDispBox);

      // Chuyển đổi sang tọa độ ảnh thật và thông báo
      const realX = Math.round((dispX - offsetX) * scale);
      const realY = Math.round((dispY - offsetY) * scale);
      const realW = Math.round(defaultW * scale);
      const realH = Math.round(defaultH * scale);
      if (onBoxChange) {
        onBoxChange({ x: realX, y: realY, w: realW, h: realH });
      }
    }
  }, [naturalSize.width, layoutSize.width]);

  // 4. Xử lý thao tác vẽ chuột / cảm ứng
  const handlePointerDown = (e) => {
    if (disabled || !isDrawingModeActive) return;

    let clientX, clientY;
    if (e.nativeEvent.clientX !== undefined) {
      clientX = e.nativeEvent.clientX;
      clientY = e.nativeEvent.clientY;
    } else if (e.nativeEvent.touches && e.nativeEvent.touches[0]) {
      clientX = e.nativeEvent.touches[0].clientX;
      clientY = e.nativeEvent.touches[0].clientY;
    } else {
      clientX = e.nativeEvent.locationX;
      clientY = e.nativeEvent.locationY;
    }

    // Lấy bounding rect của container để tính vị trí tương đối
    let relX = e.nativeEvent.locationX;
    let relY = e.nativeEvent.locationY;

    if (e.currentTarget && e.currentTarget.getBoundingClientRect) {
      const rect = e.currentTarget.getBoundingClientRect();
      relX = clientX - rect.left;
      relY = clientY - rect.top;
    }

    const { renderW, renderH, offsetX, offsetY } = getRenderMetrics();

    // Giới hạn trong phạm vi ảnh
    const clampedX = Math.max(offsetX, Math.min(relX, offsetX + renderW));
    const clampedY = Math.max(offsetY, Math.min(relY, offsetY + renderH));

    startPointRef.current = { x: clampedX, y: clampedY };
    setIsDrawing(true);
    setDisplayBox({ x: clampedX, y: clampedY, w: 0, h: 0 });
  };

  const handlePointerMove = (e) => {
    if (!isDrawing || !startPointRef.current) return;

    let clientX, clientY;
    if (e.nativeEvent.clientX !== undefined) {
      clientX = e.nativeEvent.clientX;
      clientY = e.nativeEvent.clientY;
    } else if (e.nativeEvent.touches && e.nativeEvent.touches[0]) {
      clientX = e.nativeEvent.touches[0].clientX;
      clientY = e.nativeEvent.touches[0].clientY;
    } else {
      clientX = e.nativeEvent.locationX;
      clientY = e.nativeEvent.locationY;
    }

    let relX = e.nativeEvent.locationX;
    let relY = e.nativeEvent.locationY;

    if (e.currentTarget && e.currentTarget.getBoundingClientRect) {
      const rect = e.currentTarget.getBoundingClientRect();
      relX = clientX - rect.left;
      relY = clientY - rect.top;
    }

    const { renderW, renderH, offsetX, offsetY } = getRenderMetrics();

    const currX = Math.max(offsetX, Math.min(relX, offsetX + renderW));
    const currY = Math.max(offsetY, Math.min(relY, offsetY + renderH));

    const x = Math.min(startPointRef.current.x, currX);
    const y = Math.min(startPointRef.current.y, currY);
    const w = Math.abs(currX - startPointRef.current.x);
    const h = Math.abs(currY - startPointRef.current.y);

    setDisplayBox({ x, y, w, h });
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    startPointRef.current = null;

    if (!displayBox) return;

    const { offsetX, offsetY, scale, renderW, renderH } = getRenderMetrics();

    // Nếu vẽ quá nhỏ (< 8px), mở rộng tối thiểu
    let finalW = Math.max(displayBox.w, 16);
    let finalH = Math.max(displayBox.h, 16);

    let finalX = displayBox.x;
    let finalY = displayBox.y;

    if (finalX + finalW > offsetX + renderW) {
      finalW = offsetX + renderW - finalX;
    }
    if (finalY + finalH > offsetY + renderH) {
      finalH = offsetY + renderH - finalY;
    }

    setDisplayBox({ x: finalX, y: finalY, w: finalW, h: finalH });

    // Tính tọa độ pixel ảnh gốc
    const realX = Math.max(0, Math.round((finalX - offsetX) * scale));
    const realY = Math.max(0, Math.round((finalY - offsetY) * scale));
    const realW = Math.max(1, Math.min(naturalSize.width - realX, Math.round(finalW * scale)));
    const realH = Math.max(1, Math.min(naturalSize.height - realY, Math.round(finalH * scale)));

    if (onBoxChange) {
      onBoxChange({ x: realX, y: realY, w: realW, h: realH });
    }
  };

  // Đặt lại vùng trung tâm
  const handleResetCenter = () => {
    const { renderW, renderH, offsetX, offsetY, scale } = getRenderMetrics();
    const defaultW = renderW * 0.35;
    const defaultH = renderH * 0.35;
    const dispX = offsetX + (renderW - defaultW) / 2;
    const dispY = offsetY + (renderH - defaultH) / 2;

    const newDispBox = { x: dispX, y: dispY, w: defaultW, h: defaultH };
    setDisplayBox(newDispBox);

    const realX = Math.round((dispX - offsetX) * scale);
    const realY = Math.round((dispY - offsetY) * scale);
    const realW = Math.round(defaultW * scale);
    const realH = Math.round(defaultH * scale);

    if (onBoxChange) {
      onBoxChange({ x: realX, y: realY, w: realW, h: realH });
    }
  };

  // Tính tọa độ ảnh thật hiện tại để hiển thị badge
  const { offsetX, offsetY, scale } = getRenderMetrics();
  const currentRealX = displayBox && scale ? Math.max(0, Math.round((displayBox.x - offsetX) * scale)) : 0;
  const currentRealY = displayBox && scale ? Math.max(0, Math.round((displayBox.y - offsetY) * scale)) : 0;
  const currentRealW = displayBox && scale ? Math.max(0, Math.round(displayBox.w * scale)) : 0;
  const currentRealH = displayBox && scale ? Math.max(0, Math.round(displayBox.h * scale)) : 0;

  return (
    <View style={styles.outerContainer}>
      {/* Thanh công cụ hướng dẫn & phím tắt */}
      <View style={styles.toolbar}>
        <View style={styles.toolbarLeft}>
          <Crosshair size={14} color="#EF4444" strokeWidth={2.4} />
          <Text style={styles.toolbarTitle}>
            {disabled
              ? 'Đang chọn "Không có u" (Không cần khoanh vùng)'
              : 'Kéo chuột trên ảnh để khoanh vùng khối u:'}
          </Text>
        </View>

        {!disabled && (
          <View style={styles.toolbarActions}>
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={handleResetCenter}
              title="Căn vùng trung tâm"
            >
              <RotateCcw size={12} color="#475569" />
              <Text style={styles.toolBtnText}>Căn giữa</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.toolBtn,
                isDrawingModeActive && styles.toolBtnActive,
              ]}
              onPress={() => setIsDrawingModeActive(!isDrawingModeActive)}
            >
              <Crop size={12} color={isDrawingModeActive ? '#FFFFFF' : '#475569'} />
              <Text style={[styles.toolBtnText, isDrawingModeActive && styles.toolBtnTextActive]}>
                {isDrawingModeActive ? 'Đang vẽ' : 'Bật vẽ'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Vùng Canvas chứa ảnh MRI và Lớp Bounding Box */}
      <View
        ref={containerRef}
        style={[
          styles.imageContainer,
          { height: containerHeight },
          isDrawingModeActive && !disabled && styles.crosshairCursor,
        ]}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setLayoutSize({ width, height });
        }}
        // Hỗ trợ chuột và Pointer events trên Web
        onMouseDown={Platform.OS === 'web' ? handlePointerDown : undefined}
        onMouseMove={Platform.OS === 'web' ? handlePointerMove : undefined}
        onMouseUp={Platform.OS === 'web' ? handlePointerUp : undefined}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.noImage}>
            <Text style={styles.noImageText}>Không có ảnh MRI</Text>
          </View>
        )}

        {/* Khung Bounding Box hiển thị trực tiếp trên ảnh */}
        {!disabled && displayBox && displayBox.w > 0 && displayBox.h > 0 && (
          <View
            style={[
              styles.boundingBox,
              {
                left: displayBox.x,
                top: displayBox.y,
                width: displayBox.w,
                height: displayBox.h,
              },
            ]}
          >
            {/* Tag thông số vùng khối u */}
            <View style={styles.boxTag}>
              <Text style={styles.boxTagText}>
                {currentRealW} × {currentRealH} px
              </Text>
            </View>

            {/* 4 Chốt điều hướng ở 4 góc */}
            <View style={[styles.handle, styles.handleTL]} />
            <View style={[styles.handle, styles.handleTR]} />
            <View style={[styles.handle, styles.handleBL]} />
            <View style={[styles.handle, styles.handleBR]} />

            {/* Tâm ngắm */}
            <View style={styles.centerDot} />
          </View>
        )}

        {/* Gợi ý khi chưa khoanh vùng */}
        {!disabled && (!displayBox || displayBox.w <= 0) && (
          <View style={styles.guideOverlay} pointerEvents="none">
            <Info size={16} color="#94A3B8" />
            <Text style={styles.guideText}>
              Nhấn giữ chuột trái và kéo để vẽ khung chữ nhật bao quanh khối u
            </Text>
          </View>
        )}
      </View>

      {/* Hiển thị tọa độ thực tế đã quy đổi cho AI */}
      <View style={styles.metricsFooter}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>X (pixel):</Text>
          <Text style={styles.metricVal}>{disabled ? 0 : currentRealX}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Y (pixel):</Text>
          <Text style={styles.metricVal}>{disabled ? 0 : currentRealY}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Rộng (W):</Text>
          <Text style={styles.metricVal}>{disabled ? 0 : currentRealW}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Cao (H):</Text>
          <Text style={styles.metricVal}>{disabled ? 0 : currentRealH}</Text>
        </View>
        <View style={[styles.metricItem, { flex: 1.5, alignItems: 'flex-end' }]}>
          <Text style={styles.metricSub}>
            Ảnh gốc: {naturalSize.width} × {naturalSize.height}px
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 8,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  toolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  toolbarTitle: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '600',
  },
  toolbarActions: {
    flexDirection: 'row',
    gap: 6,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#334155',
    borderRadius: 4,
  },
  toolBtnActive: {
    backgroundColor: '#DC2626',
  },
  toolBtnText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  toolBtnTextActive: {
    color: '#FFFFFF',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    userSelect: 'none',
  },
  crosshairCursor: {
    // Chỉ hoạt động trên web
    cursor: 'crosshair',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  noImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    color: '#64748B',
    fontSize: 13,
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
    boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)',
  },
  boxTag: {
    position: 'absolute',
    top: -22,
    left: 0,
    backgroundColor: '#DC2626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  boxTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  handle: {
    position: 'absolute',
    width: 8,
    height: 8,
    backgroundColor: '#FFFFFF',
    borderColor: '#DC2626',
    borderWidth: 1.5,
    borderRadius: 2,
  },
  handleTL: { top: -4, left: -4 },
  handleTR: { top: -4, right: -4 },
  handleBL: { bottom: -4, left: -4 },
  handleBR: { bottom: -4, right: -4 },
  centerDot: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 6,
    height: 6,
    marginTop: -3,
    marginLeft: -3,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  guideOverlay: {
    position: 'absolute',
    bottom: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  guideText: {
    color: '#CBD5E1',
    fontSize: 11,
  },
  metricsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 12,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  metricVal: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  metricSub: {
    color: '#64748B',
    fontSize: 10,
    fontStyle: 'italic',
  },
});
