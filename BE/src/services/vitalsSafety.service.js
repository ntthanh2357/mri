/**
 * Service kiểm tra an toàn 5 chỉ số sinh tồn (Vital Signs)
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
    LABEL: 'Nồng độ SpO₂',
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
 * Tính tuổi chính xác từ các trường đầu vào đa dạng (age, patientAge, ageMonths, birthYear, dateOfBirth)
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
 * Bảng phân tầng sinh hiệu y khoa theo Độ tuổi & Giới tính
 * Tham chiếu theo Bộ Y Tế Việt Nam, WHO, American Heart Association (AHA) và American Academy of Pediatrics (AAP).
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

  // Cấu hình chỉ số chuẩn theo từng nhóm tuổi & giới tính
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
      // Người cao tuổi: nhịp tim nghỉ ngơi chậm hơn, huyết áp cho phép tới 145 mmHg do xơ cứng thành mạch sinh lý
      pulseMin = 55;
      pulseMax = 95;
      sysMin = 90;
      sysMax = 145;
      diaMin = 60;
      diaMax = 90;
      tempMin = 35.8;
      tempMax = 37.3; // Người cao tuổi giảm điều nhiệt, sốt có thể biểu hiện từ 37.4°C
      spo2Min = 94; // Người già cho phép SpO2 từ 94%
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
        // Nữ giới trẻ thường có huyết áp nền mềm hơn nam giới
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
      SAFE_TEXT: `${pulseMin}–${pulseMax} lần/phút`
    },
    SYSTOLIC: {
      MIN: sysMin,
      MAX: sysMax,
      UNIT: 'mmHg',
      LABEL: 'Huyết áp tâm thu',
      SAFE_TEXT: `${sysMin}–${sysMax} mmHg`
    },
    DIASTOLIC: {
      MIN: diaMin,
      MAX: diaMax,
      UNIT: 'mmHg',
      LABEL: 'Huyết áp tâm trương',
      SAFE_TEXT: `${diaMin}–${diaMax} mmHg`
    },
    TEMPERATURE: {
      MIN: tempMin,
      MAX: tempMax,
      UNIT: '°C',
      LABEL: 'Thân nhiệt',
      SAFE_TEXT: `${tempMin.toFixed(1)}–${tempMax.toFixed(1)}°C`
    },
    SPO2: {
      MIN: spo2Min,
      MAX: spo2Max,
      UNIT: '%',
      LABEL: 'Nồng độ SpO₂',
      SAFE_TEXT: `${spo2Min}–${spo2Max}%`
    },
    RESPIRATORY_RATE: {
      MIN: rrMin,
      MAX: rrMax,
      UNIT: 'lần/phút',
      LABEL: 'Nhịp thở',
      SAFE_TEXT: `${rrMin}–${rrMax} lần/phút`
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
 * Tách huyết áp chuỗi (ví dụ '120/80') hoặc object thành { systolic, diastolic }
 */
export const parseBloodPressure = (bpInput, systolicInput, diastolicInput) => {
  let systolic = null;
  let diastolic = null;

  if (systolicInput !== undefined && systolicInput !== null && systolicInput !== '') {
    const s = Number(systolicInput);
    if (!isNaN(s)) systolic = s;
  }
  if (diastolicInput !== undefined && diastolicInput !== null && diastolicInput !== '') {
    const d = Number(diastolicInput);
    if (!isNaN(d)) diastolic = d;
  }

  if ((systolic === null || diastolic === null) && typeof bpInput === 'string' && bpInput.includes('/')) {
    const parts = bpInput.split('/');
    if (parts.length >= 2) {
      const s = Number(parts[0].trim());
      const d = Number(parts[1].trim());
      if (!isNaN(s) && systolic === null) systolic = s;
      if (!isNaN(d) && diastolic === null) diastolic = d;
    }
  } else if ((systolic === null || diastolic === null) && bpInput && typeof bpInput === 'object') {
    if (bpInput.systolic != null && !isNaN(Number(bpInput.systolic))) systolic = Number(bpInput.systolic);
    if (bpInput.diastolic != null && !isNaN(Number(bpInput.diastolic))) diastolic = Number(bpInput.diastolic);
  } else if ((systolic === null || diastolic === null) && bpInput && !isNaN(Number(bpInput))) {
    // Trường hợp nhập 1 số đơn độc
    const s = Number(bpInput);
    if (systolic === null) systolic = s;
  }

  return { systolic, diastolic };
};

