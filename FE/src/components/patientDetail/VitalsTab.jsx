import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Heart, Droplets, Wind, Scale, Save } from 'lucide-react';

const VitalsTab = ({
  isDesktop,
  latestVital,
  renderSvgLineChart,
  currentUser,
  pulseInput,
  setPulseInput,
  systolicInput,
  setSystolicInput,
  diastolicInput,
  setDiastolicInput,
  spo2Input,
  setSpo2Input,
  heightInput,
  setHeightInput,
  weightInput,
  setWeightInput,
  handleAddVitals,
  isSubmittingVital,
  styles,
}) => {
  return (
    <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
      {/* Cột trái: Đồ thị và Chỉ số hiện tại */}
      <View style={isDesktop ? styles.mainCol : styles.fullWidth}>
        {/* 4 Chỉ số nhanh */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#FFE4E6', alignItems: 'center', justifyContent: 'center' }}>
              <Heart size={20} color="#E11D48" />
            </View>
            <View>
              <Text style={styles.metricLabelText}>Mạch</Text>
              <Text style={styles.metricValueText}>
                {latestVital?.pulse || '--'} <Text style={styles.metricUnitText}>bpm</Text>
              </Text>
            </View>
          </View>

          <View style={styles.metricCard}>
            <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
              <Droplets size={20} color="#DC2626" />
            </View>
            <View>
              <Text style={styles.metricLabelText}>Huyết áp</Text>
              <Text style={styles.metricValueText}>
                {latestVital ? `${latestVital.blood_pressure?.systolic}/${latestVital.blood_pressure?.diastolic}` : '--'} 
                <Text style={styles.metricUnitText}> mmHg</Text>
              </Text>
            </View>
          </View>

          <View style={styles.metricCard}>
            <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' }}>
              <Wind size={20} color="#0284C7" />
            </View>
            <View>
              <Text style={styles.metricLabelText}>SpO2</Text>
              <Text style={styles.metricValueText}>
                {latestVital?.spo2 || '--'} <Text style={styles.metricUnitText}>%</Text>
              </Text>
            </View>
          </View>

          <View style={styles.metricCard}>
            <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' }}>
              <Scale size={20} color="#059669" />
            </View>
            <View>
              <Text style={styles.metricLabelText}>Chỉ số BMI</Text>
              <Text style={styles.metricValueText}>
                {latestVital?.bmi || '--'} <Text style={styles.metricUnitText}>kg/m²</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Khung biểu đồ Line Chart */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitleText}>Biểu đồ diễn tiến Mạch & Huyết áp</Text>
            <Text style={styles.cardSubtitleText}>Hệ trục tọa độ hợp nhất (40 - 200)</Text>
          </View>
          {renderSvgLineChart()}
        </View>
      </View>

      {/* Cột phải: Form nhập sinh hiệu mới */}
      {currentUser?.role !== 'patient' && (
        <View style={isDesktop ? styles.sideCol : styles.fullWidth}>
          <View style={styles.card}>
            <Text style={styles.cardTitleText}>Ghi nhận sinh hiệu mới</Text>
            <Text style={styles.cardSubtitleText}>Cập nhật lập tức số đo khám của bệnh nhân</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Mạch (lần/phút) *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="VD: 75"
                value={pulseInput}
                onChangeText={setPulseInput}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>HA Tâm thu (mmHg) *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="VD: 120"
                  value={systolicInput}
                  onChangeText={(v) => setSystolicInput(v)}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>HA Tâm trương *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="VD: 80"
                  value={diastolicInput}
                  onChangeText={(v) => setDiastolicInput(v)}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>SpO2 (%) *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="VD: 98"
                value={spo2Input}
                onChangeText={setSpo2Input}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Chiều cao (cm)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="VD: 172"
                  value={heightInput}
                  onChangeText={setHeightInput}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Cân nặng (kg)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="VD: 68"
                  value={weightInput}
                  onChangeText={setWeightInput}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: '#0891B2', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }]}
              onPress={handleAddVitals}
              disabled={isSubmittingVital}
            >
              {isSubmittingVital ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Save size={16} color="#FFF" />
                  <Text style={styles.submitButtonText}>Lưu thông số sinh hiệu</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

export default VitalsTab;
