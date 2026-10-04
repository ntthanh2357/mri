import React from 'react';
import { View, Text, Image, StyleSheet, Animated, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../../constants/colors';
import Config from '../../constants/config';
import PressableScale from '../PressableScale';
import { usePatientHome } from '../../controllers/usePatientHome';
import { useStaggeredEntrance, useCountUp, useLoop, useDrift, driftStyle, useProgress, enterStyle } from '../../controllers/useMotion';

const greetingFor = (date) => {
  const h = date.getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
};

// Tên trong dữ liệu mẫu có ghi chú trong ngoặc ("... (U Màng Não)") — không hiển thị ở lời chào.
const displayName = (user) => (user?.profile?.name || 'bạn').replace(/\s*\(.*?\)\s*/g, ' ').trim();

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

const imageSource = (result) => {
  const first = result?.images?.[0];
  if (!first) return require('../../../assets/nero3.png');
  return { uri: first.startsWith('http') ? first : `${Config.API_URL}${first}` };
};

const HeroStat = ({ value, label, suffix }) => {
  const shown = useCountUp(value);
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>
        {shown}
        {suffix ? <Text style={styles.heroStatSuffix}>{suffix}</Text> : null}
      </Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
};

const SkeletonBlock = ({ style, shimmer }) => (
  <Animated.View
    style={[styles.skeleton, style, { opacity: shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.55, 1, 0.55] }) }]}
  />
);

const QuickLink = ({ icon, title, sub, onPress }) => (
  <PressableScale containerStyle={styles.quickLinkWrap} style={styles.quickLink} hoverStyle={styles.quickLinkHover} onPress={onPress} accessibilityRole="link" accessibilityLabel={`${title}. ${sub}`}>
    <View style={styles.quickIcon}>
      <Feather name={icon} size={18} color={Colors.brandGreen} />
    </View>
    <View style={styles.quickText}>
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickSub}>{sub}</Text>
    </View>
    <Feather name="chevron-right" size={18} color={Colors.secondary} />
  </PressableScale>
);