/**
 * Hàm đánh giá ngưỡng an toàn 5 chỉ số sinh tồn (UC-NUR-02)
 * Tự động phân tầng tham chiếu theo độ tuổi và giới tính.
 * @param {Object} vitals - Đối tượng chứa thông tin sinh hiệu
 * @param {Object} [patientContext] - Thông tin nhân khẩu học bệnh nhân { age, gender, birthYear, dateOfBirth, ageMonths }
 * @returns {Object} Kết quả đánh giá gồm isAbnormal, alerts, flags, details, summary, patientContext, thresholdsUsed
 */
export const evaluateVitalSigns = (vitals = {}, patientContext = {}) => {
  // Gộp thông tin nhân khẩu học từ cả param thứ 2 lẫn bên trong param thứ nhất
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

  const details = {};
  const demographicNotice = `[${ageGroupLabel}${genderLabel !== 'Khác/Không rõ' ? ` - ${genderLabel}` : ''}]`;

  // 1. Mạch (Pulse)
  const pulseVal = vitals.pulse !== undefined && vitals.pulse !== null && vitals.pulse !== ''
    ? Number(vitals.pulse)
    : null;

  if (pulseVal !== null && !isNaN(pulseVal)) {
    const isLow = pulseVal < thresholds.PULSE.MIN;
    const isHigh = pulseVal > thresholds.PULSE.MAX;
    const isAbnormal = isLow || isHigh;
    flags.pulse = isAbnormal;

    let alertMessage = null;
    if (isLow) {
      alertMessage = `Mạch cảnh báo: ${pulseVal} lần/phút ${demographicNotice} (Ngưỡng an toàn: ${thresholds.PULSE.SAFE_TEXT} - Nhịp tim chậm)`;
    } else if (isHigh) {
      alertMessage = `Mạch cảnh báo: ${pulseVal} lần/phút ${demographicNotice} (Ngưỡng an toàn: ${thresholds.PULSE.SAFE_TEXT} - Nhịp tim nhanh)`;
    }

    if (isAbnormal) {
      alerts.push({
        key: 'pulse',
        label: 'Mạch',
        value: pulseVal,
        unit: thresholds.PULSE.UNIT,
        safeRange: thresholds.PULSE.SAFE_TEXT,
        severity: 'danger',
        message: alertMessage
      });
    }

    details.pulse = {
      value: pulseVal,
      isAbnormal,
      safeRange: thresholds.PULSE.SAFE_TEXT,
      alertMessage
    };
  }

  // 2. Huyết áp (Blood Pressure: Tâm thu / Tâm trương)
  const { systolic, diastolic } = parseBloodPressure(
    vitals.bloodPressure,
    vitals.systolic,
    vitals.diastolic
  );

  let bpAbnormal = false;

  if (systolic !== null) {
    const isLow = systolic < thresholds.SYSTOLIC.MIN;
    const isHigh = systolic > thresholds.SYSTOLIC.MAX;
    const isAbnormal = isLow || isHigh;
    flags.systolic = isAbnormal;
    if (isAbnormal) bpAbnormal = true;

    let alertMessage = null;
    if (isLow) {
      alertMessage = `Huyết áp tâm thu thấp: ${systolic} mmHg ${demographicNotice} (Ngưỡng an toàn: ${thresholds.SYSTOLIC.SAFE_TEXT} - Tụt huyết áp)`;
    } else if (isHigh) {
      alertMessage = `Huyết áp tâm thu cao: ${systolic} mmHg ${demographicNotice} (Ngưỡng an toàn: ${thresholds.SYSTOLIC.SAFE_TEXT} - Tăng huyết áp)`;
    }

    if (isAbnormal) {
      alerts.push({
        key: 'systolic',
        label: 'Huyết áp tâm thu',
        value: systolic,
        unit: thresholds.SYSTOLIC.UNIT,
        safeRange: thresholds.SYSTOLIC.SAFE_TEXT,
        severity: 'danger',
        message: alertMessage
      });
    }

    details.systolic = {
      value: systolic,
      isAbnormal,
      safeRange: thresholds.SYSTOLIC.SAFE_TEXT,
      alertMessage
    };
  }

  if (diastolic !== null) {
    const isLow = diastolic < thresholds.DIASTOLIC.MIN;
    const isHigh = diastolic > thresholds.DIASTOLIC.MAX;
    const isAbnormal = isLow || isHigh;
    flags.diastolic = isAbnormal;
    if (isAbnormal) bpAbnormal = true;

    let alertMessage = null;
    if (isLow) {
      alertMessage = `Huyết áp tâm trương thấp: ${diastolic} mmHg ${demographicNotice} (Ngưỡng an toàn: ${thresholds.DIASTOLIC.SAFE_TEXT})`;
    } else if (isHigh) {
      alertMessage = `Huyết áp tâm trương cao: ${diastolic} mmHg ${demographicNotice} (Ngưỡng an toàn: ${thresholds.DIASTOLIC.SAFE_TEXT})`;
    }

    if (isAbnormal) {
      alerts.push({
        key: 'diastolic',
        label: 'Huyết áp tâm trương',
        value: diastolic,
        unit: thresholds.DIASTOLIC.UNIT,
        safeRange: thresholds.DIASTOLIC.SAFE_TEXT,
        severity: 'danger',
        message: alertMessage
      });
    }

    details.diastolic = {
      value: diastolic,
      isAbnormal,
      safeRange: thresholds.DIASTOLIC.SAFE_TEXT,
      alertMessage
    };
  }

  flags.bloodPressure = bpAbnormal;
  details.bloodPressure = {
    systolic,
    diastolic,
    formatted: systolic && diastolic ? `${systolic}/${diastolic} mmHg` : String(vitals.bloodPressure || ''),
    isAbnormal: bpAbnormal,
    safeRange: `${thresholds.SYSTOLIC.MIN}–${thresholds.SYSTOLIC.MAX} / ${thresholds.DIASTOLIC.MIN}–${thresholds.DIASTOLIC.MAX} mmHg`
  };

  // 3. Thân nhiệt (Temperature)
  const tempVal = vitals.temperature !== undefined && vitals.temperature !== null && vitals.temperature !== ''
    ? Number(vitals.temperature)
    : null;

  if (tempVal !== null && !isNaN(tempVal)) {
    const isLow = tempVal < thresholds.TEMPERATURE.MIN;
    const isHigh = tempVal > thresholds.TEMPERATURE.MAX;
    const isAbnormal = isLow || isHigh;
    flags.temperature = isAbnormal;

    let alertMessage = null;
    if (isLow) {
      alertMessage = `Thân nhiệt thấp: ${tempVal}°C ${demographicNotice} (Ngưỡng an toàn: ${thresholds.TEMPERATURE.SAFE_TEXT} - Hạ thân nhiệt)`;
    } else if (isHigh) {
      alertMessage = `Thân nhiệt cao: ${tempVal}°C ${demographicNotice} (Ngưỡng an toàn: ${thresholds.TEMPERATURE.SAFE_TEXT} - ${tempVal >= 38.0 ? 'Sốt cao' : 'Sốt nhẹ'})`;
    }

    if (isAbnormal) {
      alerts.push({
        key: 'temperature',
        label: 'Thân nhiệt',
        value: tempVal,
        unit: thresholds.TEMPERATURE.UNIT,
        safeRange: thresholds.TEMPERATURE.SAFE_TEXT,
        severity: 'danger',
        message: alertMessage
      });
    }

    details.temperature = {
      value: tempVal,
      isAbnormal,
      safeRange: thresholds.TEMPERATURE.SAFE_TEXT,
      alertMessage
    };
  }

  // 4. SpO2 (Nồng độ oxy bão hòa máu)
  const spo2Val = vitals.spo2 !== undefined && vitals.spo2 !== null && vitals.spo2 !== ''
    ? Number(vitals.spo2)
    : null;

  if (spo2Val !== null && !isNaN(spo2Val)) {
    const isLow = spo2Val < thresholds.SPO2.MIN;
    const isAbnormal = isLow || spo2Val > thresholds.SPO2.MAX;
    flags.spo2 = isAbnormal;

    let alertMessage = null;
    if (isLow) {
      alertMessage = `Nồng độ SpO₂ tụt thấp nguy hiểm: ${spo2Val}% ${demographicNotice} (Ngưỡng an toàn: ${thresholds.SPO2.SAFE_TEXT} - Thiếu oxy máu/suy hô hấp)`;
    } else if (spo2Val > 100) {
      alertMessage = `Nồng độ SpO₂ không hợp lệ: ${spo2Val}%`;
    }

    if (isAbnormal) {
      alerts.push({
        key: 'spo2',
        label: 'SpO₂',
        value: spo2Val,
        unit: thresholds.SPO2.UNIT,
        safeRange: thresholds.SPO2.SAFE_TEXT,
        severity: 'danger',
        message: alertMessage
      });
    }

    details.spo2 = {
      value: spo2Val,
      isAbnormal,
      safeRange: thresholds.SPO2.SAFE_TEXT,
      alertMessage
    };
  }

  // 5. Nhịp thở (Respiratory Rate)
  const rrVal = vitals.respiratoryRate !== undefined && vitals.respiratoryRate !== null && vitals.respiratoryRate !== ''
    ? Number(vitals.respiratoryRate)
    : (vitals.breath !== undefined && vitals.breath !== null && vitals.breath !== '' ? Number(vitals.breath) : null);

  if (rrVal !== null && !isNaN(rrVal)) {
    const isLow = rrVal < thresholds.RESPIRATORY_RATE.MIN;
    const isHigh = rrVal > thresholds.RESPIRATORY_RATE.MAX;
    const isAbnormal = isLow || isHigh;
    flags.respiratoryRate = isAbnormal;

    let alertMessage = null;
    if (isLow) {
      alertMessage = `Nhịp thở chậm bất thường: ${rrVal} lần/phút ${demographicNotice} (Ngưỡng an toàn: ${thresholds.RESPIRATORY_RATE.SAFE_TEXT})`;
    } else if (isHigh) {
      alertMessage = `Nhịp thở nhanh bất thường: ${rrVal} lần/phút ${demographicNotice} (Ngưỡng an toàn: ${thresholds.RESPIRATORY_RATE.SAFE_TEXT} - Thở gấp)`;
    }

    if (isAbnormal) {
      alerts.push({
        key: 'respiratoryRate',
        label: 'Nhịp thở',
        value: rrVal,
        unit: thresholds.RESPIRATORY_RATE.UNIT,
        safeRange: thresholds.RESPIRATORY_RATE.SAFE_TEXT,
        severity: 'danger',
        message: alertMessage
      });
    }

    details.respiratoryRate = {
      value: rrVal,
      isAbnormal,
      safeRange: thresholds.RESPIRATORY_RATE.SAFE_TEXT,
      alertMessage
    };
  }

  const isAbnormal = alerts.length > 0;
  const alertMessages = alerts.map(a => a.message);

  return {
    isAbnormal,
    alerts,
    alertMessages,
    flags,
    details,
    patientContext: {
      age,
      gender: genderLabel,
      ageGroup,
      ageGroupLabel
    },
    thresholdsUsed: thresholds,
    summary: isAbnormal
      ? `CẢNH BÁO: Phát hiện ${alerts.length} chỉ số sinh hiệu vượt ngưỡng an toàn [${ageGroupLabel}]!`
      : `Tất cả các chỉ số sinh hiệu ghi nhận đều nằm trong ngưỡng an toàn [${ageGroupLabel}].`
  };
};

/**
 * Alias thân thiện cho hàm kiểm tra sinh hiệu
 */
export const checkVitalSigns = evaluateVitalSigns;

export default {
  VITAL_THRESHOLDS,
  normalizeGender,
  resolvePatientAge,
  getVitalThresholds,
  parseBloodPressure,
  evaluateVitalSigns,
  checkVitalSigns
};
