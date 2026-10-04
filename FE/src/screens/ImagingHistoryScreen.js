import React from 'react';
import { View, Text, Image, Animated, ScrollView, SafeAreaView, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PressableScale from '../components/PressableScale';
import PageHeroBanner from '../components/PageHeroBanner';
import FadeIn from '../components/FadeIn';
import Colors from '../constants/colors';
import Config from '../constants/config';
import { useImagingHistory } from '../controllers/useImagingHistory';
import { useLoop } from '../controllers/useMotion';
import styles from './ImagingHistoryScreen.styles';

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

const thumbSource = (item) => {
  const first = item?.images?.[0];
  if (!first) return require('../../assets/nero3.png');
  return { uri: first.startsWith('http') ? first : `${Config.API_URL}${first}` };
};

// Hướng dẫn chung trước khi chụp MRI (thông tin an toàn phổ biến, không phải chỉ định riêng cho từng người).
const PREP_TIPS = [
  'Tháo trang sức, kẹp tóc và đồ kim loại trước khi vào phòng chụp.',
  'Báo bác sĩ nếu bạn có máy tạo nhịp tim, mảnh ghép kim loại hoặc đang mang thai.',
  'Mang theo phim và kết quả cũ để bác sĩ so sánh với lần chụp mới.',
];

const SkeletonCard = ({ shimmer }) => {
  const opacity = shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.55, 1, 0.55] });
  return (
    <Animated.View style={[styles.card, { opacity }]}>
      <View style={styles.cardInner}>
        <View style={[styles.thumbWrap, styles.skeleton, { borderRadius: 0 }]} />
        <View style={styles.cardBody}>
          <View style={[styles.skeleton, { width: '35%', height: 12 }]} />
          <View style={[styles.skeleton, { width: '85%', height: 18, marginTop: 10 }]} />
          <View style={[styles.skeleton, { width: '100%', height: 40, marginTop: 10 }]} />
        </View>
      </View>
    </Animated.View>
  );
};

const FilmCard = ({ item, index, onOpen }) => {
  const isMRI = item.imagingType !== 'CT';
  return (
    <FadeIn delay={index * 80}>
      <PressableScale
        style={styles.card}
        hoverStyle={styles.cardHover}
        onPress={onOpen}
        accessibilityRole="link"
        accessibilityLabel={`${item.imagingType || 'Phim'} ngày ${formatDate(item.reportDate)}: ${item.procedure}`}
      >
        <View style={styles.cardInner}>
          <View style={styles.thumbWrap}>
            <Image source={thumbSource(item)} style={styles.thumb} resizeMode="cover" accessible={false} />
            <View style={[styles.typeChip, isMRI ? styles.typeChipMri : styles.typeChipCt]}>
              <Text style={styles.typeChipText}>{item.imagingType || 'MRI'}</Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.dateText}>{formatDate(item.reportDate || item.orderDate)}</Text>
            <Text style={styles.procedureTitle}>{item.procedure || 'Chụp chẩn đoán hình ảnh'}</Text>
            {item.conclusion ? (
              <Text style={styles.conclusionText}>
                <Text style={styles.conclusionLabel}>Kết luận: </Text>
                {item.conclusion}
              </Text>
            ) : null}
            <View style={styles.cardFooter}>
              <Text style={styles.doctorText} numberOfLines={1}>
                <Feather name="user" size={12} color={Colors.secondary} /> {item.radiologist || 'Bác sĩ chẩn đoán hình ảnh'}
              </Text>
              <View style={styles.openLink}>
                <Text style={styles.openLinkText}>Xem kết quả</Text>
                <Feather name="arrow-right" size={14} color={Colors.brandGreen} />
              </View>
            </View>
          </View>
        </View>
      </PressableScale>
    </FadeIn>
  );
};

