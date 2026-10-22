/**
 * Tiêu chuẩn ngưỡng an toàn 5 chỉ số sinh tồn (Vital Signs) theo Bộ Y Tế & Quốc Tế
 * UC-NUR-02: Ghi nhận 5 Chỉ số Sinh tồn (Mạch, Huyết áp tâm thu/tâm trương, Thân nhiệt, SpO₂, Nhịp thở)
 */

export const VITAL_THRESHOLDS = {
  PULSE: {
    MIN: 60,
    MAX: 100,
    UNIT: 'lần/phút',
    LABEL: 'Mạch',
    SAFE_TEXT: '60–100 lần/phút'
  },
  SYSTOLIC: {
    MIN: 90,
    MAX: 140,
    UNIT: 'mmHg',
    LABEL: 'Huyết áp tâm thu',
    SAFE_TEXT: '90–140 mmHg'
  },
  DIASTOLIC: {
    MIN: 60,
    MAX: 90,
    UNIT: 'mmHg',
    LABEL: 'Huyết áp tâm trương',
    SAFE_TEXT: '60–90 mmHg'
  },
  TEMPERATURE: {
    MIN: 36.0,
    MAX: 37.5,
    UNIT: '°C',
    LABEL: 'Thân nhiệt',
    SAFE_TEXT: '36.0–37.5°C'
  },
  SPO2: {
    MIN: 95,
    MAX: 100,
    UNIT: '%',
    LABEL: 'SpO₂',
    SAFE_TEXT: '95–100%'
  },
  RESPIRATORY_RATE: {
    MIN: 12,
    MAX: 20,
    UNIT: 'lần/phút',
    LABEL: 'Nhịp thở',
    SAFE_TEXT: '12–20 lần/phút'
  }
};

/**
 * Tách huyết áp dạng chuỗi (ví dụ: "120/80")
 */
export const parseBloodPressure = (bpStr = '', sysStr = '', diaStr = '') => {
  let systolic = null;
  let diastolic = null;

  if (sysStr !== undefined && sysStr !== null && sysStr !== '') {
    const s = Number(sysStr);
    if (!isNaN(s)) systolic = s;
  }
  if (diaStr !== undefined && diaStr !== null && diaStr !== '') {
    const d = Number(diaStr);
    if (!isNaN(d)) diastolic = d;
  }

  const str = String(bpStr || '').trim();
  if ((systolic === null || diastolic === null) && str.includes('/')) {
    const parts = str.split('/');
    if (parts.length >= 2) {
      const s = Number(parts[0].trim());
      const d = Number(parts[1].trim());
      if (!isNaN(s) && systolic === null) systolic = s;
      if (!isNaN(d) && diastolic === null) diastolic = d;
    }
  } else if ((systolic === null || diastolic === null) && str && !isNaN(Number(str))) {
    // Nếu chỉ nhập 1 số vào ô huyết áp (như trường hợp 1 mmHg trong hình)
    const val = Number(str);
    if (systolic === null) systolic = val;
  }

  return { systolic, diastolic };
};

/**
 * Đánh giá chi tiết 5 chỉ số sinh tồn
 */
