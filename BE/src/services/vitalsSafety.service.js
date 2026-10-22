/**
 * Service kiểm tra an toàn 5 chỉ số sinh tồn (Vital Signs)
 * UC-NUR-02: Ghi nhận 5 Chỉ số Sinh tồn (Mạch, Huyết áp tâm thu/tâm trương, Thân nhiệt, SpO₂, Nhịp thở)
 * Hệ thống tự động phát hiện và tô đỏ cảnh báo nếu chỉ số vượt ngưỡng an toàn.
 */

export const VITAL_THRESHOLDS = {
  PULSE: {
    MIN: 60,
    MAX: 100,
    UNIT: 'lần/phút',
    LABEL: 'Mạch'
  },
  SYSTOLIC: {
    MIN: 90,
    MAX: 140,
    UNIT: 'mmHg',
    LABEL: 'Huyết áp tâm thu'
  },
  DIASTOLIC: {
    MIN: 60,
    MAX: 90,
    UNIT: 'mmHg',
    LABEL: 'Huyết áp tâm trương'
  },
  TEMPERATURE: {
    MIN: 36.0,
    MAX: 37.5,
    UNIT: '°C',
    LABEL: 'Thân nhiệt'
  },
  SPO2: {
    MIN: 95,
    MAX: 100,
    UNIT: '%',
    LABEL: 'Nồng độ SpO₂'
  },
  RESPIRATORY_RATE: {
    MIN: 12,
    MAX: 20,
    UNIT: 'lần/phút',
    LABEL: 'Nhịp thở'
  }
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
  }

  return { systolic, diastolic };
};

/**
 * Hàm đánh giá ngưỡng an toàn 5 chỉ số sinh tồn (UC-NUR-02)
 * Có thể gọi trực tiếp trong test, controller hoặc service.
 * @param {Object} vitals - Đối tượng chứa thông tin sinh hiệu
 * @returns {Object} Kết quả đánh giá gồm isAbnormal, alerts, flags, details, summary
 */
