import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Rect, Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';
import Colors from '../../constants/colors';
import { VITAL_METRICS, vitalSeries, chartRange, bpStatus, pulseStatus, spo2Status, temperatureStatus } from '../../utils/myHealth';

// UC-PAT-12 — Biểu đồ diễn biến sinh hiệu (12 lần đo gần nhất), vẽ bằng react-native-svg (chạy cả web lẫn điện thoại).
// Nền xanh nhạt = vùng bình thường; huyết áp dùng 2 đường kẻ tham chiếu 120 (tâm thu) / 80 (tâm trương).

const HEIGHT = 200;
const PAD = { left: 40, right: 14, top: 14, bottom: 28 };
const LINE_COLORS = [Colors.brandGreen, Colors.brandNavy];
const STATUS_OF = {
  bp: (v) => bpStatus({ systolic: v[0], diastolic: v[1] }),
  pulse: (v) => pulseStatus(v[0]),
  spo2: (v) => spo2Status(v[0]),
  temperature: (v) => temperatureStatus(v[0]),
};
const fmtDay = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
const fmtVal = (key, values) => (key === 'bp' ? `${values[0]}/${values[1]}` : String(values[0]));

const VitalsChart = ({ items }) => {
  const [key, setKey] = useState('bp');
  const [width, setWidth] = useState(0);
  const metric = VITAL_METRICS.find((m) => m.key === key);
  const points = vitalSeries(items, key);
  const latest = points[points.length - 1];
  const status = latest ? STATUS_OF[key](latest.values) : null;

  const renderChart = () => {
    if (!width) return null;
    const { min, max } = chartRange(points, metric.band);
    const w = width - PAD.left - PAD.right;
    const h = HEIGHT - PAD.top - PAD.bottom;
    const x = (i) => PAD.left + (points.length === 1 ? w / 2 : (i * w) / (points.length - 1));
    const y = (v) => PAD.top + h - ((v - min) / (max - min)) * h;
    const refs = key === 'bp' ? [120, 80] : [];
    return (
      <Svg width={width} height={HEIGHT}>
        {key === 'bp' ? null : (
          <Rect x={PAD.left} y={y(metric.band.max)} width={w} height={Math.max(0, y(metric.band.min) - y(metric.band.max))} fill={Colors.brandGreenSoft} />
        )}
        {refs.map((r) => (
          <Line key={r} x1={PAD.left} x2={PAD.left + w} y1={y(r)} y2={y(r)} stroke={Colors.borderStrong} strokeDasharray="4 4" />
        ))}
        {(key === 'bp' ? refs : [metric.band.max, metric.band.min]).map((v) => (
          <SvgText key={`l${v}`} x={PAD.left - 6} y={y(v) + 4} fontSize={11} fill={Colors.slateMuted} textAnchor="end">{v}</SvgText>
        ))}
        {metric.lines.map((_, li) => (
          <React.Fragment key={li}>
            {points.length > 1 ? (
              <Polyline points={points.map((p, i) => `${x(i)},${y(p.values[li])}`).join(' ')} fill="none" stroke={LINE_COLORS[li]} strokeWidth={2.5} strokeLinejoin="round" />
            ) : null}
            {points.map((p, i) => (
              <Circle key={i} cx={x(i)} cy={y(p.values[li])} r={i === points.length - 1 ? 5 : 3.5} fill={Colors.surface} stroke={LINE_COLORS[li]} strokeWidth={2} />
            ))}
          </React.Fragment>
        ))}
        <SvgText x={x(0)} y={HEIGHT - 8} fontSize={11} fill={Colors.slateMuted} textAnchor={points.length === 1 ? 'middle' : 'start'}>{fmtDay(points[0].date)}</SvgText>
        {points.length > 1 ? (
          <SvgText x={x(points.length - 1)} y={HEIGHT - 8} fontSize={11} fill={Colors.slateMuted} textAnchor="end">{fmtDay(latest.date)}</SvgText>
        ) : null}
      </Svg>
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Diễn biến sinh hiệu</Text>
      <View style={styles.segment} accessibilityRole="tablist">
        {VITAL_METRICS.map((m) => {
          const on = m.key === key;
          return (
            <Pressable key={m.key} onPress={() => setKey(m.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
              style={({ hovered }) => [styles.segItem, on && styles.segItemOn, hovered && !on && styles.segItemHover]}>
              <Text style={[styles.segText, on && styles.segTextOn]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {points.length === 0 ? (
        <Text style={styles.empty}>Chưa có số đo {metric.label.toLowerCase()} nào.</Text>
      ) : (
        <>
          <Text style={styles.summary}>
            Lần gần nhất: <Text style={styles.summaryValue}>{fmtVal(key, latest.values)} {metric.unit}</Text>
            {status ? ` (${status.label.toLowerCase()})` : ''}
            {points.length > 1 ? `. ${points.length} lần đo gần nhất.` : '. Cần thêm lần đo để thấy diễn biến.'}
          </Text>
          <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.chart}
            accessible accessibilityLabel={`Biểu đồ ${metric.label}: ${points.map((p) => `${fmtDay(p.date)} ${fmtVal(key, p.values)}`).join(', ')}`}>
            {renderChart()}
          </View>
          <View style={styles.legend}>
            {metric.lines.length > 1 ? metric.lines.map((l, i) => (
              <View key={l} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: LINE_COLORS[i] }]} />
                <Text style={styles.legendText}>{l}</Text>
              </View>
            )) : null}
            <View style={styles.legendItem}>
              {key === 'bp' ? <View style={styles.legendDash} /> : <View style={styles.legendBand} />}
              <Text style={styles.legendText}>{key === 'bp' ? 'Ngưỡng bình thường 120/80' : `Vùng bình thường ${metric.band.min}–${metric.band.max} ${metric.unit}`}</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 18, gap: 12 },
  title: { fontSize: 17, fontWeight: '700', color: Colors.brandNavy },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segItem: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface, justifyContent: 'center' },
  segItemOn: { backgroundColor: Colors.brandGreen, borderColor: Colors.brandGreen },
  segItemHover: { backgroundColor: Colors.brandGreenSoft },
  segText: { fontSize: 14, fontWeight: '600', color: Colors.slateDark },
  segTextOn: { color: '#FFFFFF' },
  summary: { fontSize: 15, lineHeight: 22, color: Colors.slateMuted },
  summaryValue: { fontWeight: '700', color: Colors.slateDark, fontVariant: ['tabular-nums'] },
  chart: { width: '100%', height: HEIGHT },
  empty: { fontSize: 14, color: Colors.slateMuted, paddingVertical: 24, textAlign: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendBand: { width: 14, height: 10, borderRadius: 2, backgroundColor: Colors.brandGreenSoft, borderWidth: 1, borderColor: Colors.border },
  legendDash: { width: 16, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.borderStrong },
  legendText: { fontSize: 13, color: Colors.slateMuted },
});

export default VitalsChart;
