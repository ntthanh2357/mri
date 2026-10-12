import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import {
  Brain, Sparkles, FileText, HeartPulse, ArrowRight, Phone, Mail, MapPin, CheckCircle2,
  ClipboardList, Stethoscope, ScanLine, BadgeCheck, User, Users, Building2, ShieldCheck,
  Siren, CalendarCheck, LifeBuoy, CircleHelp, SquareCheckBig,
} from 'lucide-react';

const IMG = {
  doctorsDiscuss: require('../../../assets/landing/doctors_mri_discuss.jpg'),
  doctorTablet: require('../../../assets/landing/doctor_tablet_scan.jpg'),
  doctorDesk: require('../../../assets/landing/doctor_desk.jpg'),
  mriFilms: require('../../../assets/landing/mri_films.jpg'),
};
export const LANDING_IMAGES = IMG;
import { Reveal, CountUp, FloatingOrb } from '../ui/Motion';

const isWeb = Platform.OS === 'web';
const C = {
  blue: '#067A5E', blueDark: '#05634D', navy: '#0B2A55', blueLight: '#E7F6F0',
  green: '#0F9D6B', greenLight: '#E3F7EF', ink: '#0F172A', body: '#475569', muted: '#64748B',
  line: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF',
};

const NAV_LINKS = [
  { key: 'services', label: 'Dịch vụ' },
  { key: 'ai', label: 'Công nghệ AI' },
  { key: 'process', label: 'Quy trình' },
  { key: 'roles', label: 'Dành cho ai' },
];