export const evaluateVitalSigns = ({
  pulse,
  bloodPressure,
  systolic,
  diastolic,
  temperature,
  spo2,
  respiratoryRate,
  breath
}) => {
  const alerts = [];
  const flags = {
    pulse: false,
    bloodPressure: false,
    systolic: false,
    diastolic: false,
    temperature: false,
    spo2: false,
    respiratoryRate: false
  };

  // 1. Mạch (Pulse)
  const pulseVal = pulse !== undefined && pulse !== null && pulse !== '' ? Number(pulse) : null;
  if (pulseVal !== null && !isNaN(pulseVal)) {
    const isLow = pulseVal < VITAL_THRESHOLDS.PULSE.MIN;
    const isHigh = pulseVal > VITAL_THRESHOLDS.PULSE.MAX;
    if (isLow || isHigh) {
      flags.pulse = true;
      alerts.push({
        key: 'pulse',
        label: 'Mạch',
        value: pulseVal,
        unit: VITAL_THRESHOLDS.PULSE.UNIT,
        safeText: VITAL_THRESHOLDS.PULSE.SAFE_TEXT,
        message: isLow
          ? `Mạch chậm nguy hiểm: ${pulseVal} lần/phút (Ngưỡng an toàn: ${VITAL_THRESHOLDS.PULSE.SAFE_TEXT})`
          : `Mạch nhanh nguy hiểm: ${pulseVal} lần/phút (Ngưỡng an toàn: ${VITAL_THRESHOLDS.PULSE.SAFE_TEXT})`
      });
    }
  }

  // 2. Huyết áp (Blood Pressure)
  const bp = parseBloodPressure(bloodPressure, systolic, diastolic);
  if (bp.systolic !== null && !isNaN(bp.systolic)) {
    const isLow = bp.systolic < VITAL_THRESHOLDS.SYSTOLIC.MIN;
    const isHigh = bp.systolic > VITAL_THRESHOLDS.SYSTOLIC.MAX;
    if (isLow || isHigh) {
      flags.systolic = true;
      flags.bloodPressure = true;
      alerts.push({
        key: 'systolic',
        label: 'Huyết áp tâm thu',
        value: bp.systolic,
        unit: VITAL_THRESHOLDS.SYSTOLIC.UNIT,
        safeText: VITAL_THRESHOLDS.SYSTOLIC.SAFE_TEXT,
        message: isLow
          ? `Huyết áp tâm thu tụt: ${bp.systolic} mmHg (Ngưỡng an toàn: ${VITAL_THRESHOLDS.SYSTOLIC.SAFE_TEXT})`
          : `Huyết áp tâm thu cao: ${bp.systolic} mmHg (Ngưỡng an toàn: ${VITAL_THRESHOLDS.SYSTOLIC.SAFE_TEXT})`
      });
    }
  }

  if (bp.diastolic !== null && !isNaN(bp.diastolic)) {
    const isLow = bp.diastolic < VITAL_THRESHOLDS.DIASTOLIC.MIN;
    const isHigh = bp.diastolic > VITAL_THRESHOLDS.DIASTOLIC.MAX;
    if (isLow || isHigh) {
      flags.diastolic = true;
      flags.bloodPressure = true;
      alerts.push({
        key: 'diastolic',
        label: 'Huyết áp tâm trương',
        value: bp.diastolic,
        unit: VITAL_THRESHOLDS.DIASTOLIC.UNIT,
        safeText: VITAL_THRESHOLDS.DIASTOLIC.SAFE_TEXT,
        message: isLow
          ? `Huyết áp tâm trương thấp: ${bp.diastolic} mmHg (Ngưỡng an toàn: ${VITAL_THRESHOLDS.DIASTOLIC.SAFE_TEXT})`
          : `Huyết áp tâm trương cao: ${bp.diastolic} mmHg (Ngưỡng an toàn: ${VITAL_THRESHOLDS.DIASTOLIC.SAFE_TEXT})`
      });
    }
  }

  // 3. Thân nhiệt (Temperature)
  const tempVal = temperature !== undefined && temperature !== null && temperature !== '' ? Number(temperature) : null;
  if (tempVal !== null && !isNaN(tempVal)) {
    const isLow = tempVal < VITAL_THRESHOLDS.TEMPERATURE.MIN;
    const isHigh = tempVal > VITAL_THRESHOLDS.TEMPERATURE.MAX;
    if (isLow || isHigh) {
      flags.temperature = true;
      alerts.push({
        key: 'temperature',
        label: 'Thân nhiệt',
        value: tempVal,
        unit: VITAL_THRESHOLDS.TEMPERATURE.UNIT,
        safeText: VITAL_THRESHOLDS.TEMPERATURE.SAFE_TEXT,
        message: isLow
          ? `Hạ thân nhiệt: ${tempVal}°C (Ngưỡng an toàn: ${VITAL_THRESHOLDS.TEMPERATURE.SAFE_TEXT})`
          : `Thân nhiệt cao (${tempVal >= 38.0 ? 'Sốt cao' : 'Sốt'}): ${tempVal}°C (Ngưỡng an toàn: ${VITAL_THRESHOLDS.TEMPERATURE.SAFE_TEXT})`
      });
    }
  }

  // 4. SpO2
  const spo2Val = spo2 !== undefined && spo2 !== null && spo2 !== '' ? Number(spo2) : null;
  if (spo2Val !== null && !isNaN(spo2Val)) {
    const isLow = spo2Val < VITAL_THRESHOLDS.SPO2.MIN;
    const isInvalid = spo2Val > VITAL_THRESHOLDS.SPO2.MAX;
    if (isLow || isInvalid) {
      flags.spo2 = true;
      alerts.push({
        key: 'spo2',
        label: 'SpO₂',
        value: spo2Val,
        unit: VITAL_THRESHOLDS.SPO2.UNIT,
        safeText: VITAL_THRESHOLDS.SPO2.SAFE_TEXT,
        message: isLow
          ? `SpO₂ tụt thấp nguy hiểm: ${spo2Val}% (Ngưỡng an toàn: ${VITAL_THRESHOLDS.SPO2.SAFE_TEXT} - Thiếu oxy máu)`
          : `Chỉ số SpO₂ không hợp lệ: ${spo2Val}%`
      });
    }
  }

  // 5. Nhịp thở (Respiratory Rate / Breath)
  const breathInput = respiratoryRate !== undefined && respiratoryRate !== null && respiratoryRate !== ''
    ? respiratoryRate
    : breath;
  const rrVal = breathInput !== undefined && breathInput !== null && breathInput !== '' ? Number(breathInput) : null;
  if (rrVal !== null && !isNaN(rrVal)) {
    const isLow = rrVal < VITAL_THRESHOLDS.RESPIRATORY_RATE.MIN;
    const isHigh = rrVal > VITAL_THRESHOLDS.RESPIRATORY_RATE.MAX;
    if (isLow || isHigh) {
      flags.respiratoryRate = true;
      alerts.push({
        key: 'respiratoryRate',
        label: 'Nhịp thở',
        value: rrVal,
        unit: VITAL_THRESHOLDS.RESPIRATORY_RATE.UNIT,
        safeText: VITAL_THRESHOLDS.RESPIRATORY_RATE.SAFE_TEXT,
        message: isLow
          ? `Nhịp thở chậm: ${rrVal} lần/phút (Ngưỡng an toàn: ${VITAL_THRESHOLDS.RESPIRATORY_RATE.SAFE_TEXT})`
          : `Nhịp thở nhanh: ${rrVal} lần/phút (Ngưỡng an toàn: ${VITAL_THRESHOLDS.RESPIRATORY_RATE.SAFE_TEXT} - Thở gấp)`
      });
    }
  }

  const isAbnormal = alerts.length > 0;
  return {
    isAbnormal,
    alerts,
    flags
  };
};

export default {
  VITAL_THRESHOLDS,
  parseBloodPressure,
  evaluateVitalSigns
};
