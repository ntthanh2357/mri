/**
 * Tiêu chuẩn ngưỡng an toàn 5 chỉ số sinh tồn (Vital Signs) theo Bộ Y Tế & Quốc Tế
 * UC-NUR-02: Ghi nhận 5 Chỉ số Sinh tồn (Mạch, Huyết áp tâm thu/tâm trương, Thân nhiệt, SpO₂, Nhịp thở)
 * Hệ thống tự động phân tầng ngưỡng an toàn theo Độ tuổi (Sơ sinh, Nhũ nhi, Trẻ nhỏ, Trẻ em, Thiếu niên, Trưởng thành, Cao tuổi)
 * và Giới tính (Nam, Nữ), phát hiện bất thường và cảnh báo nguy cơ lâm sàng.
 */

// Bảng ngưỡng chuẩn mặc định cho người lớn (Adult Default - Tương thích ngược toàn diện)
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
 * Chuẩn hóa giới tính
 * @param {string} g - 'Nam', 'Nữ', 'Male', 'Female',...
 * @returns {'male' | 'female' | 'other'}
 */
export const normalizeGender = (g) => {
  if (!g) return 'other';
  const s = String(g).trim().toLowerCase();
  if (['nam', 'male', 'm', 'trai', 'ông', 'anh'].includes(s)) return 'male';
  if (['nữ', 'nu', 'female', 'f', 'gái', 'bà', 'chị'].includes(s)) return 'female';
  return 'other';
};

/**
 * Tính tuổi chính xác từ các trường đầu vào đa dạng
 * @param {Object} context
 * @returns {number|null}
 */
export const resolvePatientAge = (context = {}) => {
  if (!context) return null;

  if (context.age !== undefined && context.age !== null && context.age !== '') {
    const num = Number(context.age);
    if (!isNaN(num) && num >= 0) return num;
  }
  if (context.patientAge !== undefined && context.patientAge !== null && context.patientAge !== '') {
    const num = Number(context.patientAge);
    if (!isNaN(num) && num >= 0) return num;
  }
  if (context.ageMonths !== undefined && context.ageMonths !== null && context.ageMonths !== '') {
    const m = Number(context.ageMonths);
    if (!isNaN(m) && m >= 0) return m / 12;
  }
  if (context.birthYear !== undefined && context.birthYear !== null && context.birthYear !== '') {
    const yr = Number(context.birthYear);
    if (!isNaN(yr) && yr > 1900) {
      const curYear = new Date().getFullYear();
      return Math.max(0, curYear - yr);
    }
  }
  const dob = context.dateOfBirth || context.dob;
  if (dob) {
    const d = new Date(dob);
    if (!isNaN(d.getTime())) {
      const now = new Date();
      let yrs = now.getFullYear() - d.getFullYear();
      const m = now.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < d.getDate())) {
        yrs--;
      }
      return Math.max(0, yrs);
    }
  }
  return null;
};

/**
 * Bảng phân tầng sinh hiệu y khoa theo Độ tuổi & Giới tính (FE)
 */