// ── Thanh điều hướng ──────────────────────────────────────────────────────────
export const LandingNav = ({ isDesktop, onNavigate, onLogin }) => (
  <View style={s.nav}>
    <View style={[s.container, s.navInner]}>
      <TouchableOpacity style={s.brand} onPress={() => onNavigate('top')}>
        <Image source={require('../../../assets/logo.png')} style={s.logo} resizeMode="contain" />
        <View>
          <Text style={s.brandName}>NeuroScan AI</Text>
          <Text style={s.brandSub}>BỆNH VIỆN CHUYÊN KHOA U NÃO</Text>
        </View>
      </TouchableOpacity>

      {isDesktop && (
        <View style={s.navLinks}>
          {NAV_LINKS.map((l) => (
            <TouchableOpacity key={l.key} onPress={() => onNavigate(l.key)} dataSet={{ hover: 'tint' }} style={s.navLink}>
              <Text style={s.navLinkText}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={s.navRight}>
        {isDesktop && (
          <View style={s.hotline}>
            <Phone size={14} color={C.blue} />
            <Text style={s.hotlineText}>0236 3650 676</Text>
          </View>
        )}
        <TouchableOpacity style={s.navCta} onPress={onLogin} dataSet={{ hover: 'glow' }}>
          <Text style={s.navCtaText}>Đăng nhập</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

// ── Phần giới thiệu trong hero (bên trái form đăng nhập) ─────────────────────
export const HeroIntro = ({ isDesktop, onExplore, onStart }) => (
  <View style={[s.heroIntro, !isDesktop && s.heroIntroMobile]}>
    <Reveal>
      <View style={s.heroChip}>
        <View style={s.pingDot} dataSet={{ anim: 'ping' }} />
        <Text style={s.heroChipText}>AI hỗ trợ chẩn đoán u não · trực 24/7</Text>
      </View>
    </Reveal>
    <Reveal delay={120}>
      <Text style={[s.heroTitle, !isDesktop && s.heroTitleMobile]} dataSet={{ font: 'display' }}>
        Chăm sóc chuyên sâu cho từng lát cắt MRI của bạn
      </Text>
    </Reveal>
    <Reveal delay={240}>
      <Text style={s.heroSub}>
        Kết hợp đội ngũ bác sĩ chuyên khoa với hệ thống AI đa mô hình để phát hiện, phân loại và theo dõi u não — từ lúc tiếp đón đến khi trả kết quả đã ký số.
      </Text>
    </Reveal>
    <Reveal delay={360}>
      <View style={s.heroCtas}>
        <TouchableOpacity style={s.ctaWhite} onPress={onStart} dataSet={{ hover: 'glow' }}>
          <Text style={s.ctaWhiteText}>Bắt đầu ngay</Text>
          <ArrowRight size={16} color={C.navy} />
        </TouchableOpacity>
        <TouchableOpacity style={s.ctaGhost} onPress={onExplore}>
          <Text style={s.ctaGhostText}>Tìm hiểu công nghệ AI</Text>
        </TouchableOpacity>
      </View>
    </Reveal>
    <Reveal delay={480}>
      <View style={s.heroStats}>
        <View style={s.heroStat}>
          <CountUp value={3461} style={s.heroStatVal} />
          <Text style={s.heroStatLbl}>ca MRI đã kiểm chứng</Text>
        </View>
        <View style={s.heroStatDivider} />
        <View style={s.heroStat}>
          <CountUp value={91.01} decimals={2} suffix="%" style={s.heroStatVal} />
          <Text style={s.heroStatLbl}>độ chính xác phân loại</Text>
        </View>
        <View style={s.heroStatDivider} />
        <View style={s.heroStat}>
          <Text style={s.heroStatVal}>&lt; 2s</Text>
          <Text style={s.heroStatLbl}>thời gian phân tích</Text>
        </View>
      </View>
    </Reveal>
  </View>
);

// ── Tiêu đề section ──────────────────────────────────────────────────────────
const SectionHead = ({ eyebrow, title, sub, center = true, light = false }) => (
  <Reveal style={[s.sectionHead, center && { alignItems: 'center' }]}>
    <Text style={[s.eyebrow, light && { color: '#A7F3D0' }]}>{eyebrow}</Text>
    <Text style={[s.sectionTitle, center && { textAlign: 'center' }, light && { color: C.white }]} dataSet={{ font: 'display' }}>
      {title}
    </Text>
    {sub ? <Text style={[s.sectionSub, center && { textAlign: 'center' }, light && { color: '#D3EFE4' }]}>{sub}</Text> : null}
  </Reveal>
);

const SERVICES = [
  { icon: Brain, color: C.blue, bg: C.blueLight, title: 'Chụp MRI sọ não', desc: 'Máy cộng hưởng từ 1.5T/3T, bảng kiểm an toàn bắt buộc trước buồng chụp và lưu trữ DICOM trên Mini-PACS.' },
  { icon: Sparkles, color: C.green, bg: C.greenLight, title: 'Phân tích AI tức thì', desc: 'Phân loại Glioma, Meningioma, Pituitary hoặc không có u kèm bản đồ nhiệt và vùng khoanh tổn thương.' },
  { icon: FileText, color: '#7C3AED', bg: '#F3EEFF', title: 'Bệnh án điện tử', desc: 'Hồ sơ EMR có phiên bản, ký số theo Thông tư 46/2018/TT-BYT và chia sẻ liên viện bằng mã QR.' },
  { icon: HeartPulse, color: '#E11D48', bg: '#FFF0F3', title: 'Điều trị & nội trú', desc: 'Kê đơn có kiểm tra tương tác thuốc, sơ đồ giường Neuro-ICU và quy trình báo động cấp cứu.' },
];

const STEPS = [
  { icon: ClipboardList, title: 'Tiếp đón & BHYT', desc: 'Đăng ký lượt khám, khai báo thẻ BHYT và thanh toán bằng VietQR.' },
  { icon: Stethoscope, title: 'Khám & chỉ định', desc: 'Bác sĩ khám lâm sàng, đo sinh hiệu và ra y lệnh chụp MRI.' },
  { icon: ScanLine, title: 'Chụp MRI & AI', desc: 'Kỹ thuật viên chụp phim, AI phân tích ngay khi ảnh được tải lên.' },
  { icon: BadgeCheck, title: 'Ký duyệt & trả kết quả', desc: 'Bác sĩ đối chiếu, ký số và gửi kết quả về cổng bệnh nhân.' },
];

const ROLES = [
  { icon: User, title: 'Bệnh nhân', points: ['Xem phim MRI & kết luận đã ký', 'Tải báo cáo PDF, chia sẻ bằng QR', 'Sổ sức khỏe cá nhân'] },
  { icon: Stethoscope, title: 'Bác sĩ', points: ['Hàng chờ khám theo ưu tiên', 'Đối chiếu kết quả AI', 'Kê đơn an toàn & ký số EMR'] },
  { icon: ScanLine, title: 'Kỹ thuật viên', points: ['Bảng kiểm an toàn MRI', 'Nộp ảnh & DICOM lên Mini-PACS', 'Yêu cầu chụp lại, hủy ca'] },
  { icon: Building2, title: 'Bệnh viện', points: ['Quản lý nhân sự & lịch trực', 'Sơ đồ giường, chuyển viện', 'Báo cáo doanh thu & BHYT'] },
];

const AI_BARS = [
  { label: 'Glioma', value: 4, color: '#F87171' },
  { label: 'Meningioma', value: 2, color: '#FBBF24' },
  { label: 'Pituitary', value: 1, color: '#A78BFA' },
  { label: 'Không có u', value: 93, color: '#34D399' },
];

// ── Hàng xen kẽ ảnh/chữ (kiểu Mayo Clinic) ───────────────────────────────────
const ZigzagRow = ({ isDesktop, reverse, image, title, text, cta, onPress, bubbles }) => {
  const textCol = (
    <Reveal style={[s.zzText, isDesktop && { flex: 1 }]}>
      <Text style={s.zzTitle} dataSet={{ font: 'display' }}>{title}</Text>
      <View style={s.zzBar} />
      <Text style={s.zzBody}>{text}</Text>
      <TouchableOpacity style={s.zzBtn} onPress={onPress} dataSet={{ hover: 'glow' }}>
        <Text style={s.zzBtnText}>{cta}</Text>
      </TouchableOpacity>
    </Reveal>
  );
  const imageCol = bubbles ? (
    <Reveal delay={120} style={[s.bubbleWrap, isDesktop && { flex: 1.1 }]}>
      <View style={s.bubbleHalo} />
      <Image source={image} style={s.bubbleImage} resizeMode="cover" />
      {bubbles.map((b, i) => {
        const Icon = b.icon;
        return (
          <View key={b.label} style={[s.bubble, b.pos]} dataSet={{ anim: i % 2 ? 'float-slow' : 'float', hover: 'lift' }}>
            <Icon size={24} color={b.color} strokeWidth={2.2} />
            <Text style={[s.bubbleText, { color: b.color }]}>{b.label}</Text>
          </View>
        );
      })}
    </Reveal>
  ) : (
    <Reveal delay={120} style={[s.zzImageWrap, isDesktop && { flex: 1.1 }]}>
      <Image source={image} style={s.zzImage} resizeMode="cover" />
    </Reveal>
  );
  return (
    <View style={[s.zzRow, isDesktop ? { flexDirection: reverse ? 'row-reverse' : 'row' } : { flexDirection: 'column-reverse' }]}>
      {textCol}
      {imageCol}
    </View>
  );
};

// ── Hai thẻ "Đặt lịch / Cần hỗ trợ" (kiểu Get Care / Need Help) ─────────────
const HelpCard = ({ icon: Icon, title, links, style }) => (
  <Reveal style={[s.helpCard, style]} dataSet={{ hover: 'lift' }}>
    <View style={s.helpIcon}><Icon size={30} color={C.blue} strokeWidth={1.8} /></View>
    <Text style={s.helpTitle}>{title}</Text>
    {links.map((l) => (
      <TouchableOpacity key={l.label} onPress={l.onPress} style={s.helpLinkRow}>
        <Text style={s.helpLink}>{l.label}</Text>
      </TouchableOpacity>
    ))}
  </Reveal>
);

// ── Các section bên dưới hero ────────────────────────────────────────────────
export const LandingBody = ({ isDesktop, onSectionLayout, onLogin, onRegister = onLogin, onCall, onEmail }) => {
  const col = (n) => (isDesktop ? { width: `${100 / n - 2}%` } : { width: '100%' });
  const track = (key) => (e) => onSectionLayout(key, e.nativeEvent.layout.y);

  return (
    <>
      {/* Dịch vụ */}
      <View style={s.section} onLayout={track('services')}>
        <View style={s.container}>
          <SectionHead
            eyebrow="DỊCH VỤ"
            title="Toàn bộ hành trình chẩn đoán u não trên một nền tảng"
            sub="Mỗi bước được số hóa và kết nối, giúp người bệnh được chẩn đoán nhanh hơn và bác sĩ có đủ thông tin để ra quyết định."
          />
          <View style={s.grid}>
            {SERVICES.map((sv, i) => {
              const Icon = sv.icon;
              return (
                <Reveal key={sv.title} delay={i * 110} style={[s.card, col(4)]} dataSet={{ hover: 'lift' }}>
                  <View style={[s.iconCircle, { backgroundColor: sv.bg }]}>
                    <Icon size={24} color={sv.color} strokeWidth={2.2} />
                  </View>
                  <Text style={s.cardTitle}>{sv.title}</Text>
                  <Text style={s.cardDesc}>{sv.desc}</Text>
                  <View style={s.cardLink}>
                    <Text style={[s.cardLinkText, { color: sv.color }]}>Tìm hiểu thêm</Text>
                    <ArrowRight size={14} color={sv.color} />
                  </View>
                </Reveal>
              );
            })}
          </View>
        </View>
      </View>

      {/* Hàng xen kẽ ảnh & chữ */}
      <View style={[s.section, { paddingTop: 24 }]}>
        <View style={[s.container, { gap: isDesktop ? 96 : 64 }]}>
          <ZigzagRow
            isDesktop={isDesktop}
            image={IMG.doctorTablet}
            title="Đau đầu kéo dài, mờ mắt hay co giật?"
            text="Đây có thể là dấu hiệu sớm của khối u nội sọ. Bác sĩ chuyên khoa thần kinh sẽ khám, chỉ định chụp MRI và AI phân tích phim ngay khi ảnh được tải lên — giúp bạn có câu trả lời sớm hơn."
            cta="Đăng ký khám ngay"
            onPress={onRegister}
          />
          <ZigzagRow
            isDesktop={isDesktop}
            reverse
            image={IMG.doctorDesk}
            title="Chưa biết nên bắt đầu từ đâu?"
            text="Từ tư vấn ban đầu, chụp MRI, phân tích AI đến cấp cứu thần kinh — chúng tôi giúp bạn chọn đúng dịch vụ cho tình trạng của mình và theo dõi hồ sơ ở một nơi duy nhất."
            cta="Bắt đầu"
            onPress={onLogin}
            bubbles={[
              { icon: Siren, label: 'Cấp cứu\nthần kinh', color: '#DC2626', pos: { top: '2%', left: '6%' } },
              { icon: ScanLine, label: 'Chụp\nMRI', color: C.blue, pos: { top: '-6%', left: '52%' } },
              { icon: Sparkles, label: 'Phân tích\nAI', color: C.green, pos: { top: '30%', right: '-2%' } },
              { icon: Stethoscope, label: 'Khám\nchuyên khoa', color: C.blueDark, pos: { bottom: '8%', left: '-2%' } },
            ]}
          />
        </View>
      </View>

      {/* Công nghệ AI */}
      <View style={[s.section, s.sectionAlt]} dataSet={{ bg: 'soft' }} onLayout={track('ai')}>
        <View style={[s.container, isDesktop && s.row, { gap: 48 }]}>
          <View style={isDesktop ? { flex: 1 } : null}>
            <SectionHead
              center={false}
              eyebrow="CÔNG NGHỆ AI"
              title="Ba mô hình cùng đọc phim, bác sĩ là người kết luận"
              sub="Hệ thống đồng thuận đa mô hình giúp giảm bỏ sót tổn thương và minh bạch mức độ tin cậy của từng kết quả."
            />
            {[
              'Ensemble ResNet50 · EfficientNet · DenseNet phân loại 4 nhóm u não',
              'YOLOv8 khoanh vùng tổn thương, Grad-CAM trực quan hóa vùng nghi ngờ',
              'Gemini phân xử khi các mô hình bất đồng, có lớp bảo vệ quyền riêng tư',
              'Bác sĩ duyệt hoặc hiệu chỉnh — phản hồi được dùng để huấn luyện lại',
            ].map((t, i) => (
              <Reveal key={t} delay={i * 100} style={s.checkRow}>
                <CheckCircle2 size={18} color={C.green} />
                <Text style={s.checkText}>{t}</Text>
              </Reveal>
            ))}
          </View>

          <Reveal delay={150} style={[s.scanCard, isDesktop ? { flex: 1 } : { marginTop: 28 }]}>
            <View style={s.scanHeader}>
              <View style={s.scanDots}>
                {['#F87171', '#FBBF24', '#34D399'].map((c) => <View key={c} style={[s.scanDot, { backgroundColor: c }]} />)}
              </View>
              <Text style={s.scanHeaderText}>Minh họa kết quả phân tích</Text>
            </View>
            <View style={s.scanViewport}>
              <Image source={IMG.mriFilms} style={s.scanImage} resizeMode="cover" />
              <View style={s.scanLine} dataSet={{ anim: 'scan' }} />
              <View style={s.scanBadge}>
                <ShieldCheck size={13} color="#34D399" />
                <Text style={s.scanBadgeText}>Đồng thuận 3/3 mô hình</Text>
              </View>
            </View>
            {AI_BARS.map((b, i) => (
              <View key={b.label} style={s.barRow}>
                <Text style={s.barLabel}>{b.label}</Text>
                <View style={s.barTrack}>
                  <Reveal delay={300 + i * 120} style={{ height: '100%' }}>
                    <View style={[s.barFill, { width: `${Math.max(b.value, 3)}%`, backgroundColor: b.color }]} dataSet={{ anim: 'grow' }} />
                  </Reveal>
                </View>
                <Text style={s.barValue}>{b.value}%</Text>
              </View>
            ))}
          </Reveal>
        </View>
      </View>

      {/* Quy trình */}
      <View style={s.section} onLayout={track('process')}>
        <View style={s.container}>
          <SectionHead
            eyebrow="QUY TRÌNH"
            title="Bốn bước khép kín, theo dõi được từng trạng thái"
            sub="Người bệnh và nhân viên y tế luôn biết hồ sơ đang ở đâu và bước tiếp theo là gì."
          />
          <View style={[s.grid, { alignItems: 'stretch' }]}>
            {STEPS.map((st, i) => {
              const Icon = st.icon;
              return (
                <Reveal key={st.title} delay={i * 140} style={[s.step, col(4)]}>
                  <View style={s.stepTop}>
                    <View style={s.stepNumber}><Text style={s.stepNumberText}>{i + 1}</Text></View>
                    {isDesktop && i < STEPS.length - 1 && <View style={s.stepConnector} />}
                  </View>
                  <View style={s.stepIcon}><Icon size={20} color={C.blue} /></View>
                  <Text style={s.cardTitle}>{st.title}</Text>
                  <Text style={s.cardDesc}>{st.desc}</Text>
                </Reveal>
              );
            })}
          </View>
        </View>
      </View>

      {/* Dải số liệu */}
      <View style={s.statsBand} dataSet={{ bg: 'band' }}>
        <FloatingOrb size={260} color="rgba(255,255,255,0.12)" style={{ top: -80, left: '8%' }} />
        <FloatingOrb size={220} color="rgba(167,243,208,0.18)" style={{ bottom: -90, right: '10%' }} slow />
        <View style={[s.container, s.grid, { marginTop: 0 }]}>
          {[
            { node: <CountUp value={4} style={s.bandVal} />, label: 'nhóm u não được phân loại' },
            { node: <CountUp value={3461} style={s.bandVal} />, label: 'ca MRI dùng để kiểm chứng' },
            { node: <CountUp value={92.04} decimals={2} suffix="%" style={s.bandVal} />, label: 'chỉ số F1 trung bình' },
            { node: <Text style={s.bandVal}>24/7</Text>, label: 'hỗ trợ kỹ thuật & cấp cứu' },
          ].map((it, i) => (
            <Reveal key={it.label} delay={i * 100} style={[s.bandItem, col(4)]}>
              {it.node}
              <Text style={s.bandLabel}>{it.label}</Text>
            </Reveal>
          ))}
        </View>
      </View>

      {/* Dành cho ai */}
      <View style={s.section} onLayout={track('roles')}>
        <View style={s.container}>
          <SectionHead
            eyebrow="DÀNH CHO AI"
            title="Mỗi vai trò một không gian làm việc riêng"
            sub="Phân quyền chặt chẽ theo vai trò và tách biệt dữ liệu giữa các bệnh viện."
          />
          <View style={s.grid}>
            {ROLES.map((r, i) => {
              const Icon = r.icon;
              return (
                <Reveal key={r.title} delay={i * 110} style={[s.card, s.roleCard, col(4)]} dataSet={{ hover: 'lift' }}>
                  <View style={s.roleHead}>
                    <View style={[s.iconCircle, { backgroundColor: C.blueLight, marginBottom: 0 }]}>
                      <Icon size={22} color={C.blue} />
                    </View>
                    <Text style={[s.cardTitle, { marginBottom: 0 }]}>{r.title}</Text>
                  </View>
                  {r.points.map((p) => (
                    <View key={p} style={s.rolePoint}>
                      <View style={s.roleBullet} />
                      <Text style={s.cardDesc}>{p}</Text>
                    </View>
                  ))}
                </Reveal>
              );
            })}
          </View>
        </View>
      </View>

      {/* Kêu gọi hành động */}
      <View style={[s.section, { paddingTop: 0 }]}>
        <Reveal style={[s.container, s.ctaBand]} dataSet={{ bg: 'hero' }}>
          <View style={isDesktop ? { flex: 1 } : null}>
            <Text style={s.ctaTitle} dataSet={{ font: 'display' }}>Sẵn sàng trải nghiệm NeuroScan AI?</Text>
            <Text style={s.ctaSub}>Đăng nhập để xem hồ sơ, kết quả MRI và trao đổi với bác sĩ của bạn.</Text>
          </View>
          <TouchableOpacity style={[s.ctaWhite, !isDesktop && { marginTop: 20 }]} onPress={onLogin} dataSet={{ hover: 'glow' }}>
            <Text style={s.ctaWhiteText}>Đăng nhập / Đăng ký</Text>
            <ArrowRight size={16} color={C.navy} />
          </TouchableOpacity>
        </Reveal>
      </View>

      {/* Đặt lịch / Cần hỗ trợ */}
      <View style={s.helpBand}>
        <View style={[s.container, isDesktop && s.row, { gap: 28, alignItems: 'stretch' }]}>
          <HelpCard
            icon={SquareCheckBig}
            title="Đặt lịch khám"
            style={isDesktop ? { flex: 1 } : null}
            links={[
              { label: '0236 3650 676', onPress: onCall },
              { label: 'Đăng ký tài khoản bệnh nhân', onPress: onRegister },
              { label: 'Xem kết quả MRI của tôi', onPress: onLogin },
            ]}
          />
          <HelpCard
            icon={CircleHelp}
            title="Cần hỗ trợ?"
            style={isDesktop ? { flex: 1 } : { marginTop: 20 }}
            links={[
              { label: 'Hotline 24/7: 1800 1234', onPress: onCall },
              { label: 'support@neuroscan.com', onPress: onEmail },
              { label: 'Câu hỏi thường gặp', onPress: onLogin },
            ]}
          />
        </View>
      </View>

      {/* Chân trang */}
      <View style={s.footer}>
        <View style={[s.container, isDesktop && s.row, { gap: 40, alignItems: 'flex-start' }]}>
          <View style={isDesktop ? { flex: 1.4 } : { marginBottom: 24 }}>
            <Text style={[s.brandName, { color: C.white, fontSize: 18 }]}>NeuroScan AI</Text>
            <Text style={[s.footerText, { marginTop: 10, maxWidth: 360 }]}>
              Bệnh viện chuyên khoa Ung thư Não ứng dụng trí tuệ nhân tạo trong chẩn đoán hình ảnh MRI sọ não.
            </Text>
          </View>
          <View style={isDesktop ? { flex: 1 } : { marginBottom: 24 }}>
            <Text style={s.footerHead}>Liên hệ</Text>
            <View style={s.footerRow}><Phone size={14} color="#7FD1B4" /><Text style={s.footerText}>0236 3650 676</Text></View>
            <View style={s.footerRow}><Mail size={14} color="#7FD1B4" /><Text style={s.footerText}>support@neuroscan.com</Text></View>
            <View style={s.footerRow}><MapPin size={14} color="#7FD1B4" /><Text style={s.footerText}>Đà Nẵng, Việt Nam</Text></View>
          </View>
          <View style={isDesktop ? { flex: 1 } : null}>
            <Text style={s.footerHead}>Lưu ý lâm sàng</Text>
            <View style={s.footerRow}>
              <ShieldCheck size={14} color="#7FD1B4" style={{ marginTop: 3 }} />
              <Text style={s.footerText}>Kết quả AI chỉ mang tính hỗ trợ. Chẩn đoán cuối cùng do bác sĩ chuyên khoa ký duyệt.</Text>
            </View>
          </View>
        </View>
        <View style={[s.container, s.footerBottom]}>
          <Text style={s.footerSmall}>© 2026 NeuroScan AI. Bảo lưu mọi quyền.</Text>
        </View>
      </View>
    </>
  );
};

const shadow = (y, blur, opacity) =>
  Platform.select({
    web: { boxShadow: `0 ${y}px ${blur}px rgba(11, 42, 91, ${opacity})` },
    default: { shadowColor: C.navy, shadowOffset: { width: 0, height: y }, shadowOpacity: opacity, shadowRadius: blur / 2, elevation: 3 },
  });

const s = StyleSheet.create({
  container: { width: '100%', maxWidth: 1200, alignSelf: 'center', paddingHorizontal: 24 },
  row: { flexDirection: 'row', alignItems: 'center' },

  // Nav
  nav: { backgroundColor: 'rgba(255,255,255,0.96)', borderBottomWidth: 1, borderBottomColor: C.line, zIndex: 20, ...(isWeb ? { backdropFilter: 'blur(10px)' } : {}) },
  navInner: { height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 38, height: 38, borderRadius: 10 },
  brandName: { fontSize: 16, fontWeight: '800', color: C.navy, letterSpacing: -0.3 },
  brandSub: { fontSize: 9, fontWeight: '700', color: C.green, letterSpacing: 0.8 },
  navLinks: { flexDirection: 'row', gap: 4 },
  navLink: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  navLinkText: { fontSize: 14, fontWeight: '600', color: C.body },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  hotline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hotlineText: { fontSize: 13, fontWeight: '700', color: C.navy },
  navCta: { backgroundColor: C.green, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999 },
  navCtaText: { color: C.white, fontWeight: '700', fontSize: 13 },

  // Hero
  heroIntro: { flex: 1, paddingRight: 48, justifyContent: 'center' },
  heroIntroMobile: { paddingRight: 0 },
  heroChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, marginBottom: 22 },
  pingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399' },
  heroChipText: { color: C.white, fontSize: 12, fontWeight: '600' },
  heroTitle: { color: C.white, fontSize: 50, lineHeight: 60, fontWeight: '700', marginBottom: 18 },
  heroTitleMobile: { fontSize: 32, lineHeight: 40 },
  heroSub: { color: '#D3EFE4', fontSize: 16, lineHeight: 26, maxWidth: 560, marginBottom: 28 },
  heroCtas: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 36 },
  ctaWhite: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 999, alignSelf: 'flex-start' },
  ctaWhiteText: { color: C.navy, fontWeight: '800', fontSize: 14 },
  ctaGhost: { paddingVertical: 14, paddingHorizontal: 22, borderRadius: 999, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)' },
  ctaGhostText: { color: C.white, fontWeight: '700', fontSize: 14 },
  heroStats: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 20 },
  heroStat: { minWidth: 110 },
  heroStatVal: { color: C.white, fontSize: 28, fontWeight: '800' },
  heroStatLbl: { color: '#BFE5D6', fontSize: 12, marginTop: 2 },
  heroStatDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.25)' },

  // Sections
  section: { paddingVertical: 88, backgroundColor: C.white },
  sectionAlt: { backgroundColor: C.bg },
  sectionHead: { marginBottom: 44 },
  eyebrow: { color: C.green, fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
  sectionTitle: { color: C.navy, fontSize: 36, lineHeight: 46, fontWeight: '700', maxWidth: 720 },
  sectionSub: { color: C.body, fontSize: 16, lineHeight: 26, marginTop: 14, maxWidth: 640 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 20 },
  card: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 26, ...shadow(6, 20, 0.05) },
  iconCircle: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  cardTitle: { color: C.ink, fontSize: 17, fontWeight: '700', marginBottom: 8 },
  cardDesc: { color: C.body, fontSize: 14, lineHeight: 22, flexShrink: 1 },
  cardLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18 },
  cardLinkText: { fontSize: 13, fontWeight: '700' },

  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  checkText: { color: C.ink, fontSize: 15, lineHeight: 22, flex: 1 },

  // Mock AI card
  scanCard: { backgroundColor: '#0B1730', borderRadius: 24, padding: 22, ...shadow(24, 60, 0.3) },
  scanHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  scanDots: { flexDirection: 'row', gap: 6 },
  scanDot: { width: 10, height: 10, borderRadius: 5 },
  scanHeaderText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  scanViewport: { height: 200, borderRadius: 16, backgroundColor: '#050B18', borderWidth: 1, borderColor: '#1E293B', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 18 },
  scanLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#34D399', ...(isWeb ? { boxShadow: '0 0 16px 4px rgba(52,211,153,0.6)' } : {}) },
  scanBadge: { position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(15,157,107,0.18)', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 },
  scanBadgeText: { color: '#A7F3D0', fontSize: 11, fontWeight: '700' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  barLabel: { color: '#CBD5E1', fontSize: 12, width: 86 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#1E293B', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barValue: { color: C.white, fontSize: 12, fontWeight: '700', width: 36, textAlign: 'right' },

  // Steps
  step: { paddingTop: 4 },
  stepTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  stepNumber: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', ...shadow(8, 18, 0.25) },
  stepNumberText: { color: C.white, fontWeight: '800', fontSize: 15 },
  stepConnector: { flex: 1, height: 2, marginLeft: 12, backgroundColor: '#BFE5D6' },
  stepIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.blueLight, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },

  // Stats band
  statsBand: { paddingVertical: 64, overflow: 'hidden', backgroundColor: C.blue },
  bandItem: { alignItems: 'center', paddingVertical: 8 },
  bandVal: { color: C.white, fontSize: 40, fontWeight: '800' },
  bandLabel: { color: '#D3EFE4', fontSize: 14, marginTop: 6, textAlign: 'center' },

  // Roles
  roleCard: { gap: 12 },
  roleHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  rolePoint: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  roleBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green, marginTop: 8 },

  // CTA band
  ctaBand: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', borderRadius: 28, paddingVertical: 44, paddingHorizontal: 44, backgroundColor: C.blue, overflow: 'hidden' },
  ctaTitle: { color: C.white, fontSize: 30, lineHeight: 38, fontWeight: '700', marginBottom: 8 },
  ctaSub: { color: '#D3EFE4', fontSize: 15, lineHeight: 24 },

  // Footer
  footer: { backgroundColor: C.navy, paddingTop: 56, paddingBottom: 24 },
  footerHead: { color: C.white, fontSize: 14, fontWeight: '700', marginBottom: 14 },
  footerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  footerText: { color: '#BFE5D6', fontSize: 13, lineHeight: 20, flexShrink: 1 },
  footerBottom: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)', marginTop: 32, paddingTop: 20 },
  footerSmall: { color: '#7FD1B4', fontSize: 12 },

  // Ảnh phim MRI trong khung minh họa AI
  scanImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', opacity: 0.85 },

  // Hàng xen kẽ
  zzRow: { alignItems: 'center', gap: 48 },
  zzText: { maxWidth: 520, alignSelf: 'center', width: '100%' },
  zzTitle: { color: C.ink, fontSize: 36, lineHeight: 44, fontWeight: '700' },
  zzBar: { width: 44, height: 4, borderRadius: 2, backgroundColor: C.blue, marginTop: 18, marginBottom: 20 },
  zzBody: { color: C.body, fontSize: 16, lineHeight: 28, marginBottom: 28 },
  zzBtn: { alignSelf: 'flex-start', backgroundColor: C.blue, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 6 },
  zzBtnText: { color: C.white, fontSize: 15, fontWeight: '700' },
  zzImageWrap: { width: '100%', borderRadius: 4, overflow: 'hidden', ...shadow(20, 50, 0.18) },
  zzImage: { width: '100%', aspectRatio: 1.25 },

  // Ảnh có bong bóng dịch vụ
  bubbleWrap: { width: '100%', position: 'relative', paddingTop: 40 },
  bubbleHalo: { position: 'absolute', top: 0, left: '6%', right: '6%', aspectRatio: 1, borderRadius: 9999, backgroundColor: '#E7F6F0' },
  bubbleImage: { width: '100%', aspectRatio: 1.35, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  bubble: { position: 'absolute', width: 118, height: 118, borderRadius: 59, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', gap: 6, ...shadow(12, 30, 0.16) },
  bubbleText: { fontSize: 13, fontWeight: '700', textAlign: 'center', lineHeight: 16 },

  // Thẻ hỗ trợ
  helpBand: { backgroundColor: '#F1F4F8', paddingVertical: 64 },
  helpCard: { backgroundColor: C.white, padding: 36, borderWidth: 1, borderColor: 'transparent' },
  helpIcon: { width: 64, height: 64, borderRadius: 32, borderWidth: 2.5, borderColor: C.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  helpTitle: { color: C.blueDark, fontSize: 34, fontWeight: '800', marginBottom: 20, letterSpacing: -0.5 },
  helpLinkRow: { alignSelf: 'flex-start', marginBottom: 14 },
  helpLink: { color: C.blue, fontSize: 16, fontWeight: '500', textDecorationLine: 'underline' },
});