const PatientHome = ({ user, isDesktop, navigation, onEditProfile }) => {
  const { imaging, visitCount, reminders, doneCount, markReminderDone } = usePatientHome();
  const sections = useStaggeredEntrance(5);
  const heroDrift = useDrift(18000);
  const filmScan = useLoop(2600, { pause: 900 });
  const shimmer = useLoop(1200);
  const totalMeds = reminders.items.length;
  const progressWidth = useProgress(totalMeds ? doneCount / totalMeds : 0);
  const latest = imaging.latest;

  const openLatest = () => navigation.navigate('ImagingResult', { resultId: latest._id, activeRoute: 'ImagingHistory' });

  return (
    <View style={[styles.page, isDesktop && styles.pageDesktop]}>
      {/* ── Hero chào ── */}
      <Animated.View style={[styles.hero, isDesktop && styles.heroDesktop, enterStyle(sections[0], 12)]}>
        {/* Ảnh đã phủ navy sẵn bên trái (vùng chữ); điện thoại bị cắt giữa nên phủ thêm 1 lớp */}
        <Animated.Image
          source={require('../../../assets/images/patient-home-banner.jpg')}
          style={[styles.heroImage, heroDrift.reduce ? null : driftStyle(heroDrift.value, { shift: 14 })]}
          resizeMode="cover"
          accessible={false}
        />
        {!isDesktop && <View style={styles.heroScrim} />}
        <Text style={styles.heroGreeting}>{greetingFor(new Date())},</Text>
        <Text style={[styles.heroName, !isDesktop && styles.heroNameMobile]} accessibilityRole="header">
          {displayName(user)}
        </Text>
        <Text style={styles.heroSub}>
          {totalMeds > 0
            ? `Hôm nay bạn có ${totalMeds} lần uống thuốc${doneCount ? `, đã xong ${doneCount}` : ''}.`
            : 'Hôm nay bạn không có lịch uống thuốc.'}
        </Text>
        <Pressable onPress={onEditProfile} accessibilityRole="button" hitSlop={8} style={styles.heroEdit}>
          {({ hovered }) => (
            <Text style={[styles.heroEditText, hovered && styles.heroEditTextHover]}>Chỉnh sửa thông tin cá nhân →</Text>
          )}
        </Pressable>

        <View style={styles.heroStats}>
          <HeroStat value={imaging.total} label="phim MRI/CT" />
          <View style={styles.heroDivider} />
          <HeroStat value={visitCount} label="lượt khám" />
          <View style={styles.heroDivider} />
          <HeroStat value={doneCount} suffix={`/${totalMeds}`} label="thuốc đã uống hôm nay" />
        </View>
      </Animated.View>

      <View style={[styles.columns, isDesktop && styles.columnsDesktop]}>
        {/* ── Cột chính ── */}
        <View style={isDesktop ? styles.mainCol : null}>
          <Animated.View style={enterStyle(sections[1])}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Kết quả phim gần nhất</Text>
              {imaging.total > 1 && (
                <Pressable onPress={() => navigation.navigate('ImagingHistory')} accessibilityRole="link" hitSlop={8}>
                  <Text style={styles.sectionLink}>Tất cả {imaging.total} phim →</Text>
                </Pressable>
              )}
            </View>

            {imaging.loading ? (
              <View style={[styles.filmCard, isDesktop && styles.filmCardDesktop]}>
                <SkeletonBlock shimmer={shimmer.value} style={isDesktop ? styles.filmImageDesktop : styles.filmImageMobile} />
                <View style={styles.filmBody}>
                  <SkeletonBlock shimmer={shimmer.value} style={{ width: '40%', height: 12 }} />
                  <SkeletonBlock shimmer={shimmer.value} style={{ width: '80%', height: 20, marginTop: 12 }} />
                  <SkeletonBlock shimmer={shimmer.value} style={{ width: '100%', height: 64, marginTop: 16 }} />
                </View>
              </View>
            ) : latest ? (
              <View style={[styles.filmCard, isDesktop && styles.filmCardDesktop]}>
                <View style={[styles.filmImageWrap, isDesktop ? styles.filmImageDesktop : styles.filmImageMobile]}>
                  <Image source={imageSource(latest)} style={styles.filmImage} resizeMode="cover" accessibilityLabel={`Ảnh phim ${latest.procedure || 'MRI'}`} />
                  {!filmScan.reduce && (
                    <Animated.View
                      pointerEvents="none"
                      style={[styles.filmScanLine, {
                        transform: [{ translateY: filmScan.value.interpolate({ inputRange: [0, 1], outputRange: [0, isDesktop ? 236 : 196] }) }],
                        opacity: filmScan.value.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 0] }),
                      }]}
                    />
                  )}
                  <View style={styles.filmBadge}>
                    <Feather name="cpu" size={12} color={Colors.brandMint} />
                    <Text style={styles.filmBadgeText}>Có phân tích AI</Text>
                  </View>
                </View>

                <View style={styles.filmBody}>
                  <Text style={styles.filmMeta}>
                    {formatDate(latest.reportDate || latest.orderDate)}
                    {latest.medicalRecordNumber ? `  ·  ${latest.medicalRecordNumber}` : ''}
                  </Text>
                  <Text style={styles.filmTitle}>{latest.procedure || 'Kết quả chụp MRI'}</Text>

                  <View style={styles.conclusionBox}>
                    <Text style={styles.conclusionLabel}>Kết luận của bác sĩ</Text>
                    <Text style={styles.conclusionText}>{latest.conclusion || 'Bác sĩ chưa ghi kết luận.'}</Text>
                  </View>

                  {latest.radiologist ? (
                    <Text style={styles.filmDoctor}>
                      <Feather name="user" size={13} color={Colors.secondary} /> {latest.radiologist}
                    </Text>
                  ) : null}

                  <View style={styles.filmActions}>
                    <PressableScale style={styles.primaryBtn} hoverStyle={styles.primaryBtnHover} onPress={openLatest}>
                      <Text style={styles.primaryBtnText}>Xem kết quả đầy đủ</Text>
                      <Feather name="arrow-right" size={16} color="#FFFFFF" />
                    </PressableScale>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Feather name="film" size={22} color={Colors.brandGreen} />
                </View>
                <Text style={styles.emptyTitle}>Chưa có phim nào</Text>
                <Text style={styles.emptyText}>Phim MRI/CT sẽ hiện ở đây sau khi bệnh viện tải lên hệ thống.</Text>
              </View>
            )}
          </Animated.View>

          <Animated.View style={[styles.quickLinks, isDesktop && styles.quickLinksDesktop, enterStyle(sections[2])]}>
            <QuickLink icon="file-text" title="Lịch sử khám" sub={`${visitCount} lượt khám đã lưu`} onPress={() => navigation.navigate('PatientRecords')} />
            <QuickLink icon="film" title="Phim MRI & CT" sub="Xem phim và kết quả" onPress={() => navigation.navigate('ImagingHistory')} />
            {!user?.isPremium && (
              <QuickLink icon="star" title="Nâng cấp Premium" sub="99.000đ/năm" onPress={() => navigation.navigate('Premium')} />
            )}
          </Animated.View>
        </View>

        {/* ── Cột phụ ── */}
        <View style={isDesktop ? styles.sideCol : null}>
          <Animated.View style={[styles.card, enterStyle(sections[3])]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Thuốc hôm nay</Text>
              {totalMeds > 0 && <Text style={styles.cardCount}>{doneCount}/{totalMeds} đã uống</Text>}
            </View>
            {totalMeds > 0 && (
              <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: totalMeds, now: doneCount }}>
                <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
              </View>
            )}

            {reminders.loading ? (
              [0, 1, 2].map((i) => <SkeletonBlock key={i} shimmer={shimmer.value} style={{ height: 52, marginTop: 12 }} />)
            ) : totalMeds === 0 ? (
              <Text style={styles.mutedText}>Hôm nay không có lịch uống thuốc.</Text>
            ) : (
              reminders.items.map((item) => {
                const done = item.status === 'done';
                const skipped = item.status === 'skipped';
                return (
                  <View key={item._id} style={styles.medRow}>
                    <View style={[styles.medTime, done && styles.medTimeDone]}>
                      <Text style={[styles.medTimeText, done && styles.medTimeTextDone]}>{item.time}</Text>
                    </View>
                    <View style={styles.medInfo}>
                      <Text style={[styles.medName, done && styles.medNameDone]}>{item.drugName}</Text>
                      <Text style={styles.medDose}>{item.dosageText}</Text>
                    </View>
                    {done ? (
                      <View style={styles.medDone}>
                        <Feather name="check-circle" size={16} color={Colors.brandGreen} />
                        <Text style={styles.medDoneText}>Đã uống</Text>
                      </View>
                    ) : skipped ? (
                      <Text style={styles.mutedText}>Đã bỏ qua</Text>
                    ) : (
                      <PressableScale
                        style={styles.medBtn}
                        hoverStyle={styles.medBtnHover}
                        onPress={() => markReminderDone(item._id)}
                        accessibilityLabel={`Đánh dấu đã uống ${item.drugName} lúc ${item.time}`}
                      >
                        <Text style={styles.medBtnText}>Đã uống</Text>
                      </PressableScale>
                    )}
                  </View>
                );
              })
            )}
          </Animated.View>

          <Animated.View style={[styles.helpCard, enterStyle(sections[4])]}>
            <Feather name="message-circle" size={20} color={Colors.brandGreen} />
            <Text style={styles.helpTitle}>Có thắc mắc về kết quả?</Text>
            <Text style={styles.helpText}>
              Mở kết quả phim và bấm “Giải thích bằng AI” để đọc bản dễ hiểu, hoặc gửi câu hỏi cho đội ngũ hỗ trợ.
            </Text>
            <PressableScale style={styles.secondaryBtn} hoverStyle={styles.secondaryBtnHover} onPress={() => navigation.navigate('Support')}>
              <Text style={styles.secondaryBtnText}>Gửi yêu cầu hỗ trợ</Text>
            </PressableScale>
          </Animated.View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { padding: 16, gap: 20 },
  pageDesktop: { padding: 28, gap: 24, maxWidth: 1240, width: '100%', alignSelf: 'center' },

  // Hero
  hero: {
    backgroundColor: Colors.brandNavy,
    borderRadius: 20,
    padding: 22,
    overflow: 'hidden',
  },
  heroDesktop: { padding: 32, minHeight: 260 },
  heroImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  heroScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(11, 42, 85, 0.62)' },
  heroGreeting: { color: Colors.brandMint, fontSize: 15, fontWeight: '600' },
  heroName: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', letterSpacing: -0.5, marginTop: 2, maxWidth: 620 },
  heroNameMobile: { fontSize: 24 },
  heroSub: { color: '#D7E3F4', fontSize: 15, lineHeight: 22, marginTop: 6 },
  heroEdit: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 4 },
  heroEditText: { color: Colors.brandGreenOnDark, fontSize: 13, fontWeight: '600' },
  heroEditTextHover: { textDecorationLine: 'underline' },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(164, 251, 229, 0.18)',
  },
  heroStat: { flexShrink: 1, minWidth: 0, maxWidth: 160 },
  heroStatValue: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  heroStatSuffix: { color: '#B9C9E0', fontSize: 18, fontWeight: '700' },
  heroStatLabel: { color: '#B9C9E0', fontSize: 12, marginTop: 2 },
  heroDivider: { width: 1, height: 36, backgroundColor: 'rgba(164, 251, 229, 0.18)' },

  // Bố cục 2 cột
  columns: { gap: 20 },
  columnsDesktop: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  mainCol: { flex: 1.6, gap: 20 },
  sideCol: { flex: 1, gap: 20 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.brandNavy },
  sectionLink: { fontSize: 14, fontWeight: '600', color: Colors.brandGreen },

  // Thẻ phim
  filmCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06), 0 4px 12px rgba(15, 23, 42, 0.05)',
  },
  filmCardDesktop: { flexDirection: 'row' },
  filmImageWrap: { backgroundColor: '#05101F', position: 'relative', overflow: 'hidden' },
  filmImageDesktop: { width: 260, minHeight: 240 },
  filmImageMobile: { width: '100%', height: 200 },
  filmImage: { width: '100%', height: '100%' },
  filmScanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 2,
    backgroundColor: Colors.brandMint,
    boxShadow: '0 0 14px 3px rgba(164, 251, 229, 0.55)',
  },
  filmBadge: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(11, 42, 85, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(164, 251, 229, 0.35)',
  },
  filmBadgeText: { color: Colors.brandMint, fontSize: 12, fontWeight: '600' },
  filmBody: { flex: 1, padding: 20 },
  filmMeta: { fontSize: 13, color: Colors.secondary, fontVariant: ['tabular-nums'] },
  filmTitle: { fontSize: 18, fontWeight: '700', color: Colors.brandNavy, marginTop: 4, lineHeight: 24 },
  conclusionBox: { marginTop: 14, padding: 14, borderRadius: 10, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  conclusionLabel: { fontSize: 12, fontWeight: '600', color: Colors.secondary, marginBottom: 4 },
  conclusionText: { fontSize: 15, lineHeight: 22, color: Colors.slateDark },
  filmDoctor: { fontSize: 13, color: Colors.slateMuted, marginTop: 12 },
  filmActions: { flexDirection: 'row', marginTop: 16 },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.brandGreen,
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 10,
    boxShadow: '0 6px 14px -6px rgba(6, 122, 94, 0.45)',
  },
  primaryBtnHover: { backgroundColor: Colors.brandGreenPressed },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.brandGreen,
    backgroundColor: Colors.surface,
    marginTop: 14,
  },
  secondaryBtnHover: { backgroundColor: Colors.brandGreenSoft },
  secondaryBtnText: { color: Colors.brandGreen, fontSize: 15, fontWeight: '700' },

  emptyCard: { alignItems: 'center', padding: 32, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.borderStrong, backgroundColor: Colors.surface },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.brandGreenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.brandNavy },
  emptyText: { fontSize: 14, color: Colors.secondary, textAlign: 'center', marginTop: 4, lineHeight: 20 },

  // Lối tắt
  quickLinks: { gap: 10 },
  quickLinksDesktop: { flexDirection: 'row' },
  quickLinkWrap: { flex: 1 },
  quickLink: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 64,
  },
  quickLinkHover: { borderColor: Colors.brandGreen, backgroundColor: '#FBFEFD' },
  quickIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.brandGreenSoft, alignItems: 'center', justifyContent: 'center' },
  quickText: { flex: 1 },
  quickTitle: { fontSize: 15, fontWeight: '700', color: Colors.brandNavy },
  quickSub: { fontSize: 13, color: Colors.secondary, marginTop: 1 },

  // Thẻ phụ
  card: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: Colors.brandNavy },
  cardCount: { fontSize: 13, fontWeight: '600', color: Colors.brandGreen, fontVariant: ['tabular-nums'] },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.brandGreenSoft, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.brandGreen },
  mutedText: { fontSize: 14, color: Colors.secondary, marginTop: 12 },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  medTime: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#EEF2F7' },
  medTimeDone: { backgroundColor: Colors.brandGreenSoft },
  medTimeText: { fontSize: 13, fontWeight: '700', color: Colors.brandNavy, fontVariant: ['tabular-nums'] },
  medTimeTextDone: { color: Colors.brandGreen },
  medInfo: { flex: 1 },
  medName: { fontSize: 15, fontWeight: '600', color: Colors.slateDark },
  medNameDone: { color: Colors.slateMuted },
  medDose: { fontSize: 13, color: Colors.secondary, marginTop: 1 },
  medDone: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  medDoneText: { fontSize: 13, fontWeight: '600', color: Colors.brandGreen },
  medBtn: { paddingHorizontal: 12, height: 34, borderRadius: 8, borderWidth: 1, borderColor: Colors.brandGreen, justifyContent: 'center' },
  medBtnHover: { backgroundColor: Colors.brandGreenSoft },
  medBtnText: { fontSize: 13, fontWeight: '700', color: Colors.brandGreen },

  helpCard: { backgroundColor: Colors.brandGreenSoft, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#CDEBDF' },
  helpTitle: { fontSize: 16, fontWeight: '700', color: Colors.brandNavy, marginTop: 10 },
  helpText: { fontSize: 14, color: Colors.slateMuted, lineHeight: 20, marginTop: 4 },

  skeleton: { backgroundColor: '#E8EDF3', borderRadius: 8 },
});

export default PatientHome;