export const getVitalThresholds = (context = {}) => {
  const age = resolvePatientAge(context);
  const rawGender = context.gender || context.patientGender || context.profile?.gender || '';
  const genderNorm = normalizeGender(rawGender);
  const genderLabel = genderNorm === 'male' ? 'Nam' : genderNorm === 'female' ? 'Nữ' : 'Khác/Không rõ';

  // Xác định nhóm tuổi
  let ageGroup = 'ADULT';
  let ageGroupLabel = 'Người trưởng thành (18–64 tuổi)';

  if (age !== null && !isNaN(age)) {
    const ageMonths = context.ageMonths !== undefined && context.ageMonths !== null
      ? Number(context.ageMonths)
      : age * 12;

    if (ageMonths <= 1 || age < 0.08) {
      ageGroup = 'NEWBORN';
      ageGroupLabel = 'Trẻ sơ sinh (0–28 ngày)';
    } else if (age < 1) {
      ageGroup = 'INFANT';
      ageGroupLabel = 'Trẻ nhũ nhi (1–12 tháng)';
    } else if (age < 6) {
      ageGroup = 'TODDLER';
      ageGroupLabel = 'Trẻ nhỏ (1–5 tuổi)';
    } else if (age < 13) {
      ageGroup = 'CHILD';
      ageGroupLabel = 'Trẻ em (6–12 tuổi)';
    } else if (age < 18) {
      ageGroup = 'ADOLESCENT';
      ageGroupLabel = 'Thiếu niên (13–17 tuổi)';
    } else if (age >= 65) {
      ageGroup = 'ELDERLY';
      ageGroupLabel = 'Người cao tuổi (≥65 tuổi)';
    } else {
      ageGroup = 'ADULT';
      ageGroupLabel = 'Người trưởng thành (18–64 tuổi)';
    }
  }

  let pulseMin = 60;
  let pulseMax = 100;
  let sysMin = 90;
  let sysMax = 140;
  let diaMin = 60;
  let diaMax = 90;
  let tempMin = 36.0;
  let tempMax = 37.5;
  let spo2Min = 95;
  let spo2Max = 100;
  let rrMin = 12;
  let rrMax = 20;

  switch (ageGroup) {
    case 'NEWBORN':
      pulseMin = 100;
      pulseMax = 165;
      sysMin = 60;
      sysMax = 90;
      diaMin = 30;
      diaMax = 62;
      tempMin = 36.5;
      tempMax = 37.5;
      spo2Min = 95;
      spo2Max = 100;
      rrMin = 30;
      rrMax = 60;
      break;

    case 'INFANT':
      pulseMin = 90;
      pulseMax = 150;
      sysMin = 75;
      sysMax = 100;
      diaMin = 50;
      diaMax = 70;
      tempMin = 36.5;
      tempMax = 37.5;
      spo2Min = 95;
      spo2Max = 100;
      rrMin = 25;
      rrMax = 45;
      break;

    case 'TODDLER':
      pulseMin = 75;
      pulseMax = 130;
      sysMin = 80;
      sysMax = 115;
      diaMin = 50;
      diaMax = 80;
      tempMin = 36.3;
      tempMax = 37.5;
      spo2Min = 95;
      spo2Max = 100;
      rrMin = 20;
      rrMax = 35;
      break;

    case 'CHILD':
      pulseMin = 70;
      pulseMax = 115;
      sysMin = 85;
      sysMax = 120;
      diaMin = 55;
      diaMax = 80;
      tempMin = 36.0;
      tempMax = 37.5;
      spo2Min = 95;
      spo2Max = 100;
      rrMin = 15;
      rrMax = 25;
      break;

    case 'ADOLESCENT':
      pulseMin = 60;
      pulseMax = 100;
      rrMin = 12;
      rrMax = 20;
      tempMin = 36.0;
      tempMax = 37.5;
      spo2Min = 95;
      spo2Max = 100;
      if (genderNorm === 'male') {
        sysMin = 95;
        sysMax = 130;
        diaMin = 60;
        diaMax = 82;
      } else if (genderNorm === 'female') {
        sysMin = 90;
        sysMax = 125;
        diaMin = 58;
        diaMax = 80;
      } else {
        sysMin = 90;
        sysMax = 130;
        diaMin = 58;
        diaMax = 82;
      }
      break;

    case 'ELDERLY':
      pulseMin = 55;
      pulseMax = 95;
      sysMin = 90;
      sysMax = 145;
      diaMin = 60;
      diaMax = 90;
      tempMin = 35.8;
      tempMax = 37.3;
      spo2Min = 94;
      spo2Max = 100;
      rrMin = 12;
      rrMax = 22;
      break;

    case 'ADULT':
    default:
      pulseMin = 60;
      pulseMax = 100;
      tempMin = 36.0;
      tempMax = 37.5;
      spo2Min = 95;
      spo2Max = 100;
      rrMin = 12;
      rrMax = 20;
      if (genderNorm === 'female') {
        sysMin = 85;
        sysMax = 135;
        diaMin = 55;
        diaMax = 85;
      } else if (genderNorm === 'male') {
        sysMin = 90;
        sysMax = 140;
        diaMin = 60;
        diaMax = 90;
      } else {
        sysMin = 90;
        sysMax = 140;
        diaMin = 60;
        diaMax = 90;
      }
      break;
  }

  const thresholds = {
    PULSE: {
      MIN: pulseMin,
      MAX: pulseMax,
      UNIT: 'lần/phút',
      LABEL: 'Mạch',
      SAFE_TEXT: `${pulseMin}–${pulseMax} lần/phút`,
      safeRange: `${pulseMin}–${pulseMax} lần/phút`
    },
    SYSTOLIC: {
      MIN: sysMin,
      MAX: sysMax,
      UNIT: 'mmHg',
      LABEL: 'Huyết áp tâm thu',
      SAFE_TEXT: `${sysMin}–${sysMax} mmHg`,
      safeRange: `${sysMin}–${sysMax} mmHg`
    },
    DIASTOLIC: {
      MIN: diaMin,
      MAX: diaMax,
      UNIT: 'mmHg',
      LABEL: 'Huyết áp tâm trương',
      SAFE_TEXT: `${diaMin}–${diaMax} mmHg`,
      safeRange: `${diaMin}–${diaMax} mmHg`
    },
    TEMPERATURE: {
      MIN: tempMin,
      MAX: tempMax,
      UNIT: '°C',
      LABEL: 'Thân nhiệt',
      SAFE_TEXT: `${tempMin.toFixed(1)}–${tempMax.toFixed(1)}°C`,
      safeRange: `${tempMin.toFixed(1)}–${tempMax.toFixed(1)}°C`
    },
    SPO2: {
      MIN: spo2Min,
      MAX: spo2Max,
      UNIT: '%',
      LABEL: 'SpO₂',
      SAFE_TEXT: `${spo2Min}–${spo2Max}%`,
      safeRange: `${spo2Min}–${spo2Max}%`
    },
    RESPIRATORY_RATE: {
      MIN: rrMin,
      MAX: rrMax,
      UNIT: 'lần/phút',
      LABEL: 'Nhịp thở',
      SAFE_TEXT: `${rrMin}–${rrMax} lần/phút`,
      safeRange: `${rrMin}–${rrMax} lần/phút`
    }
  };

  return {
    age,
    genderNorm,
    genderLabel,
    ageGroup,
    ageGroupLabel,
    thresholds
  };
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
    const val = Number(str);
    if (systolic === null) systolic = val;
  } else if ((systolic === null || diastolic === null) && bpStr && typeof bpStr === 'object') {
    if (bpStr.systolic != null && !isNaN(Number(bpStr.systolic))) systolic = Number(bpStr.systolic);
    if (bpStr.diastolic != null && !isNaN(Number(bpStr.diastolic))) diastolic = Number(bpStr.diastolic);
  }

  return { systolic, diastolic };
};