const PrepCard = ({ onAnalyze }) => (
  <FadeIn delay={200} style={styles.prepCard}>
    <Image source={require('../../assets/images/illus-films.png')} style={styles.prepIllus} resizeMode="contain" accessible={false} />
    <Text style={styles.prepTitle}>Chuẩn bị cho lần chụp MRI tiếp theo</Text>
    {PREP_TIPS.map((tip) => (
      <View key={tip} style={styles.prepRow}>
        <View style={styles.prepCheck}>
          <Feather name="check" size={12} color={Colors.brandGreen} />
        </View>
        <Text style={styles.prepText}>{tip}</Text>
      </View>
    ))}
    <View style={styles.prepDivider} />
    <Text style={styles.prepHint}>Muốn đọc kết quả dễ hiểu hơn?</Text>
    <PressableScale style={styles.prepBtn} hoverStyle={styles.prepBtnHover} onPress={onAnalyze} accessibilityRole="link">
      <Feather name="cpu" size={15} color={Colors.brandGreen} />
      <Text style={styles.prepBtnText}>Mở Phân tích AI</Text>
    </PressableScale>
  </FadeIn>
);

const ImagingHistoryScreen = ({ route, navigation }) => {
  const { patientMedicalId, patientName } = route.params || {};
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const wideBanner = width > 980;
  const { results, loading, error, refresh } = useImagingHistory(patientMedicalId);
  const shimmer = useLoop(1200);
  // Cột hướng dẫn chỉ dành cho bệnh nhân xem phim của chính mình (nhân viên xem hộ thì không cần).
  const showPrep = !patientMedicalId;

  const title = patientName ? `Phim của ${patientName}` : 'Phim MRI & CT';
  const subtitle = loading ? 'Đang tải…' : `${results.length} phim, mới nhất ở trên cùng.`;

  const openFilm = (item) => navigation.navigate('ImagingResult', { resultId: item._id, activeRoute: 'ImagingHistory' });

  let listContent;
  if (loading) {
    listContent = [0, 1, 2].map((i) => <SkeletonCard key={i} shimmer={shimmer.value} />);
  } else if (error) {
    listContent = (
      <View style={styles.stateBox}>
        <View style={[styles.stateIcon, styles.stateIconWarn]}>
          <Feather name="wifi-off" size={22} color="#B45309" />
        </View>
        <Text style={styles.stateTitle}>Không tải được danh sách phim</Text>
        <Text style={styles.stateText}>{error}</Text>
        <PressableScale style={styles.retryBtn} hoverStyle={styles.retryBtnHover} onPress={refresh}>
          <Text style={styles.retryBtnText}>Thử lại</Text>
        </PressableScale>
      </View>
    );
  } else if (results.length === 0) {
    listContent = (
      <View style={styles.stateBox}>
        <Image source={require('../../assets/images/illus-films.png')} style={styles.stateIllus} resizeMode="contain" accessible={false} />
        <Text style={styles.stateTitle}>Chưa có phim nào</Text>
        <Text style={styles.stateText}>Phim MRI/CT sẽ hiện ở đây sau khi bệnh viện tải lên hệ thống.</Text>
      </View>
    );
  } else {
    // Mỗi bệnh nhân chỉ có vài phim — render thẳng trong ScrollView, không cần list ảo hoá.
    listContent = results.map((item, index) => <FilmCard key={item._id} item={item} index={index} onOpen={() => openFilm(item)} />);
  }

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="ImagingHistory">
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={[styles.page, isDesktop && styles.pageDesktop]}>
          <PageHeroBanner
            source={require('../../assets/images/patient-imaging-header.jpg')}
            title={title}
            subtitle={subtitle}
            wide={wideBanner}
          >
            <PressableScale
              style={[styles.refreshBtn, wideBanner && styles.refreshBtnOnDark]}
              hoverStyle={wideBanner ? styles.refreshBtnOnDarkHover : styles.refreshBtnHover}
              onPress={refresh}
              accessibilityLabel="Tải lại danh sách phim"
            >
              <Feather name="rotate-cw" size={14} color={wideBanner ? Colors.brandMint : Colors.brandGreen} />
              <Text style={[styles.refreshBtnText, wideBanner && styles.refreshBtnTextOnDark]}>Tải lại</Text>
            </PressableScale>
          </PageHeroBanner>

          <View style={[styles.columns, isDesktop && showPrep && styles.columnsDesktop]}>
            <View style={[styles.list, isDesktop && showPrep && styles.listCol]}>{listContent}</View>
            {showPrep && (
              <View style={isDesktop ? styles.asideCol : null}>
                <PrepCard onAnalyze={() => navigation.navigate('AIAnalysis')} />
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ResponsiveLayout>
  );
};

export default ImagingHistoryScreen;