export const evaluateVitalSigns = (vitals = {}) => {
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

  // 1. Mạch (Pulse)
  const pulseVal = vitals.pulse !== undefined && vitals.pulse !== null && vitals.pulse !== ''
    ? Number(vitals.pulse)
    : null;

  if (pulseVal !== null && !isNaN(pulseVal)) {
    const isLow = pulseVal < VITAL_THRESHOLDS.PULSE.MIN;
    const isHigh = pulseVal > VITAL_THRESHOLDS.PULSE.MAX;
    const isAbnormal = isLow || isHigh;
    flags.pulse = isAbnormal;

    let alertMessage = null;
    if (isLow) {
      alertMessage = `Mạch cảnh báo: ${pulseVal} lần/phút (Ngưỡng an toàn: 60–100 lần/phút - Nhịp tim chậm)`;
    } else if (isHigh) {
      alertMessage = `Mạch cảnh báo: ${pulseVal} lần/phút (Ngưỡng an toàn: 60–100 lần/phút - Nhịp tim nhanh)`;
    }

    if (isAbnormal) {
      alerts.push({
        key: 'pulse',
        label: 'Mạch',
        value: pulseVal,
        unit: VITAL_THRESHOLDS.PULSE.UNIT,
        safeRange: '60–100 lần/phút',
        severity: 'danger',
        message: alertMessage
      });
    }

    details.pulse = {
      value: pulseVal,
      isAbnormal,
      safeRange: '60–100 lần/phút',
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
    const isLow = systolic < VITAL_THRESHOLDS.SYSTOLIC.MIN;
    const isHigh = systolic > VITAL_THRESHOLDS.SYSTOLIC.MAX;
    const isAbnormal = isLow || isHigh;
    flags.systolic = isAbnormal;
    if (isAbnormal) bpAbnormal = true;

    let alertMessage = null;
    if (isLow) {
      alertMessage = `Huyết áp tâm thu thấp: ${systolic} mmHg (Ngưỡng an toàn: 90–140 mmHg - Tụt huyết áp)`;
    } else if (isHigh) {
      alertMessage = `Huyết áp tâm thu cao: ${systolic} mmHg (Ngưỡng an toàn: 90–140 mmHg - Tăng huyết áp)`;
    }

    if (isAbnormal) {
      alerts.push({
        key: 'systolic',
        label: 'Huyết áp tâm thu',
        value: systolic,
        unit: VITAL_THRESHOLDS.SYSTOLIC.UNIT,
        safeRange: '90–140 mmHg',
        severity: 'danger',
        message: alertMessage
      });
    }

    details.systolic = {
      value: systolic,
      isAbnormal,
      safeRange: '90–140 mmHg',
      alertMessage
    };
  }

  if (diastolic !== null) {
    const isLow = diastolic < VITAL_THRESHOLDS.DIASTOLIC.MIN;
    const isHigh = diastolic > VITAL_THRESHOLDS.DIASTOLIC.MAX;
    const isAbnormal = isLow || isHigh;
    flags.diastolic = isAbnormal;
    if (isAbnormal) bpAbnormal = true;

    let alertMessage = null;
    if (isLow) {
      alertMessage = `Huyết áp tâm trương thấp: ${diastolic} mmHg (Ngưỡng an toàn: 60–90 mmHg)`;
    } else if (isHigh) {
      alertMessage = `Huyết áp tâm trương cao: ${diastolic} mmHg (Ngưỡng an toàn: 60–90 mmHg)`;
    }

    if (isAbnormal) {
      alerts.push({
        key: 'diastolic',
        label: 'Huyết áp tâm trương',
        value: diastolic,
        unit: VITAL_THRESHOLDS.DIASTOLIC.UNIT,
        safeRange: '60–90 mmHg',
        severity: 'danger',
        message: alertMessage
      });
    }

    details.diastolic = {
      value: diastolic,
      isAbnormal,
      safeRange: '60–90 mmHg',
      alertMessage
    };
  }

  flags.bloodPressure = bpAbnormal;
  details.bloodPressure = {
    systolic,
    diastolic,
    formatted: systolic && diastolic ? `${systolic}/${diastolic} mmHg` : String(vitals.bloodPressure || ''),
    isAbnormal: bpAbnormal,
    safeRange: '90–140 / 60–90 mmHg'
  };

  // 3. Thân nhiệt (Temperature)
  const tempVal = vitals.temperature !== undefined && vitals.temperature !== null && vitals.temperature !== ''
    ? Number(vitals.temperature)
    : null;

  if (tempVal !== null && !isNaN(tempVal)) {
    const isLow = tempVal < VITAL_THRESHOLDS.TEMPERATURE.MIN;
    const isHigh = tempVal > VITAL_THRESHOLDS.TEMPERATURE.MAX;
    const isAbnormal = isLow || isHigh;
    flags.temperature = isAbnormal;

    let alertMessage = null;
    if (isLow) {
      alertMessage = `Thân nhiệt thấp: ${tempVal}°C (Ngưỡng an toàn: 36.0–37.5°C - Hạ thân nhiệt)`;
    } else if (isHigh) {
      alertMessage = `Thân nhiệt cao: ${tempVal}°C (Ngưỡng an toàn: 36.0–37.5°C - ${tempVal >= 38.0 ? 'Sốt cao' : 'Sốt nhẹ'})`;
    }

    if (isAbnormal) {
      alerts.push({
        key: 'temperature',
        label: 'Thân nhiệt',
        value: tempVal,
        unit: VITAL_THRESHOLDS.TEMPERATURE.UNIT,
        safeRange: '36.0–37.5°C',
        severity: 'danger',
        message: alertMessage
      });
    }

    details.temperature = {
      value: tempVal,
      isAbnormal,
      safeRange: '36.0–37.5°C',
      alertMessage
    };
  }

  // 4. SpO2 (Nồng độ oxy bão hòa máu)
  const spo2Val = vitals.spo2 !== undefined && vitals.spo2 !== null && vitals.spo2 !== ''
    ? Number(vitals.spo2)
    : null;

  if (spo2Val !== null && !isNaN(spo2Val)) {
    const isLow = spo2Val < VITAL_THRESHOLDS.SPO2.MIN;
    const isAbnormal = isLow || spo2Val > VITAL_THRESHOLDS.SPO2.MAX;
    flags.spo2 = isAbnormal;

    let alertMessage = null;
    if (isLow) {
      alertMessage = `Nồng độ SpO₂ tụt thấp nguy hiểm: ${spo2Val}% (Ngưỡng an toàn: 95–100% - Thiếu oxy máu/suy hô hấp)`;
    } else if (spo2Val > 100) {
      alertMessage = `Nồng độ SpO₂ không hợp lệ: ${spo2Val}%`;
    }

    if (isAbnormal) {
      alerts.push({
        key: 'spo2',
        label: 'SpO₂',
        value: spo2Val,
        unit: VITAL_THRESHOLDS.SPO2.UNIT,
        safeRange: '95–100%',
        severity: 'danger',
        message: alertMessage
      });
    }

    details.spo2 = {
      value: spo2Val,
      isAbnormal,
      safeRange: '95–100%',
      alertMessage
    };
  }

  // 5. Nhịp thở (Respiratory Rate)
  const rrVal = vitals.respiratoryRate !== undefined && vitals.respiratoryRate !== null && vitals.respiratoryRate !== ''
    ? Number(vitals.respiratoryRate)
    : (vitals.breath !== undefined && vitals.breath !== null && vitals.breath !== '' ? Number(vitals.breath) : null);

  if (rrVal !== null && !isNaN(rrVal)) {
    const isLow = rrVal < VITAL_THRESHOLDS.RESPIRATORY_RATE.MIN;
    const isHigh = rrVal > VITAL_THRESHOLDS.RESPIRATORY_RATE.MAX;
    const isAbnormal = isLow || isHigh;
    flags.respiratoryRate = isAbnormal;

    let alertMessage = null;
    if (isLow) {
      alertMessage = `Nhịp thở chậm bất thường: ${rrVal} lần/phút (Ngưỡng an toàn: 12–20 lần/phút)`;
    } else if (isHigh) {
      alertMessage = `Nhịp thở nhanh bất thường: ${rrVal} lần/phút (Ngưỡng an toàn: 12–20 lần/phút - Thở gấp)`;
    }

    if (isAbnormal) {
      alerts.push({
        key: 'respiratoryRate',
        label: 'Nhịp thở',
        value: rrVal,
        unit: VITAL_THRESHOLDS.RESPIRATORY_RATE.UNIT,
        safeRange: '12–20 lần/phút',
        severity: 'danger',
        message: alertMessage
      });
    }

    details.respiratoryRate = {
      value: rrVal,
      isAbnormal,
      safeRange: '12–20 lần/phút',
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
    summary: isAbnormal
      ? `CẢNH BÁO: Phát hiện ${alerts.length} chỉ số sinh hiệu vượt ngưỡng an toàn!`
      : 'Tất cả các chỉ số sinh hiệu ghi nhận đều nằm trong ngưỡng an toàn.'
  };
};

/**
 * Alias thân thiện cho hàm kiểm tra sinh hiệu
 */
export const checkVitalSigns = evaluateVitalSigns;

export default {
  VITAL_THRESHOLDS,
  parseBloodPressure,
  evaluateVitalSigns,
  checkVitalSigns
};