/**
 * Đánh giá chi tiết 5 chỉ số sinh tồn (FE)
 * Tự động phân tầng tham chiếu theo độ tuổi và giới tính.
 * @param {Object} vitals - Các chỉ số sinh hiệu (pulse, bloodPressure, systolic, diastolic, temperature, spo2, respiratoryRate, breath, ...)
 * @param {Object} [patientContext] - Thông tin nhân khẩu học { age, gender, birthYear, dateOfBirth, ageMonths }
 */
export const evaluateVitalSigns = (vitals = {}, patientContext = {}) => {
  const demographicContext = {
    age: patientContext?.age ?? vitals?.age ?? patientContext?.patientAge ?? vitals?.patientAge,
    gender: patientContext?.gender ?? vitals?.gender ?? patientContext?.patientGender ?? vitals?.patientGender,
    birthYear: patientContext?.birthYear ?? vitals?.birthYear,
    dateOfBirth: patientContext?.dateOfBirth ?? vitals?.dateOfBirth ?? patientContext?.dob ?? vitals?.dob,
    ageMonths: patientContext?.ageMonths ?? vitals?.ageMonths,
  };

  const {
    age,
    genderLabel,
    ageGroup,
    ageGroupLabel,
    thresholds
  } = getVitalThresholds(demographicContext);

  const demographicNotice = `[${ageGroupLabel}${genderLabel !== 'Khác/Không rõ' ? ` - ${genderLabel}` : ''}]`;
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

  const {
    pulse,
    bloodPressure,
    systolic,
    diastolic,
    temperature,
    spo2,
    respiratoryRate,
    breath
  } = vitals;

  // 1. Mạch (Pulse)
  const pulseVal = pulse !== undefined && pulse !== null && pulse !== '' ? Number(pulse) : null;
  if (pulseVal !== null && !isNaN(pulseVal)) {
    const isLow = pulseVal < thresholds.PULSE.MIN;
    const isHigh = pulseVal > thresholds.PULSE.MAX;
    if (isLow || isHigh) {
      flags.pulse = true;
      alerts.push({
        key: 'pulse',
        label: 'Mạch',
        value: pulseVal,
        unit: thresholds.PULSE.UNIT,
        safeText: thresholds.PULSE.SAFE_TEXT,
        safeRange: thresholds.PULSE.SAFE_TEXT,
        message: isLow
          ? `Mạch chậm nguy hiểm: ${pulseVal} lần/phút ${demographicNotice} (Ngưỡng an toàn: ${thresholds.PULSE.SAFE_TEXT})`
          : `Mạch nhanh nguy hiểm: ${pulseVal} lần/phút ${demographicNotice} (Ngưỡng an toàn: ${thresholds.PULSE.SAFE_TEXT})`
      });
    }
  }

  // 2. Huyết áp (Blood Pressure)
  const bp = parseBloodPressure(bloodPressure, systolic, diastolic);
  if (bp.systolic !== null && !isNaN(bp.systolic)) {
    const isLow = bp.systolic < thresholds.SYSTOLIC.MIN;
    const isHigh = bp.systolic > thresholds.SYSTOLIC.MAX;
    if (isLow || isHigh) {
      flags.systolic = true;
      flags.bloodPressure = true;
      alerts.push({
        key: 'systolic',
        label: 'Huyết áp tâm thu',
        value: bp.systolic,
        unit: thresholds.SYSTOLIC.UNIT,
        safeText: thresholds.SYSTOLIC.SAFE_TEXT,
        safeRange: thresholds.SYSTOLIC.SAFE_TEXT,
        message: isLow
          ? `Huyết áp tâm thu tụt: ${bp.systolic} mmHg ${demographicNotice} (Ngưỡng an toàn: ${thresholds.SYSTOLIC.SAFE_TEXT})`
          : `Huyết áp tâm thu cao: ${bp.systolic} mmHg ${demographicNotice} (Ngưỡng an toàn: ${thresholds.SYSTOLIC.SAFE_TEXT})`
      });
    }
  }

  if (bp.diastolic !== null && !isNaN(bp.diastolic)) {
    const isLow = bp.diastolic < thresholds.DIASTOLIC.MIN;
    const isHigh = bp.diastolic > thresholds.DIASTOLIC.MAX;
    if (isLow || isHigh) {
      flags.diastolic = true;
      flags.bloodPressure = true;
      alerts.push({
        key: 'diastolic',
        label: 'Huyết áp tâm trương',
        value: bp.diastolic,
        unit: thresholds.DIASTOLIC.UNIT,
        safeText: thresholds.DIASTOLIC.SAFE_TEXT,
        safeRange: thresholds.DIASTOLIC.SAFE_TEXT,
        message: isLow
          ? `Huyết áp tâm trương thấp: ${bp.diastolic} mmHg ${demographicNotice} (Ngưỡng an toàn: ${thresholds.DIASTOLIC.SAFE_TEXT})`
          : `Huyết áp tâm trương cao: ${bp.diastolic} mmHg ${demographicNotice} (Ngưỡng an toàn: ${thresholds.DIASTOLIC.SAFE_TEXT})`
      });
    }
  }

  // 3. Thân nhiệt (Temperature)
  const tempVal = temperature !== undefined && temperature !== null && temperature !== '' ? Number(temperature) : null;
  if (tempVal !== null && !isNaN(tempVal)) {
    const isLow = tempVal < thresholds.TEMPERATURE.MIN;
    const isHigh = tempVal > thresholds.TEMPERATURE.MAX;
    if (isLow || isHigh) {
      flags.temperature = true;
      alerts.push({
        key: 'temperature',
        label: 'Thân nhiệt',
        value: tempVal,
        unit: thresholds.TEMPERATURE.UNIT,
        safeText: thresholds.TEMPERATURE.SAFE_TEXT,
        safeRange: thresholds.TEMPERATURE.SAFE_TEXT,
        message: isLow
          ? `Hạ thân nhiệt: ${tempVal}°C ${demographicNotice} (Ngưỡng an toàn: ${thresholds.TEMPERATURE.SAFE_TEXT})`
          : `Thân nhiệt cao (${tempVal >= 38.0 ? 'Sốt cao' : 'Sốt'}): ${tempVal}°C ${demographicNotice} (Ngưỡng an toàn: ${thresholds.TEMPERATURE.SAFE_TEXT})`
      });
    }
  }

  // 4. SpO2
  const spo2Val = spo2 !== undefined && spo2 !== null && spo2 !== '' ? Number(spo2) : null;
  if (spo2Val !== null && !isNaN(spo2Val)) {
    const isLow = spo2Val < thresholds.SPO2.MIN;
    const isInvalid = spo2Val > thresholds.SPO2.MAX;
    if (isLow || isInvalid) {
      flags.spo2 = true;
      alerts.push({
        key: 'spo2',
        label: 'SpO₂',
        value: spo2Val,
        unit: thresholds.SPO2.UNIT,
        safeText: thresholds.SPO2.SAFE_TEXT,
        safeRange: thresholds.SPO2.SAFE_TEXT,
        message: isLow
          ? `SpO₂ tụt thấp nguy hiểm: ${spo2Val}% ${demographicNotice} (Ngưỡng an toàn: ${thresholds.SPO2.SAFE_TEXT} - Thiếu oxy máu)`
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
    const isLow = rrVal < thresholds.RESPIRATORY_RATE.MIN;
    const isHigh = rrVal > thresholds.RESPIRATORY_RATE.MAX;
    if (isLow || isHigh) {
      flags.respiratoryRate = true;
      alerts.push({
        key: 'respiratoryRate',
        label: 'Nhịp thở',
        value: rrVal,
        unit: thresholds.RESPIRATORY_RATE.UNIT,
        safeText: thresholds.RESPIRATORY_RATE.SAFE_TEXT,
        safeRange: thresholds.RESPIRATORY_RATE.SAFE_TEXT,
        message: isLow
          ? `Nhịp thở chậm: ${rrVal} lần/phút ${demographicNotice} (Ngưỡng an toàn: ${thresholds.RESPIRATORY_RATE.SAFE_TEXT})`
          : `Nhịp thở nhanh: ${rrVal} lần/phút ${demographicNotice} (Ngưỡng an toàn: ${thresholds.RESPIRATORY_RATE.SAFE_TEXT} - Thở gấp)`
      });
    }
  }

  const isAbnormal = alerts.length > 0;
  return {
    isAbnormal,
    alerts,
    flags,
    patientContext: {
      age,
      gender: genderLabel,
      ageGroup,
      ageGroupLabel
    },
    thresholdsUsed: thresholds
  };
};

export default {
  VITAL_THRESHOLDS,
  normalizeGender,
  resolvePatientAge,
  getVitalThresholds,
  parseBloodPressure,
  evaluateVitalSigns
};
