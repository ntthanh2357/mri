import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, StyleSheet, SafeAreaView, Platform
} from "react-native";
import ResponsiveLayout from "../components/ResponsiveLayout";
import Colors from "../constants/colors";
import PatientSafetyStrip from "../components/staff/PatientSafetyStrip";
import { get, post, put } from "../services/api.service";
import safeStorage from "../utils/safeStorage.js";
import { useAppDialog } from "../components/ui/AppDialog";
import {
  User,
  ClipboardList,
  FileText,
  CreditCard,
  CheckCircle2,
  ChevronLeft,
  Edit2,
  Printer,
  Save,
  Trash2,
  HelpCircle,
  Building2,
  Activity,
  Plus,
  Lock,
  AlertTriangle,
  AlertCircle,
  Brain,
  Eye,
  Droplets,
  Zap,
  Calendar,
  X,
  RefreshCw,
  HeartPulse
} from 'lucide-react';
import { evaluateVitalSigns, VITAL_THRESHOLDS, parseBloodPressure } from "../utils/vitalSignsSafety.js";

const NursePatientDetailScreen = ({ navigation, route }) => {
  let initialPatient = route?.params?.patient || {};
  if (typeof initialPatient === 'string') {
    try {
      initialPatient = JSON.parse(initialPatient);
    } catch (e) {
      initialPatient = {};
    }
  }
  const patient = initialPatient;
  const isRecordObj = Boolean(
    route?.params?.recordId ||
    patient.admissionType ||
    patient.signStatus ||
    patient.retentionCategory ||
    patient.treatmentPlan !== undefined ||
    (patient.patientId && patient._id && patient.patientId !== patient._id && patient.doctorInCharge)
  );
  const patientName  = patient.patientName || patient?.profile?.name || "Bệnh nhân";
  const patientIdStr = (isRecordObj ? (patient.patientId || patient._id) : (patient.patientId || patient._id)) || "";
  const gender       = patient.gender      || patient?.profile?.gender || "";
  const age          = patient.age         || "";
  const department   = patient.department  || "Khoa Ung Thư Não";
  const doctor       = patient.doctorInCharge || "Bác sĩ điều trị";

  const { dialog, notify } = useAppDialog();
  // Medical Record ID (chống duplicate hồ sơ bệnh án khi lập phiếu)
  const initialRecordId = route?.params?.recordId || patient.recordId || patient.medicalRecordId || (isRecordObj ? patient._id : null);
  const [resolvedRecordId, setResolvedRecordId] = useState(initialRecordId);

  // Active Visit ID state
  const [effectiveVisitId, setEffectiveVisitId] = useState(patient.visitId || null);
  // Lượt khám đang thao tác: truyền từ màn trước, hoặc tự tìm trong hàng chờ khi mở từ nơi khác
  const activeVisitId = effectiveVisitId || patient.visitId || null;

  // Navigation / Tabs state
  const [activeForm, setActiveForm] = useState("info");
  const [localUser, setLocalUser] = useState(null);

  // Forms Completion State
  const [examDone, setExamDone] = useState(false);
  const [orderDone, setOrderDone] = useState(false);

  // ── Mẫu khám bệnh (Clinical Exam Form) ──
  const [examPulse,  setExamPulse]  = useState("");
  const [examBP,     setExamBP]     = useState("");
  const [examHeight, setExamHeight] = useState("");
  const [examWeight, setExamWeight] = useState("");
  const [examBreath, setExamBreath] = useState("");
  const [examTemp,   setExamTemp]   = useState("");
  const [examSpo2,   setExamSpo2]   = useState("");
  const [examRequest,setExamRequest]= useState("Khám và đánh giá u não chuyên sâu");
  const [examObject, setExamObject] = useState("Thu phí");

  // ── Phiếu chỉ định dịch vụ (Service Order) ──
  const [orderPriority,   setOrderPriority]   = useState("Thường");
  const [orderDiagnosis,  setOrderDiagnosis]  = useState("");
  const [orderServices,   setOrderServices]   = useState(["Chụp MRI sọ não"]);
  const [orderNewService, setOrderNewService] = useState("");

  // ── Phiếu thu viện phí (Fee Items) — trống cho tới khi lưu phiếu chỉ định ──
  const [feeItems,    setFeeItems]    = useState([]);
  const [feeNote,     setFeeNote]     = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [invoiceDone, setInvoiceDone] = useState(false);

  // Local Cache Load/Save state
  const [isLoaded, setIsLoaded] = useState(false);

  const totalFee = feeItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  // Đánh giá các chỉ số sinh tồn và ngưỡng an toàn theo thời gian thực (UC-NUR-02)
  const vitalEval = evaluateVitalSigns({
    pulse: examPulse,
    bloodPressure: examBP,
    temperature: examTemp,
    spo2: examSpo2,
    respiratoryRate: examBreath,
    breath: examBreath
  });

  // ── UC-NUR-04: Phiếu Chăm sóc Điều dưỡng (Care Sheet) ──
  const [careSheets, setCareSheets] = useState([]);
  const [loadingCareSheets, setLoadingCareSheets] = useState(false);
  const [showCareSheetForm, setShowCareSheetForm] = useState(false);
  const [csSubmitting, setCsSubmitting] = useState(false);

  // Form states for Care Sheet (Bắt đầu hoàn toàn trống)
  const [csCareLevel, setCsCareLevel] = useState("");
  const [csPulse, setCsPulse] = useState("");
  const [csBP, setCsBP] = useState("");
  const [csTemp, setCsTemp] = useState("");
  const [csBreath, setCsBreath] = useState("");
  const [csSpo2, setCsSpo2] = useState("");
  const [csNurse, setCsNurse] = useState("");
  const [csProgressNotes, setCsProgressNotes] = useState("");
  const [csCareActions, setCsCareActions] = useState("");

  // Glasgow Coma Scale (GCS) - Trống ban đầu
  const [csGlasgowEye, setCsGlasgowEye] = useState("");
  const [csGlasgowVerbal, setCsGlasgowVerbal] = useState("");
  const [csGlasgowMotor, setCsGlasgowMotor] = useState("");

  // Pupils reflex - Trống ban đầu
  const [csPupilLeftSize, setCsPupilLeftSize] = useState("");
  const [csPupilRightSize, setCsPupilRightSize] = useState("");
  const [csPupilLeftReflex, setCsPupilLeftReflex] = useState("+");
  const [csPupilRightReflex, setCsPupilRightReflex] = useState("+");
  const [csPupilShape, setCsPupilShape] = useState("");

  // Cranial surgical drainage - Trống ban đầu
  const [csDrainageSite, setCsDrainageSite] = useState("");
  const [csDrainageVolume, setCsDrainageVolume] = useState("");
  const [csDrainageColor, setCsDrainageColor] = useState("");
  const [csDrainageCondition, setCsDrainageCondition] = useState("");

  // Fluid Infusions schedule - Danh sách trống ban đầu
  const [csFluidInfusions, setCsFluidInfusions] = useState([]);

  // Glasgow calculated score & classification
  const csGcsEyeNum = parseInt(csGlasgowEye) || 0;
  const csGcsVerbalNum = parseInt(csGlasgowVerbal) || 0;
  const csGcsMotorNum = parseInt(csGlasgowMotor) || 0;
  const hasGcsInput = csGcsEyeNum > 0 || csGcsVerbalNum > 0 || csGcsMotorNum > 0;
  const csGcsTotal = hasGcsInput ? (csGcsEyeNum + csGcsVerbalNum + csGcsMotorNum) : 0;
  const isCsGcsCritical = hasGcsInput && csGcsTotal <= 8 && csGcsTotal >= 3;
  const isCsGcsMedium = hasGcsInput && csGcsTotal > 8 && csGcsTotal <= 12;
  const csGcsClassification = !hasGcsInput
    ? "Chưa nhập điểm GCS"
    : csGcsTotal <= 8
    ? "Hôn mê sâu / Nguy kịch (Cảnh báo)"
    : csGcsTotal <= 12
    ? "Hôn mê vừa"
    : csGcsTotal <= 14
    ? "Hôn mê nhẹ / Lú lẫn"
    : "Tỉnh táo / Tri giác tốt";

  // Care sheet vitals evaluation
  const csVitalEval = evaluateVitalSigns({
    pulse: csPulse,
    bloodPressure: csBP,
    temperature: csTemp,
    spo2: csSpo2,
    respiratoryRate: csBreath
  });

  // Tự động tìm visitId nếu chưa được truyền từ route params
  useEffect(() => {
    if (patient.visitId) {
      setEffectiveVisitId(patient.visitId);
    } else if (patient._id) {
      get('/api/v1/visits/my-queue')
        .then(res => {
          const v = (res.visits || []).find(it => 
            (it.patientId?._id === patient._id || it.patientId === patient._id)
          );
          if (v?._id) setEffectiveVisitId(v._id);
        })
        .catch(e => console.log("Không tìm thấy queue visit:", e));
    }
  }, [patient._id, patient.visitId]);

  // 1. Fetch logged in user to show nurse name on signatures
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = safeStorage.getItem('user');
        if (storedUser) {
          setLocalUser(typeof storedUser === 'string' ? JSON.parse(storedUser) : storedUser);
          return;
        }
        const res = await get('/auth/me');
        if (res && res.user) {
          setLocalUser(res.user);
        }
      } catch (e) {
        console.log("Error fetching user profile in detail:", e);
      }
    };
    loadUser();
  }, []);

  // Bản nháp phiếu gắn với từng LƯỢT KHÁM (không phải bệnh nhân): bệnh nhân cũ đến khám lại sẽ có phiếu trống mới
  const formKey = activeVisitId ? `emr_detail_visit_${activeVisitId}` : (patient._id ? `emr_detail_${patient._id}` : null);

  // 2. Load Patient-Specific Form Cache from safeStorage
  useEffect(() => {
    if (!formKey) return;
    setIsLoaded(false);
    try {
      const savedData = safeStorage.getItem(formKey);
      if (savedData) {
        const data = typeof savedData === 'string' ? JSON.parse(savedData) : savedData;
        
        if (data.examDone !== undefined) setExamDone(data.examDone);
        if (data.examPulse !== undefined) setExamPulse(data.examPulse);
        if (data.examBP !== undefined) setExamBP(data.examBP);
        if (data.examHeight !== undefined) setExamHeight(data.examHeight);
        if (data.examWeight !== undefined) setExamWeight(data.examWeight);
        if (data.examBreath !== undefined) setExamBreath(data.examBreath);
        if (data.examTemp !== undefined) setExamTemp(data.examTemp);
        if (data.examSpo2 !== undefined) setExamSpo2(data.examSpo2);
        if (data.examRequest !== undefined) setExamRequest(data.examRequest);
        if (data.examObject !== undefined) setExamObject(data.examObject);
        
        if (data.orderDone !== undefined) setOrderDone(data.orderDone);
        if (data.orderPriority !== undefined) setOrderPriority(data.orderPriority);
        if (data.orderDiagnosis !== undefined) setOrderDiagnosis(data.orderDiagnosis);
        if (data.orderServices !== undefined) setOrderServices(data.orderServices);
        
        if (data.feeItems !== undefined) setFeeItems(data.feeItems);
        if (data.feeNote !== undefined) setFeeNote(data.feeNote);
        if (data.invoiceDone !== undefined) setInvoiceDone(data.invoiceDone);
      } else {
        // Reset to defaults for a new patient
        setExamDone(false);
        setExamPulse("");
        setExamBP("");
        setExamHeight("");
        setExamWeight("");
        setExamBreath("");
        setExamTemp("");
        setExamSpo2("");
        setExamRequest("Khám sức khỏe tổng quát");
        setExamObject("Thu phí");
        
        setOrderDone(false);
        setOrderPriority("Thường");
        setOrderDiagnosis("");
        setOrderServices(["Chụp MRI sọ não lát cắt mỏng", "Xét nghiệm máu"]);
        
        setFeeItems([]); // Viện phí chỉ sinh ra từ phiếu chỉ định đã lưu
        setFeeNote("");
        setInvoiceDone(false);
      }
    } catch (e) {
      console.log("Error loading cached patient form data:", e);
    } finally {
      setIsLoaded(true);
    }
  }, [formKey]);

  // 2b. Trạng thái thật của lượt khám lấy từ máy chủ (bản nháp trên trình duyệt chỉ để giữ chữ đang gõ dở)
  useEffect(() => {
    if (!isLoaded || !activeVisitId) return;
    let alive = true;
    get(`/api/v1/visits/${activeVisitId}`)
      .then((res) => {
        if (!alive || !res?.visit) return;
        const v = res.visit;
        const vt = v.vitals || {};
        const vitalsSaved = vt.pulse != null && !!vt.bloodPressure && vt.temperature != null && vt.spo2 != null;
        setExamDone(vitalsSaved);
        if (vitalsSaved) {
          setExamPulse((x) => x || String(vt.pulse));
          setExamBP((x) => x || vt.bloodPressure);
          setExamTemp((x) => x || String(vt.temperature));
          setExamSpo2((x) => x || String(vt.spo2));
          if (vt.respiratoryRate != null) setExamBreath((x) => x || String(vt.respiratoryRate));
        }
        const services = v.serviceOrder?.services || [];
        setOrderDone(services.length > 0);
        if (services.length) {
          setOrderServices(services);
          if (v.serviceOrder.diagnosis) setOrderDiagnosis(v.serviceOrder.diagnosis);
          if (v.serviceOrder.priority) setOrderPriority(v.serviceOrder.priority);
        }
        if (res.invoice?.items?.length) {
          setFeeItems(res.invoice.items.map((i) => ({ name: i.description, amount: String(i.amount) })));
        } else if (res.feeItems?.length) {
          setFeeItems(res.feeItems.map((i) => ({ name: i.description, amount: String(i.amount) })));
        } else if (!services.length) {
          setFeeItems([]); // bỏ danh sách phí cũ còn sót trong bản nháp khi chưa có chỉ định
        }
        setInvoiceDone(!!res.invoice);
      })
      .catch(() => { /* không lấy được thì giữ bản nháp */ });
    return () => { alive = false; };
  }, [isLoaded, formKey]);

  // 3. Auto-Save Patient-Specific Form Cache to safeStorage when state changes
  useEffect(() => {
    if (!formKey || !isLoaded) return;
    try {
      const cacheData = {
        examDone,
        examPulse,
        examBP,
        examHeight,
        examWeight,
        examBreath,
        examTemp,
        examSpo2,
        examRequest,
        examObject,
        orderDone,
        orderPriority,
        orderDiagnosis,
        orderServices,
        feeItems,
        feeNote,
        invoiceDone
      };
      safeStorage.setItem(formKey, JSON.stringify(cacheData));
    } catch (e) {
      console.log("Error caching patient form data:", e);
    }
  }, [
    formKey,
    isLoaded,
    examDone,
    examPulse,
    examBP,
    examHeight,
    examWeight,
    examBreath,
    examTemp,
    examSpo2,
    examRequest,
    examObject,
    orderDone,
    orderPriority,
    orderDiagnosis,
    orderServices,
    feeItems,
    feeNote,
    invoiceDone
  ]);

  const addOrderService = () => {
    const s = orderNewService.trim();
    if (!s) return;
    setOrderServices(p => [...p, s]);
    setOrderNewService("");
  };

  const getOrCreateMedicalRecordId = async () => {
    if (resolvedRecordId) {
      return resolvedRecordId;
    }
    if (isRecordObj && patient._id) {
      setResolvedRecordId(patient._id);
      return patient._id;
    }

    const pCode = patient.patientId;
    const pId = patient._id;
    const pName = patientName;

    try {
      // 1. Tìm bệnh án hiện có theo mã bệnh nhân hoặc ID
      let foundRecord = null;
      if (pCode) {
        const resCode = await get(`/emr/records?patientId=${encodeURIComponent(pCode)}`);
        if (resCode?.data && resCode.data.length > 0) {
          foundRecord = resCode.data[0];
        }
      }
      if (!foundRecord && pId) {
        const resPid = await get(`/emr/records?patientId=${encodeURIComponent(pId)}`);
        if (resPid?.data && resPid.data.length > 0) {
          foundRecord = resPid.data[0];
        }
      }
      if (!foundRecord && pName && pName !== "Bệnh nhân") {
        const resSearch = await get(`/emr/records?search=${encodeURIComponent(pName)}`);
        if (resSearch?.data && resSearch.data.length > 0) {
          foundRecord = resSearch.data.find(r => r.patientName?.trim()?.toLowerCase() === pName.trim()?.toLowerCase()) || resSearch.data[0];
        }
      }

      if (foundRecord?._id) {
        setResolvedRecordId(foundRecord._id);
        return foundRecord._id;
      }

      // 2. Chỉ tạo mới nếu bệnh nhân CHƯA CÓ bất kỳ hồ sơ bệnh án nào trong hệ thống
      const newRes = await post('/emr/records', {
        patientId: pCode || pId || `BN_${Date.now()}`,
        patientName: pName || "Bệnh nhân",
        gender: gender || "Nam",
        age: Number(age) || 30,
        admissionType: "Ngoại trú",
        department: department || "Khoa Ung Thư Não",
        diagnosis: patient.diagnosis || "Khám chuyên khoa ngoại thần kinh",
        doctorInCharge: doctor || "Bác sĩ điều trị",
      });

      const newId = newRes?.data?._id || newRes?.data?.data?._id;
      if (newId) {
        setResolvedRecordId(newId);
        return newId;
      }
      return pId;
    } catch (e) {
      console.error("Lỗi lấy/tạo bệnh án:", e);
      return pId; // fallback
    }
  };

  // 4. Save Clinical Exam (Vitals) to Backend EMR (UC-NUR-02)
  const handleSaveExamToBackend = async () => {
    if (!examPulse || !examBP || !examTemp || !examSpo2) {
      notify("Thông báo", "Vui lòng nhập đầy đủ các chỉ số sinh hiệu chính (Mạch, Huyết áp, Thân nhiệt, SpO₂).");
      return;
    }
    setSubmitting(true);
    try {
      const recordId = await getOrCreateMedicalRecordId();
      // Create Care Sheet in backend EMR database
      await post(`/emr/records/${recordId}/care-sheets`, {
        careLevel: 3,
        pulse: parseInt(examPulse),
        bloodPressure: examBP,
        temperature: parseFloat(examTemp),
        respiratoryRate: examBreath ? parseInt(examBreath) : 18,
        spo2: parseInt(examSpo2),
        progressNotes: "Yêu cầu khám: " + examRequest,
        careActions: `Đối tượng: ${examObject}. Chiều cao: ${examHeight}cm, Cân nặng: ${examWeight}kg.`,
        nurse: localUser?.profile?.name || "Điều dưỡng y tá"
      });

      // Update visit vitals if visitId exists (PUT /visits/:id/vitals)
      const targetVisitId = effectiveVisitId || patient.visitId;
      let backendAlerts = [];
      if (targetVisitId) {
        const vitalsRes = await put(`/api/v1/visits/${targetVisitId}/vitals`, {
          vitals: {
            pulse: parseInt(examPulse),
            bloodPressure: examBP,
            temperature: parseFloat(examTemp),
            spo2: parseInt(examSpo2),
            respiratoryRate: examBreath ? parseInt(examBreath) : 18
          }
        });
        if (vitalsRes?.alerts && vitalsRes.alerts.length > 0) {
          backendAlerts = vitalsRes.alerts;
        }
        // Cập nhật trạng thái lượt khám để thông báo Bác sĩ
        await put(`/api/v1/visits/${targetVisitId}/status`, { status: 'đang khám' });
      }

      setExamDone(true);
      if (vitalEval.isAbnormal || backendAlerts.length > 0) {
        const alertList = (backendAlerts.length > 0
          ? backendAlerts.map(a => typeof a === 'string' ? a : a.message)
          : vitalEval.alerts.map(a => a.message)
        ).join('\n• ');
        notify("Cảnh báo sinh hiệu bất thường", `Phiếu khám đã được lưu thành công vào hồ sơ.\n\n⚠️ CẢNH BÁO: Chỉ số vượt ngưỡng an toàn:\n• ${alertList}\n\nHệ thống đã tự động tô đỏ cảnh báo trên phiếu khám và chuyển lượt khám cho Bác sĩ xử lý.`
        );
      } else {
        notify("Thành công", "Phiếu khám lâm sàng và sinh hiệu đã được lưu thành công vào hồ sơ bệnh án!");
      }
    } catch (err) {
      notify("Lỗi", err?.message || "Không thể lưu thông tin phiếu khám lên hệ thống.");
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Save Service Order (Chỉ định) — lưu vào lượt khám, máy chủ trả về danh sách viện phí theo bảng giá
  const handleSaveOrderToBackend = async () => {
    if (!examDone) {
      notify("Chưa đo sinh hiệu", "Vui lòng hoàn thành và lưu tab Khám bệnh trước khi chỉ định dịch vụ.");
      return;
    }
    if (orderServices.length === 0) {
      notify("Thông báo", "Vui lòng chỉ định ít nhất một dịch vụ.");
      return;
    }
    // Phiếu chỉ định cận lâm sàng bắt buộc ghi chẩn đoán sơ bộ (hồ sơ bệnh án cũng yêu cầu trường này)
    if (!orderDiagnosis.trim()) {
      notify("Thiếu chẩn đoán sơ bộ", "Vui lòng nhập chẩn đoán lâm sàng sơ bộ trước khi lưu phiếu chỉ định.");
      return;
    }
    setSubmitting(true);
    try {
      const recordId = await getOrCreateMedicalRecordId();
      // Update MedicalRecord diagnosis and treatment plan
      await put(`/emr/records/${recordId}`, {
        diagnosis: orderDiagnosis.trim(),
        treatmentPlan: `Chỉ định dịch vụ cận lâm sàng: ${orderServices.join(", ")}`
      });

      if (activeVisitId) {
        const res = await put(`/api/v1/visits/${activeVisitId}/service-order`, {
          services: orderServices,
          diagnosis: orderDiagnosis,
          priority: orderPriority,
        });
        setFeeItems((res?.feeItems || []).map((i) => ({ name: i.description, amount: String(i.amount) })));
      } else {
        setFeeItems([]);
      }

      setOrderDone(true);
      notify("Thành công", activeVisitId
        ? "Đã lưu phiếu chỉ định. Danh sách viện phí đã được tính theo bảng giá bệnh viện ở tab Viện phí."
        : "Đã lưu chỉ định vào hồ sơ bệnh án. Để lập phiếu thu, vui lòng mở bệnh nhân từ Hàng chờ / Lượt khám hôm nay.");
    } catch (err) {
      notify("Lỗi", err?.message || "Không thể lưu phiếu chỉ định lên hệ thống.");
    } finally {
      setSubmitting(false);
    }
  };

  // 6. Gửi phiếu thu sang quầy Thu Ngân — máy chủ tự lập dòng phí từ phiếu chỉ định & bảng giá
  const handleConfirmFee = async () => {
    if (!activeVisitId) {
      notify("Thông báo", "Phiếu thu phải gắn với một lượt khám. Vui lòng mở bệnh nhân từ Hàng chờ / Lượt khám hôm nay.");
      return;
    }
    if (!examDone || !orderDone) {
      notify("Chưa đủ thông tin", "Cần lưu tab Khám bệnh và tab Chỉ định trước khi gửi phiếu thu.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await post("/api/v1/invoices/pending", { visitId: activeVisitId, notes: feeNote });
      const inv = res?.invoice;
      if (inv?.items) setFeeItems(inv.items.map((i) => ({ name: i.description, amount: String(i.amount) })));
      setInvoiceDone(true);
      await notify(
        "Đã gửi sang Thu Ngân",
        `Phiếu thu của ${patientName} đã chuyển sang quầy Thu Ngân.\nTổng thu: ${(inv?.totalAmount ?? totalFee).toLocaleString("vi-VN")} VNĐ`,
      );
      navigation.goBack();
    } catch (err) {
      notify("Lỗi", err?.message || "Không thể tạo hóa đơn chờ thanh toán.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── UC-NUR-04: Care Sheet Handlers ──
  const fetchPatientCareSheets = async () => {
    setLoadingCareSheets(true);
    try {
      const recordId = await getOrCreateMedicalRecordId();
      const res = await get(`/emr/records/${recordId}/care-sheets`);
      if (res && res.data) {
        setCareSheets(res.data);
      }
    } catch (e) {
      console.log("Lỗi tải phiếu chăm sóc:", e);
    } finally {
      setLoadingCareSheets(false);
    }
  };

  useEffect(() => {
    if (activeForm === 'careSheet') {
      fetchPatientCareSheets();
    }
  }, [activeForm]);

  const addCsFluid = () => {
    setCsFluidInfusions(p => [...p, { fluidName: "", volume: "500", rate: "40 giọt/phút", status: "đang truyền", notes: "" }]);
  };

  const removeCsFluid = (index) => {
    setCsFluidInfusions(p => p.filter((_, i) => i !== index));
  };

  const updateCsFluid = (index, field, value) => {
    setCsFluidInfusions(p => {
      const updated = [...p];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleResetCareSheetForm = () => {
    setCsCareLevel("");
    setCsPulse("");
    setCsBP("");
    setCsTemp("");
    setCsBreath("");
    setCsSpo2("");
    setCsNurse(localUser?.profile?.name || "");
    setCsProgressNotes("");
    setCsCareActions("");
    setCsGlasgowEye("");
    setCsGlasgowVerbal("");
    setCsGlasgowMotor("");
    setCsPupilLeftSize("");
    setCsPupilRightSize("");
    setCsPupilLeftReflex("+");
    setCsPupilRightReflex("+");
    setCsPupilShape("");
    setCsDrainageSite("");
    setCsDrainageVolume("");
    setCsDrainageColor("");
    setCsDrainageCondition("");
    setCsFluidInfusions([]);
  };

  const handleSaveCareSheet = async () => {
    if (!csPulse || !csBP || !csTemp || !csBreath || !csSpo2 || !csProgressNotes) {
      notify("Thông báo", "Vui lòng nhập đầy đủ các chỉ số sinh hiệu và diễn biến bệnh nhân.");
      return;
    }
    setCsSubmitting(true);
    try {
      const recordId = await getOrCreateMedicalRecordId();
      const payload = {
        careLevel: Number(csCareLevel) || 1,
        pulse: Number(csPulse),
        bloodPressure: csBP.trim(),
        temperature: Number(csTemp),
        respiratoryRate: Number(csBreath),
        spo2: Number(csSpo2),
        nurse: csNurse || localUser?.profile?.name || "Điều dưỡng trực",
        progressNotes: csProgressNotes,
        careActions: csCareActions,
        glasgow: hasGcsInput ? {
          eye: csGcsEyeNum || 4,
          verbal: csGcsVerbalNum || 5,
          motor: csGcsMotorNum || 6
        } : undefined,
        pupils: (csPupilLeftSize || csPupilRightSize || csPupilShape) ? {
          leftSize: parseFloat(csPupilLeftSize) || 2.5,
          rightSize: parseFloat(csPupilRightSize) || 2.5,
          leftLightReflex: csPupilLeftReflex,
          rightLightReflex: csPupilRightReflex,
          shape: csPupilShape
        } : undefined,
        surgicalDrainage: csDrainageSite ? {
          site: csDrainageSite,
          volume: Number(csDrainageVolume) || 0,
          color: csDrainageColor,
          condition: csDrainageCondition
        } : undefined,
        fluidInfusions: csFluidInfusions.filter(f => f.fluidName).map(f => ({
          ...f, volume: Number(f.volume) || 0
        }))
      };

      await post(`/emr/records/${recordId}/care-sheets`, payload);
      notify("Thành công", "Đã lưu Phiếu Chăm sóc Điều dưỡng thành công vào hồ sơ bệnh án!");
      setShowCareSheetForm(false);
      handleResetCareSheetForm();
      fetchPatientCareSheets();
    } catch (err) {
      notify("Lỗi", err?.message || "Không thể lưu phiếu chăm sóc.");
    } finally {
      setCsSubmitting(false);
    }
  };

  const handleOcrFillCareSheet = () => {
    setCsCareLevel("1");
    setCsPulse("76");
    setCsBP("125/80");
    setCsTemp("36.8");
    setCsBreath("18");
    setCsSpo2("98");
    setCsNurse(localUser?.profile?.name || "Đd. Nguyễn Thị Mai");
    setCsGlasgowEye("4");
    setCsGlasgowVerbal("4");
    setCsGlasgowMotor("6");
    setCsPupilLeftSize("2.5");
    setCsPupilRightSize("2.5");
    setCsPupilLeftReflex("+");
    setCsPupilRightReflex("+");
    setCsPupilShape("Tròn đều 2 bên");
    setCsDrainageSite("Dẫn lưu não thất ngoài (EVD)");
    setCsDrainageVolume("45");
    setCsDrainageColor("Hồng nhạt, dịch não tủy lưu thông tốt");
    setCsDrainageCondition("Chân ống khô ráo, cố định vô trùng, không rỉ dịch");
    setCsFluidInfusions([
      { fluidName: "Mannitol 20%", volume: "250", rate: "40 giọt/phút", status: "đã hoàn thành", notes: "Truyền nhanh 30 phút" },
      { fluidName: "NaCl 0.9%", volume: "500", rate: "30 giọt/phút", status: "đang truyền", notes: "" },
      { fluidName: "Ringer Lactate", volume: "500", rate: "30 giọt/phút", status: "đang truyền", notes: "" }
    ]);
    setCsProgressNotes("Bệnh nhân tỉnh táo (GCS 14 điểm E4V4M6), hậu phẫu mở sọ cắt u não ngày thứ 2. Tiếp xúc tốt, không liệt khu trú. Đồng tử 2 bên đều 2.5mm phản xạ ánh sáng (+). Dẫn lưu não thất EVD ra 45ml dịch não tủy hồng nhạt/8h, áp lực cột nước dao động bình thường.");
    setCsCareActions("Nằm đầu cao 30° chống phù não. Theo dõi tri giác (GCS) và phản xạ đồng tử mỗi 2 giờ. Sát trùng và thay băng vô trùng chân dẫn lưu não thất EVD. Truyền Mannitol 20% 250ml theo y lệnh bác sĩ, theo dõi cân bằng dịch vào ra.");
    notify("Quét tự động OCR", "✅ Đã tự động điền đầy đủ phiếu chăm sóc hậu phẫu sọ não (GCS, Đồng tử, Dẫn lưu EVD, Lịch truyền dịch)!");
  };

  // Helper: Number to Vietnamese words
  const numberToVietnameseWords = (num) => {
    if (num === 0) return "Không";
    const units = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
    const unitsTen = ["", "mười", "hai mươi", "ba mươi", "bốn mươi", "năm mươi", "sáu mươi", "bảy mươi", "tám mươi", "chín mươi"];
    
    const readThreeDigits = (n) => {
      let res = "";
      const hundreds = Math.floor(n / 100);
      const remainder = n % 100;
      const tens = Math.floor(remainder / 10);
      const ones = remainder % 10;
      
      if (hundreds > 0) {
        res += units[hundreds] + " trăm ";
      }
      if (tens > 0) {
        res += unitsTen[tens] + " ";
      } else if (hundreds > 0 && ones > 0) {
        res += "lẻ ";
      }
      if (ones > 0) {
        if (ones === 5 && tens > 0) res += "lăm";
        else if (ones === 1 && tens > 1) res += "mốt";
        else res += units[ones];
      }
      return res.trim();
    };
    
    let result = "";
    const billion = Math.floor(num / 1000000000);
    let rem = num % 1000000000;
    const million = Math.floor(rem / 1000000);
    rem = rem % 1000000;
    const thousand = Math.floor(rem / 1000);
    const remaining = rem % 1000;
    
    if (billion > 0) {
      result += readThreeDigits(billion) + " tỷ ";
    }
    if (million > 0) {
      result += readThreeDigits(million) + " triệu ";
    }
    if (thousand > 0) {
      result += readThreeDigits(thousand) + " nghìn ";
    }
    if (remaining > 0) {
      result += readThreeDigits(remaining);
    }
    
    result = result.trim();
    return result.charAt(0).toUpperCase() + result.slice(1);
  };

  const FORM_TABS = [
    { key: "info",  label: "Thông tin", Icon: User },
    { key: "exam",  label: "Khám bệnh", Icon: Activity },
    { key: "careSheet", label: "Phiếu chăm sóc", Icon: ClipboardList },
    { key: "order", label: "Chỉ định", Icon: FileText },
    { key: "fee",   label: "Viện phí", Icon: CreditCard },
  ];

  const QUICK_SERVICES = ["Khám chuyên khoa thần kinh", "Chụp MRI sọ não", "Phân tích AI chẩn đoán"];

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="EMRDashboard">
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F1F5F9" }}>
        {/* Top bar */}
        <View style={s.topHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[s.backBtn, { flexDirection: "row", alignItems: "center", gap: 4 }]}>
            <ChevronLeft size={16} color="#fff" />
            <Text style={s.backBtnText}>Quay lại</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
              <Building2 size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>{patientName}</Text>
              <Text style={s.headerSub}>{gender}{age ? " • " + age + " tuổi" : ""}{department ? " • " + department : ""}</Text>
            </View>
          </View>
        </View>

        {/* Form tab selector */}
        <View style={s.tabBarContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 10, flexDirection: "row" }}>
            {FORM_TABS.map(t => {
              const IconComponent = t.Icon;
              const isDone = (t.key === 'exam' && examDone) || (t.key === 'order' && orderDone) || (t.key === 'fee' && invoiceDone) || (t.key === 'careSheet' && careSheets.length > 0);
              const isActive = activeForm === t.key;
              // Làm theo thứ tự: Khám bệnh (sinh hiệu) → Chỉ định → Viện phí
              const lockReason = t.key === 'order' && !examDone ? 'Cần lưu tab Khám bệnh (sinh hiệu) trước khi chỉ định dịch vụ.'
                : t.key === 'fee' && !orderDone ? (!examDone ? 'Cần lưu tab Khám bệnh và tab Chỉ định trước khi lập phiếu thu.' : 'Cần lưu tab Chỉ định trước khi lập phiếu thu.')
                : null;

              return (
                <TouchableOpacity key={t.key}
                  onPress={() => (lockReason ? notify("Chưa thể mở " + t.label, lockReason) : setActiveForm(t.key))}
                  style={[s.tabPill, isActive && s.tabPillActive, lockReason && { opacity: 0.5 }, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
                  <IconComponent size={14} color={isActive ? "#FFFFFF" : "#64748B"} />
                  <Text style={[s.tabPillText, isActive && s.tabPillTextActive]}>
                    {t.label}
                  </Text>
                  {lockReason ? <Lock size={12} color="#94A3B8" /> : isDone && <CheckCircle2 size={13} color={isActive ? "#FFFFFF" : "#047857"} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          {/^[0-9a-fA-F]{24}$/.test(patient._id) && <PatientSafetyStrip patientId={patient._id} />}

          {/* ───────────────────────────────────────────────────────────────────
              1. TAB INFO (Thông Tin Bệnh Nhân)
              ─────────────────────────────────────────────────────────────────── */}
          {activeForm === "info" && (
            <View>
              <Text style={s.sectionTitle}>Thông tin bệnh nhân</Text>
              <View style={s.card}>
                {[
                  ["Họ và tên", patientName],
                  ["Mã bệnh nhân", patientIdStr],
                  ["Giới tính", gender || "N/A"],
                  ["Tuổi", age ? age + " tuổi" : "N/A"],
                  ["Khoa / Phòng", department || "N/A"],
                  ["Bác sĩ phụ trách", doctor || "N/A"],
                  ["Trạng thái hiện tại", patient.status || "Đang điều trị"],
                  ["Loại nhập viện", patient.visitType || patient.admissionType || "Ngoại trú"],
                ].map(([label, val]) => (
                  <View key={label} style={s.infoRow}>
                    <Text style={s.infoLabel}>{label}</Text>
                    <Text style={s.infoValue}>{val}</Text>
                  </View>
                ))}
              </View>
              <View style={s.guideBox}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <HelpCircle size={16} color="#065F46" />
                  <Text style={s.guideTitle}>Quy trình điền hồ sơ (Dành cho Điều dưỡng)</Text>
                </View>
                <Text style={s.guideText}>
                  {"1. Tab Khám bệnh → Ghi nhận 5 chỉ số sinh hiệu (Mạch, Huyết áp, Thân nhiệt, SpO₂, Nhịp thở) → Hệ thống tự động tô đỏ cảnh báo nếu chỉ số vượt ngưỡng an toàn.\n2. Tab Phiếu chăm sóc → Lập Phiếu Chăm sóc Điều dưỡng: Tri giác (Thang điểm Glasgow GCS), Phản xạ đồng tử 2 bên, Đo dịch dẫn lưu phẫu thuật sọ não (EVD), Lịch truyền dịch.\n3. Tab Chỉ định → Thêm chỉ định cận lâm sàng.\n4. Tab Viện phí → Xác nhận hóa đơn dịch vụ gửi quầy Thu ngân."}
                </Text>
              </View>
            </View>
          )}

          {/* ───────────────────────────────────────────────────────────────────
              2. TAB EXAM (Mẫu Khám Bệnh)
              ─────────────────────────────────────────────────────────────────── */}
          {activeForm === "exam" && (
            <View>
              {examDone ? (
                /* COMPLETED PAPER FORM PREVIEW (MẪU KHÁM BỆNH) */
                <View style={s.docPaper}>
                  <View style={s.docHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.docHospitalName}>SỞ Y TẾ ĐÀ NẴNG</Text>
                      <Text style={s.docHospitalSub}>BỆNH VIỆN CHUYÊN KHOA UNG THƯ NÃO NEUROSCAN</Text>
                    </View>
                    <Building2 size={26} color={Colors.brandGreen} />
                  </View>
                  
                  <Text style={s.docTitle}>PHIẾU THÔNG TIN KHÁM BỆNH</Text>
                  <Text style={s.docSubtitle}>Patient Information Registration Form</Text>
                  
                  <View style={s.docDivider} />
                  
                  <View style={s.docGrid}>
                    <View style={s.docCol}>
                      <Text style={s.docLabel}>Họ và tên / Name: <Text style={s.docVal}>{patientName}</Text></Text>
                      <Text style={s.docLabel}>Giới tính / Gender: <Text style={s.docVal}>{gender || 'N/A'}</Text></Text>
                      <Text style={s.docLabel}>Tuổi / Age: <Text style={s.docVal}>{age ? `${age} tuổi` : 'N/A'}</Text></Text>
                    </View>
                    <View style={s.docCol}>
                      <Text style={s.docLabel}>Đối tượng / Class: <Text style={s.docVal}>{examObject}</Text></Text>
                      <Text style={s.docLabel}>Yêu cầu khám / Request: <Text style={s.docVal}>{examRequest || 'Khám tổng quát'}</Text></Text>
                    </View>
                  </View>
                  
                  <Text style={s.docSectionHeader}>SINH HIỆU LÂM SÀNG (VITAL SIGNS)</Text>

                  {vitalEval.isAbnormal && (
                    <View style={s.vitalsAlertCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <AlertTriangle size={18} color="#DC2626" />
                        <Text style={s.vitalsAlertTitle}>CẢNH BÁO SINH HIỆU VƯỢT NGƯỠNG AN TOÀN</Text>
                      </View>
                      <Text style={s.vitalsAlertSubtitle}>
                        Phát hiện {vitalEval.alerts.length} chỉ số sinh hiệu vượt ngưỡng an toàn y tế. Hệ thống đã tự động tô đỏ cảnh báo để Điều dưỡng và Bác sĩ xử lý khẩn cấp.
                      </Text>
                      {vitalEval.alerts.map((al, idx) => (
                        <Text key={idx} style={s.vitalsAlertItem}>• {al.message}</Text>
                      ))}
                    </View>
                  )}

                  <View style={s.docTable}>
                    <View style={s.docTableRowHeader}>
                      <Text style={[s.docTableCellHeader, { flex: 2 }]}>Chỉ số sinh hiệu</Text>
                      <Text style={[s.docTableCellHeader, { flex: 1.2, textAlign: 'center' }]}>Giá trị</Text>
                      <Text style={[s.docTableCellHeader, { flex: 0.9, textAlign: 'center' }]}>Đơn vị</Text>
                      <Text style={[s.docTableCellHeader, { flex: 1.2, textAlign: 'center' }]}>Trạng thái</Text>
                    </View>
                    {[
                      { key: 'pulse', name: 'Mạch / Pulse', val: examPulse, unit: 'lần/phút', isAbnormal: vitalEval.flags.pulse },
                      { key: 'bloodPressure', name: 'Huyết áp / Blood pressure', val: examBP, unit: 'mmHg', isAbnormal: vitalEval.flags.bloodPressure },
                      { key: 'height', name: 'Chiều cao / Height', val: examHeight, unit: 'cm', isAbnormal: false },
                      { key: 'weight', name: 'Cân nặng / Weight', val: examWeight, unit: 'kg', isAbnormal: false },
                      { key: 'respiratoryRate', name: 'Nhịp thở / Breath', val: examBreath, unit: 'lần/phút', isAbnormal: vitalEval.flags.respiratoryRate },
                      { key: 'temperature', name: 'Nhiệt độ / Temperature', val: examTemp, unit: '°C', isAbnormal: vitalEval.flags.temperature },
                      { key: 'spo2', name: 'Chỉ số SpO2', val: examSpo2, unit: '%', isAbnormal: vitalEval.flags.spo2 },
                      { key: 'bmi', name: 'Chỉ số BMI thể trạng', val: examHeight && examWeight ? (parseFloat(examWeight) / Math.pow(parseFloat(examHeight)/100, 2)).toFixed(1) : '—', unit: '', isAbnormal: false },
                    ].map((row, idx) => (
                      <View
                        key={idx}
                        style={[
                          s.docTableRow,
                          idx % 2 === 1 && { backgroundColor: '#F8FAFC' },
                          row.isAbnormal && s.docTableRowDanger
                        ]}
                      >
                        <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {row.isAbnormal && <AlertCircle size={14} color="#DC2626" />}
                          <Text style={[s.docTableCell, row.isAbnormal && s.docTableCellDanger]}>{row.name}</Text>
                        </View>
                        <Text style={[
                          s.docTableCell,
                          { flex: 1.2, textAlign: 'center', fontWeight: 'bold', color: row.isAbnormal ? '#DC2626' : Colors.brandNavy },
                          row.isAbnormal && s.docTableCellDangerVal
                        ]}>
                          {row.val || '—'}
                        </Text>
                        <Text style={[s.docTableCell, { flex: 0.9, textAlign: 'center', color: row.isAbnormal ? '#991B1B' : '#64748B' }]}>{row.unit}</Text>
                        <View style={{ flex: 1.2, alignItems: 'center', justifyContent: 'center' }}>
                          {row.isAbnormal ? (
                            <View style={s.dangerBadge}>
                              <Text style={s.dangerBadgeText}>⚠️ VƯỢT NGƯỠNG</Text>
                            </View>
                          ) : row.val ? (
                            <View style={s.normalBadge}>
                              <Text style={s.normalBadgeText}>✓ An toàn</Text>
                            </View>
                          ) : (
                            <Text style={{ fontSize: 11, color: '#94A3B8' }}>—</Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                  
                  <View style={s.docFooterSignatures}>
                    <View style={{ flex: 1 }} />
                    <View style={s.docSignatureBox}>
                      <Text style={s.docSignatureDate}>Ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}</Text>
                      <Text style={s.docSignatureTitle}>ĐIỀU DƯỠNG THỰC HIỆN</Text>
                      <Text style={s.docSignatureSub}>(Ký và ghi rõ họ tên)</Text>
                      <View style={{ height: 40 }} />
                      <Text style={s.docSignatureName}>{localUser?.profile?.name || "Điều dưỡng phụ trách"}</Text>
                    </View>
                  </View>
                  
                  <View style={s.docActionRow}>
                    <TouchableOpacity onPress={() => setExamDone(false)} style={[s.docEditBtn, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
                      <Edit2 size={13} color={Colors.brandGreen} />
                      <Text style={s.docEditBtnText}>Sửa lại phiếu</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => window.print()} style={[s.docPrintBtn, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
                      <Printer size={13} color="#fff" />
                      <Text style={s.docPrintBtnText}>In phiếu khám</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                /* INPUT FORM FOR EXAM (MẪU KHÁM BỆNH) */
                <View>
                  <Text style={s.sectionTitle}>Phiếu Thông Tin Khám Bệnh</Text>
                  <Text style={s.sectionSubtitle}>Nhập thông tin sinh hiệu lâm sàng ban đầu cho bệnh nhân.</Text>
                  <View style={s.card}>
                    <Text style={s.groupLabel}>Sinh hiệu lâm sàng (Vital Signs)</Text>

                    {vitalEval.isAbnormal && (
                      <View style={s.vitalsAlertCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <AlertTriangle size={16} color="#DC2626" />
                          <Text style={s.vitalsAlertTitle}>CẢNH BÁO: CHỈ SỐ VƯỢT NGƯỠNG AN TOÀN</Text>
                        </View>
                        <Text style={s.vitalsAlertSubtitle}>
                          Một hoặc nhiều chỉ số đang vượt ngưỡng an toàn y tế. Hệ thống tự động tô đỏ viền ô nhập để cảnh báo.
                        </Text>
                      </View>
                    )}

                    {[
                      { key: 'pulse', label: "Mạch (lần/phút) *", val: examPulse, setter: setExamPulse, kb: "numeric", ph: "Ví dụ: 80", isAbnormal: vitalEval.flags.pulse, alert: vitalEval.alerts.find(a => a.key === 'pulse') },
                      { key: 'bloodPressure', label: "Huyết áp (mmHg) *", val: examBP, setter: setExamBP, kb: "default", ph: "Ví dụ: 120/80", isAbnormal: vitalEval.flags.bloodPressure, alert: vitalEval.alerts.find(a => a.key === 'systolic' || a.key === 'diastolic') },
                      { key: 'height', label: "Chiều cao (cm)", val: examHeight, setter: setExamHeight, kb: "numeric", ph: "Ví dụ: 165", isAbnormal: false },
                      { key: 'weight', label: "Cân nặng (kg)", val: examWeight, setter: setExamWeight, kb: "numeric", ph: "Ví dụ: 60", isAbnormal: false },
                      { key: 'respiratoryRate', label: "Nhịp thở (lần/phút)", val: examBreath, setter: setExamBreath, kb: "numeric", ph: "Ví dụ: 18", isAbnormal: vitalEval.flags.respiratoryRate, alert: vitalEval.alerts.find(a => a.key === 'respiratoryRate') },
                      { key: 'temperature', label: "Nhiệt độ (°C) *", val: examTemp, setter: setExamTemp, kb: "numeric", ph: "Ví dụ: 37.0", isAbnormal: vitalEval.flags.temperature, alert: vitalEval.alerts.find(a => a.key === 'temperature') },
                      { key: 'spo2', label: "SpO2 (%) *", val: examSpo2, setter: setExamSpo2, kb: "numeric", ph: "Ví dụ: 98", isAbnormal: vitalEval.flags.spo2, alert: vitalEval.alerts.find(a => a.key === 'spo2') },
                    ].map((item) => (
                      <View key={item.key} style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={[s.fieldLabel, { marginBottom: 0 }, item.isAbnormal && { color: '#B91C1C', fontWeight: '700' }]}>{item.label}</Text>
                          {item.isAbnormal && (
                            <View style={s.dangerBadge}>
                              <Text style={s.dangerBadgeText}>⚠️ VƯỢT NGƯỠNG AN TOÀN</Text>
                            </View>
                          )}
                        </View>
                        <TextInput
                          style={[
                            s.input,
                            item.isAbnormal && s.inputDanger
                          ]}
                          placeholder={item.ph}
                          placeholderTextColor="#94A3B8"
                          keyboardType={item.kb}
                          value={item.val}
                          onChangeText={item.setter}
                        />
                        {item.isAbnormal && item.alert && (
                          <Text style={s.inputAlertText}>⚠️ {item.alert.message}</Text>
                        )}
                      </View>
                    ))}
                    
                    <Text style={[s.groupLabel, { marginTop: 8 }]}>Thông tin đăng ký khám</Text>
                    <Text style={s.fieldLabel}>Yêu cầu khám (lý do khám)</Text>
                    <TextInput style={[s.input, { height: 70, textAlignVertical: "top", marginBottom: 12 }]}
                      placeholder="Nhập yêu cầu khám..." placeholderTextColor="#94A3B8" multiline value={examRequest} onChangeText={setExamRequest} />
                    
                    <Text style={s.fieldLabel}>Đối tượng chi trả</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {["Thu phí", "BHYT", "Miễn phí"].map(o => (
                        <TouchableOpacity key={o} onPress={() => setExamObject(o)}
                          style={[s.toggleBtn, examObject === o && s.toggleBtnActive]}>
                          <Text style={[s.toggleBtnText, examObject === o && s.toggleBtnTextActive]}>{o}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* CONFIRM BUTTON */}
                    <TouchableOpacity 
                      onPress={handleSaveExamToBackend}
                      disabled={submitting}
                      style={[s.confirmBtn, submitting && { backgroundColor: "#94A3B8" }, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }]}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Save size={16} color="#fff" />
                          <Text style={s.confirmBtnText}>Xác nhận & Lưu phiếu khám</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ───────────────────────────────────────────────────────────────────
              3. TAB CARE SHEET (Phiếu Chăm sóc Điều dưỡng - UC-NUR-04)
              ─────────────────────────────────────────────────────────────────── */}
          {activeForm === "careSheet" && (
            <View>
              {/* Header section with Actions */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <View style={{ flex: 1, minWidth: 240 }}>
                  <Text style={s.sectionTitle}>Phiếu Chăm Sóc Điều Dưỡng</Text>
                  <Text style={s.sectionSubtitle}>
                    Theo dõi diễn biến bệnh nhân nội trú: Tri giác (Glasgow), Phản xạ đồng tử, Dẫn lưu phẫu thuật sọ não, Lịch truyền dịch.
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    onPress={handleOcrFillCareSheet}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      backgroundColor: "#ECFDF5",
                      borderWidth: 1,
                      borderColor: "#10B981",
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8
                    }}
                  >
                    <Zap size={14} color="#059669" />
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#065F46" }}>Quét tự động OCR</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      if (!showCareSheetForm) {
                        handleResetCareSheetForm();
                        setCsNurse(localUser?.profile?.name || "Điều dưỡng trực");
                      }
                      setShowCareSheetForm(prev => !prev);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      backgroundColor: showCareSheetForm ? "#64748B" : Colors.brandGreen,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 8
                    }}
                  >
                    {showCareSheetForm ? <X size={14} color="#fff" /> : <Plus size={14} color="#fff" />}
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>
                      {showCareSheetForm ? "Đóng Form" : "+ Lập phiếu mới"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={fetchPatientCareSheets}
                    style={{
                      backgroundColor: "#F1F5F9",
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: "#CBD5E1"
                    }}
                  >
                    <RefreshCw size={14} color="#475569" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* FORM TO CREATE CARE SHEET */}
              {showCareSheetForm && (
                <View style={[s.card, { borderColor: "#10B981", borderWidth: 2, marginBottom: 20 }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: "#E2E8F0", paddingBottom: 10, marginBottom: 14 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <ClipboardList size={18} color={Colors.brandGreen} />
                      <Text style={{ fontSize: 15, fontWeight: "800", color: "#0F172A" }}>Lập Phiếu Chăm Sóc Mới (Hậu Phẫu Thần Kinh / U Não)</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <TouchableOpacity
                        onPress={handleResetCareSheetForm}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 6,
                          backgroundColor: "#F1F5F9",
                          borderWidth: 1,
                          borderColor: "#CBD5E1"
                        }}
                      >
                        <Text style={{ fontSize: 11, color: "#64748B", fontWeight: "600" }}>Xóa trắng form</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setShowCareSheetForm(false)}>
                        <X size={18} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* 1. Cấp chăm sóc & Sinh hiệu */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <HeartPulse size={16} color="#DC2626" />
                    <Text style={[s.groupLabel, { marginBottom: 0, color: "#DC2626" }]}>1. Cấp chăm sóc & Sinh hiệu lâm sàng</Text>
                  </View>
                  
                  <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.fieldLabel}>Cấp chăm sóc (1-3) *</Text>
                      <TextInput
                        style={s.input}
                        placeholder="1"
                        keyboardType="numeric"
                        value={csCareLevel}
                        onChangeText={setCsCareLevel}
                      />
                    </View>
                    <View style={{ flex: 2 }}>
                      <Text style={s.fieldLabel}>Điều dưỡng phụ trách *</Text>
                      <TextInput
                        style={s.input}
                        placeholder="Họ tên điều dưỡng"
                        value={csNurse}
                        onChangeText={setCsNurse}
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    <View style={{ flex: 1, minWidth: 100 }}>
                      <Text style={[s.fieldLabel, csVitalEval.flags.pulse && { color: "#DC2626" }]}>Mạch (bpm) *</Text>
                      <TextInput
                        style={[s.input, csVitalEval.flags.pulse && s.inputDanger]}
                        placeholder="78"
                        keyboardType="numeric"
                        value={csPulse}
                        onChangeText={setCsPulse}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 110 }}>
                      <Text style={[s.fieldLabel, csVitalEval.flags.bloodPressure && { color: "#DC2626" }]}>Huyết áp (mmHg) *</Text>
                      <TextInput
                        style={[s.input, csVitalEval.flags.bloodPressure && s.inputDanger]}
                        placeholder="120/80"
                        value={csBP}
                        onChangeText={setCsBP}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 90 }}>
                      <Text style={[s.fieldLabel, csVitalEval.flags.temperature && { color: "#DC2626" }]}>Nhiệt độ (°C) *</Text>
                      <TextInput
                        style={[s.input, csVitalEval.flags.temperature && s.inputDanger]}
                        placeholder="36.8"
                        keyboardType="decimal-pad"
                        value={csTemp}
                        onChangeText={setCsTemp}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 90 }}>
                      <Text style={[s.fieldLabel, csVitalEval.flags.respiratoryRate && { color: "#DC2626" }]}>Nhịp thở *</Text>
                      <TextInput
                        style={[s.input, csVitalEval.flags.respiratoryRate && s.inputDanger]}
                        placeholder="18"
                        keyboardType="numeric"
                        value={csBreath}
                        onChangeText={setCsBreath}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 90 }}>
                      <Text style={[s.fieldLabel, csVitalEval.flags.spo2 && { color: "#DC2626" }]}>SpO₂ (%) *</Text>
                      <TextInput
                        style={[s.input, csVitalEval.flags.spo2 && s.inputDanger]}
                        placeholder="98"
                        keyboardType="numeric"
                        value={csSpo2}
                        onChangeText={setCsSpo2}
                      />
                    </View>
                  </View>

                  {csVitalEval.isAbnormal && (
                    <View style={[s.vitalsAlertCard, { marginTop: 4, marginBottom: 12 }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <AlertTriangle size={14} color="#DC2626" />
                        <Text style={{ fontSize: 12, fontWeight: "700", color: "#DC2626" }}>Cảnh báo sinh hiệu vượt ngưỡng</Text>
                      </View>
                      {csVitalEval.alerts.map((al, i) => (
                        <Text key={i} style={{ fontSize: 11, color: "#991B1B", marginTop: 2 }}>• {al.message}</Text>
                      ))}
                    </View>
                  )}

                  {/* 2. Tri giác (Glasgow - GCS) */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, marginBottom: 8 }}>
                    <Brain size={16} color="#7C3AED" />
                    <Text style={[s.groupLabel, { marginBottom: 0, color: "#7C3AED" }]}>2. Tri giác — Thang điểm hôn mê Glasgow (GCS)</Text>
                  </View>

                  <View style={{ backgroundColor: "#F5F3FF", borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#DDD6FE" }}>
                    <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#5B21B6", marginBottom: 4 }}>👁 Mở mắt (E) 1–4</Text>
                        <TextInput
                          style={[s.input, { textAlign: "center", fontWeight: "bold", fontSize: 16 }]}
                          placeholder="4"
                          keyboardType="numeric"
                          value={csGlasgowEye}
                          onChangeText={v => setCsGlasgowEye(v.replace(/[^1-4]/g, '').slice(0, 1))}
                          maxLength={1}
                        />
                        <Text style={{ fontSize: 9, color: "#6D28D9", textAlign: "center", marginTop: 2 }}>1=Không • 4=Tự nhiên</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#5B21B6", marginBottom: 4 }}>🗣 Lời nói (V) 1–5</Text>
                        <TextInput
                          style={[s.input, { textAlign: "center", fontWeight: "bold", fontSize: 16 }]}
                          placeholder="5"
                          keyboardType="numeric"
                          value={csGlasgowVerbal}
                          onChangeText={v => {
                            const n = parseInt(v);
                            if (!v) { setCsGlasgowVerbal(''); return; }
                            if (n >= 1 && n <= 5) setCsGlasgowVerbal(String(n));
                          }}
                          maxLength={1}
                        />
                        <Text style={{ fontSize: 9, color: "#6D28D9", textAlign: "center", marginTop: 2 }}>1=Không • 5=Định hướng</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#5B21B6", marginBottom: 4 }}>💪 Vận động (M) 1–6</Text>
                        <TextInput
                          style={[s.input, { textAlign: "center", fontWeight: "bold", fontSize: 16 }]}
                          placeholder="6"
                          keyboardType="numeric"
                          value={csGlasgowMotor}
                          onChangeText={v => {
                            const n = parseInt(v);
                            if (!v) { setCsGlasgowMotor(''); return; }
                            if (n >= 1 && n <= 6) setCsGlasgowMotor(String(n));
                          }}
                          maxLength={1}
                        />
                        <Text style={{ fontSize: 9, color: "#6D28D9", textAlign: "center", marginTop: 2 }}>1=Không • 6=Theo lệnh</Text>
                      </View>
                    </View>

                    {/* Glasgow Score Banner */}
                    <View style={{ backgroundColor: !hasGcsInput ? "#64748B" : isCsGcsCritical ? "#DC2626" : isCsGcsMedium ? "#D97706" : "#7C3AED", borderRadius: 8, padding: 10, alignItems: "center" }}>
                      <Text style={{ fontSize: 18, fontWeight: "900", color: "#fff" }}>
                        Tổng GCS: {hasGcsInput ? `${csGcsTotal} / 15 Điểm` : "— / 15 Điểm"}
                      </Text>
                      <Text style={{ fontSize: 12, color: "#fff", marginTop: 2, fontWeight: "600" }}>
                        {csGcsClassification}
                      </Text>
                      {isCsGcsCritical && (
                        <Text style={{ fontSize: 11, color: "#FEE2E2", marginTop: 4, fontWeight: "700" }}>
                          ⚠️ NGUY KỊCH: Điểm GCS ≤ 8 — Hôn mê sâu, báo ngay Bác sĩ trực cấp cứu!
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* 3. Phản xạ đồng tử */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, marginBottom: 8 }}>
                    <Eye size={16} color="#0891B2" />
                    <Text style={[s.groupLabel, { marginBottom: 0, color: "#0891B2" }]}>3. Phản xạ đồng tử</Text>
                  </View>

                  <View style={{ backgroundColor: "#F0F9FF", borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#BAE6FD" }}>
                    <View style={{ flexDirection: "row", gap: 12, marginBottom: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: "#0E7490", marginBottom: 4 }}>👁 MẮT TRÁI</Text>
                        <Text style={{ fontSize: 11, color: "#0E7490", marginBottom: 3 }}>Kích thước (mm):</Text>
                        <TextInput
                          style={s.input}
                          placeholder="2.5"
                          keyboardType="decimal-pad"
                          value={csPupilLeftSize}
                          onChangeText={setCsPupilLeftSize}
                        />
                        <Text style={{ fontSize: 11, color: "#0E7490", marginTop: 6, marginBottom: 3 }}>Phản xạ ánh sáng:</Text>
                        <View style={{ flexDirection: "row", gap: 4 }}>
                          {["+", "chậm", "-"].map(opt => (
                            <TouchableOpacity
                              key={opt}
                              onPress={() => setCsPupilLeftReflex(opt)}
                              style={{
                                flex: 1,
                                paddingVertical: 6,
                                borderRadius: 6,
                                alignItems: "center",
                                backgroundColor: csPupilLeftReflex === opt ? "#0E7490" : "#E0F2FE",
                                borderWidth: 1,
                                borderColor: csPupilLeftReflex === opt ? "#0E7490" : "#BAE6FD"
                              }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: "700", color: csPupilLeftReflex === opt ? "#fff" : "#0E7490" }}>{opt}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      <View style={{ width: 1, backgroundColor: "#BAE6FD" }} />

                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: "#0E7490", marginBottom: 4 }}>👁 MẮT PHẢI</Text>
                        <Text style={{ fontSize: 11, color: "#0E7490", marginBottom: 3 }}>Kích thước (mm):</Text>
                        <TextInput
                          style={s.input}
                          placeholder="2.5"
                          keyboardType="decimal-pad"
                          value={csPupilRightSize}
                          onChangeText={setCsPupilRightSize}
                        />
                        <Text style={{ fontSize: 11, color: "#0E7490", marginTop: 6, marginBottom: 3 }}>Phản xạ ánh sáng:</Text>
                        <View style={{ flexDirection: "row", gap: 4 }}>
                          {["+", "chậm", "-"].map(opt => (
                            <TouchableOpacity
                              key={opt}
                              onPress={() => setCsPupilRightReflex(opt)}
                              style={{
                                flex: 1,
                                paddingVertical: 6,
                                borderRadius: 6,
                                alignItems: "center",
                                backgroundColor: csPupilRightReflex === opt ? "#0E7490" : "#E0F2FE",
                                borderWidth: 1,
                                borderColor: csPupilRightReflex === opt ? "#0E7490" : "#BAE6FD"
                              }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: "700", color: csPupilRightReflex === opt ? "#fff" : "#0E7490" }}>{opt}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </View>
                    
                    <Text style={{ fontSize: 11, color: "#0E7490", marginBottom: 3 }}>Hình dạng đồng tử:</Text>
                    <TextInput
                      style={s.input}
                      placeholder="Tròn đều 2 bên / Không đều / Giãn"
                      value={csPupilShape}
                      onChangeText={setCsPupilShape}
                    />
                  </View>

                  {/* 4. Dịch dẫn lưu phẫu thuật sọ não */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, marginBottom: 8 }}>
                    <Droplets size={16} color="#D97706" />
                    <Text style={[s.groupLabel, { marginBottom: 0, color: "#D97706" }]}>4. Đo lượng dịch dẫn lưu phẫu thuật sọ não</Text>
                  </View>

                  <View style={{ backgroundColor: "#FFFBEB", borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#FDE68A" }}>
                    <Text style={s.fieldLabel}>Vị trí ống dẫn lưu</Text>
                    <TextInput
                      style={[s.input, { marginBottom: 8 }]}
                      placeholder="VD: Dẫn lưu não thất ngoài (EVD), Ngoài màng cứng, Hố mổ u..."
                      value={csDrainageSite}
                      onChangeText={setCsDrainageSite}
                    />
                    <View style={{ flexDirection: "row", gap: 10, marginBottom: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fieldLabel}>Lượng dịch (ml)</Text>
                        <TextInput
                          style={s.input}
                          placeholder="45"
                          keyboardType="numeric"
                          value={csDrainageVolume}
                          onChangeText={setCsDrainageVolume}
                        />
                      </View>
                      <View style={{ flex: 2 }}>
                        <Text style={s.fieldLabel}>Màu sắc / Tính chất dịch</Text>
                        <TextInput
                          style={s.input}
                          placeholder="Hồng nhạt / Dịch não tủy trong..."
                          value={csDrainageColor}
                          onChangeText={setCsDrainageColor}
                        />
                      </View>
                    </View>
                    <Text style={s.fieldLabel}>Tình trạng chân ống dẫn lưu</Text>
                    <TextInput
                      style={s.input}
                      placeholder="Chân ống khô ráo, cố định tốt, không rỉ dịch..."
                      value={csDrainageCondition}
                      onChangeText={setCsDrainageCondition}
                    />
                  </View>

                  {/* 5. Lịch truyền dịch */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, marginBottom: 8 }}>
                    <Activity size={16} color="#2563EB" />
                    <Text style={[s.groupLabel, { marginBottom: 0, color: "#2563EB" }]}>5. Lịch truyền dịch ({csFluidInfusions.length} chai)</Text>
                  </View>

                  <View style={{ backgroundColor: "#EFF6FF", borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#BFDBFE" }}>
                    {csFluidInfusions.length === 0 ? (
                      <View style={{ paddingVertical: 14, alignItems: "center" }}>
                        <Text style={{ fontSize: 12, color: "#64748B", fontStyle: "italic", textAlign: "center" }}>
                          Chưa có chai truyền dịch nào. Bấm nút "+ Thêm chai truyền dịch" bên dưới để nhập hoặc bấm "Quét tự động OCR" để điền mẫu.
                        </Text>
                      </View>
                    ) : (
                      csFluidInfusions.map((inf, idx) => (
                      <View key={idx} style={{ marginBottom: 12, borderBottomWidth: idx < csFluidInfusions.length - 1 ? 1 : 0, borderBottomColor: "#BFDBFE", paddingBottom: 10 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <Text style={{ fontSize: 12, fontWeight: "700", color: "#1E3A8A" }}>Chai #{idx + 1}</Text>
                          {csFluidInfusions.length > 1 && (
                            <TouchableOpacity onPress={() => removeCsFluid(idx)}>
                              <Trash2 size={14} color="#EF4444" />
                            </TouchableOpacity>
                          )}
                        </View>
                        <TextInput
                          style={[s.input, { marginBottom: 6 }]}
                          placeholder="Tên dịch / Thuốc (Mannitol 20%, NaCl 0.9%...)"
                          value={inf.fluidName}
                          onChangeText={v => updateCsFluid(idx, "fluidName", v)}
                        />
                        <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
                          <View style={{ flex: 1 }}>
                            <TextInput
                              style={s.input}
                              placeholder="Dung tích (ml)"
                              keyboardType="numeric"
                              value={String(inf.volume)}
                              onChangeText={v => updateCsFluid(idx, "volume", v)}
                            />
                          </View>
                          <View style={{ flex: 2 }}>
                            <TextInput
                              style={s.input}
                              placeholder="Tốc độ (40 giọt/phút)"
                              value={inf.rate}
                              onChangeText={v => updateCsFluid(idx, "rate", v)}
                            />
                          </View>
                        </View>
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          {["đang truyền", "đã hoàn thành", "tạm dừng"].map(st => (
                            <TouchableOpacity
                              key={st}
                              onPress={() => updateCsFluid(idx, "status", st)}
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                borderRadius: 14,
                                backgroundColor: inf.status === st ? "#2563EB" : "#DBEAFE",
                                borderWidth: 1,
                                borderColor: inf.status === st ? "#2563EB" : "#93C5FD"
                              }}
                            >
                              <Text style={{ fontSize: 10, fontWeight: "700", color: inf.status === st ? "#fff" : "#1E40AF" }}>{st}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )))}
                    <TouchableOpacity
                      onPress={addCsFluid}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        justifyContent: "center",
                        paddingVertical: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: "#3B82F6",
                        borderStyle: "dashed"
                      }}
                    >
                      <Plus size={14} color="#2563EB" />
                      <Text style={{ fontSize: 12, fontWeight: "700", color: "#2563EB" }}>Thêm chai truyền dịch</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 6. Diễn biến bệnh & Chăm sóc y lệnh */}
                  <Text style={s.fieldLabel}>Diễn biến bệnh nhân (Progress Notes) *</Text>
                  <TextInput
                    style={[s.input, { height: 75, textAlignVertical: "top", marginBottom: 10 }]}
                    placeholder="Ghi nhận diễn biến tri giác, dấu hiệu thần kinh khu trú, tình trạng vết mổ..."
                    multiline
                    value={csProgressNotes}
                    onChangeText={setCsProgressNotes}
                  />

                  <Text style={s.fieldLabel}>Thực hiện y lệnh & Can thiệp điều dưỡng (Care Actions)</Text>
                  <TextInput
                    style={[s.input, { height: 75, textAlignVertical: "top", marginBottom: 14 }]}
                    placeholder="Các can thiệp: Đầu cao 30°, hút đờm, thay băng vết mổ, dùng thuốc..."
                    multiline
                    value={csCareActions}
                    onChangeText={setCsCareActions}
                  />

                  {/* Buttons */}
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => setShowCareSheetForm(false)}
                      style={[s.confirmBtn, { flex: 1, backgroundColor: "#E2E8F0", marginTop: 0 }]}
                    >
                      <Text style={{ color: "#475569", fontWeight: "700", fontSize: 14 }}>Hủy bỏ</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSaveCareSheet}
                      disabled={csSubmitting}
                      style={[s.confirmBtn, { flex: 2, marginTop: 0 }]}
                    >
                      {csSubmitting ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Save size={16} color="#fff" />
                          <Text style={s.confirmBtnText}>Lưu Phiếu Chăm Sóc</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* TIMELINE OF CARE SHEETS */}
              {loadingCareSheets ? (
                <View style={{ padding: 40, alignItems: "center" }}>
                  <ActivityIndicator size="large" color={Colors.brandGreen} />
                  <Text style={{ marginTop: 10, color: "#64748B", fontSize: 13 }}>Đang tải danh sách phiếu chăm sóc...</Text>
                </View>
              ) : careSheets.length === 0 ? (
                <View style={[s.card, { alignItems: "center", paddingVertical: 40 }]}>
                  <ClipboardList size={40} color="#94A3B8" />
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#475569", marginTop: 12 }}>Chưa có phiếu chăm sóc điều dưỡng nào</Text>
                  <Text style={{ fontSize: 12, color: "#94A3B8", marginTop: 4, textAlign: "center", maxWidth: 360 }}>
                    Bệnh nhân chưa có phiếu chăm sóc theo dõi nội trú. Bấm nút "+ Lập phiếu mới" hoặc "Quét tự động OCR" để tạo phiếu chăm sóc đầu tiên.
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowCareSheetForm(true)}
                    style={{ marginTop: 16, backgroundColor: Colors.brandGreen, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 6 }}
                  >
                    <Plus size={16} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Lập phiếu chăm sóc ngay</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: "#334155" }}>
                      LỊCH SỬ CHĂM SÓC NỘI TRÚ ({careSheets.length} phiếu đã ghi nhận)
                    </Text>
                  </View>

                  {careSheets.map((cs, idx) => {
                    const gcs = cs.glasgow;
                    const isCritical = gcs && gcs.totalScore <= 8;
                    const isMedium = gcs && gcs.totalScore > 8 && gcs.totalScore <= 12;

                    return (
                      <View
                        key={cs._id || idx}
                        style={[
                          s.card,
                          {
                            borderLeftWidth: 5,
                            borderLeftColor: isCritical ? "#DC2626" : isMedium ? "#D97706" : Colors.brandGreen,
                            marginBottom: 16,
                            padding: 16
                          }
                        ]}
                      >
                        {/* Header: Care Level, Date, Nurse */}
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                          <View>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                              <Text style={{ fontSize: 16, fontWeight: "800", color: "#0F172A" }}>
                                Phiếu chăm sóc Cấp {cs.careLevel || 1}
                              </Text>
                              {isCritical && (
                                <View style={s.dangerBadge}>
                                  <Text style={s.dangerBadgeText}>⚠️ GCS NGUY KỊCH</Text>
                                </View>
                              )}
                              {isMedium && (
                                <View style={{ backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: "#FCD34D" }}>
                                  <Text style={{ color: "#D97706", fontSize: 10, fontWeight: "800" }}>GCS HÔN MÊ VỪA</Text>
                                </View>
                              )}
                            </View>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                              <Calendar size={12} color="#64748B" />
                              <Text style={{ fontSize: 12, color: "#64748B" }}>
                                {cs.createdAt ? new Date(cs.createdAt).toLocaleString("vi-VN") : "Hôm nay"} • ĐD: <Text style={{ fontWeight: "600", color: "#334155" }}>{cs.nurse || "Điều dưỡng"}</Text>
                              </Text>
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() => window.print()}
                            style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F8FAFC", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: "#E2E8F0" }}
                          >
                            <Printer size={12} color="#475569" />
                            <Text style={{ fontSize: 11, color: "#475569", fontWeight: "600" }}>In phiếu</Text>
                          </TouchableOpacity>
                        </View>

                        {/* Vitals summary chip */}
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, backgroundColor: "#F8FAFC", padding: 8, borderRadius: 8, marginBottom: 10 }}>
                          <Text style={{ fontSize: 12, fontWeight: "600", color: "#334155" }}>❤️ Mạch: <Text style={{ fontWeight: "700" }}>{cs.pulse} bpm</Text></Text>
                          <Text style={{ fontSize: 12, color: "#CBD5E1" }}>•</Text>
                          <Text style={{ fontSize: 12, fontWeight: "600", color: "#334155" }}>🩸 HA: <Text style={{ fontWeight: "700" }}>{cs.bloodPressure} mmHg</Text></Text>
                          <Text style={{ fontSize: 12, color: "#CBD5E1" }}>•</Text>
                          <Text style={{ fontSize: 12, fontWeight: "600", color: "#334155" }}>🌡️ {cs.temperature}°C</Text>
                          <Text style={{ fontSize: 12, color: "#CBD5E1" }}>•</Text>
                          <Text style={{ fontSize: 12, fontWeight: "600", color: "#334155" }}>🫁 Thở: {cs.respiratoryRate} l/p</Text>
                          <Text style={{ fontSize: 12, color: "#CBD5E1" }}>•</Text>
                          <Text style={{ fontSize: 12, fontWeight: "600", color: cs.spo2 < 95 ? "#DC2626" : "#334155" }}>💧 SpO₂: <Text style={{ fontWeight: "700" }}>{cs.spo2}%</Text></Text>
                        </View>

                        {/* Glasgow Coma Scale (GCS) */}
                        {gcs && (
                          <View style={{ backgroundColor: isCritical ? "#FEF2F2" : "#F5F3FF", borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: isCritical ? "#FCA5A5" : "#DDD6FE" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Brain size={14} color={isCritical ? "#DC2626" : "#7C3AED"} />
                                <Text style={{ fontSize: 12, fontWeight: "800", color: isCritical ? "#DC2626" : "#5B21B6" }}>
                                  Thang điểm hôn mê Glasgow: {gcs.totalScore}/15 điểm
                                </Text>
                              </View>
                              <Text style={{ fontSize: 11, fontWeight: "700", color: isCritical ? "#DC2626" : "#7C3AED" }}>
                                {gcs.classification}
                              </Text>
                            </View>
                            <View style={{ flexDirection: "row", gap: 14 }}>
                              <Text style={{ fontSize: 11, color: "#475569" }}>👁 Mắt: E{gcs.eye}</Text>
                              <Text style={{ fontSize: 11, color: "#475569" }}>🗣 Lời: V{gcs.verbal}</Text>
                              <Text style={{ fontSize: 11, color: "#475569" }}>💪 Vận động: M{gcs.motor}</Text>
                            </View>
                          </View>
                        )}

                        {/* Pupil Reflex */}
                        {cs.pupils && (cs.pupils.leftSize || cs.pupils.rightSize) && (
                          <View style={{ backgroundColor: "#F0F9FF", borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: "#BAE6FD" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <Eye size={14} color="#0891B2" />
                              <Text style={{ fontSize: 12, fontWeight: "700", color: "#0E7490" }}>Phản xạ đồng tử</Text>
                            </View>
                            <View style={{ flexDirection: "row", gap: 16 }}>
                              <Text style={{ fontSize: 11, color: "#334155" }}>
                                Trái: <Text style={{ fontWeight: "700" }}>{cs.pupils.leftSize}mm</Text> ({cs.pupils.leftLightReflex})
                              </Text>
                              <Text style={{ fontSize: 11, color: "#334155" }}>
                                Phải: <Text style={{ fontWeight: "700" }}>{cs.pupils.rightSize}mm</Text> ({cs.pupils.rightLightReflex})
                              </Text>
                              {cs.pupils.shape && (
                                <Text style={{ fontSize: 11, color: "#64748B" }}>Hình dạng: {cs.pupils.shape}</Text>
                              )}
                            </View>
                          </View>
                        )}

                        {/* Cranial Surgical Drainage */}
                        {cs.surgicalDrainage && cs.surgicalDrainage.site && (
                          <View style={{ backgroundColor: "#FFFBEB", borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: "#FDE68A" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <Droplets size={14} color="#D97706" />
                              <Text style={{ fontSize: 12, fontWeight: "700", color: "#92400E" }}>Dịch dẫn lưu phẫu thuật sọ não</Text>
                            </View>
                            <Text style={{ fontSize: 11, color: "#78350F" }}>
                              • Vị trí: <Text style={{ fontWeight: "600" }}>{cs.surgicalDrainage.site}</Text>
                            </Text>
                            <Text style={{ fontSize: 11, color: "#78350F" }}>
                              • Thể tích: <Text style={{ fontWeight: "700" }}>{cs.surgicalDrainage.volume} ml</Text> • Tính chất: {cs.surgicalDrainage.color}
                            </Text>
                            {cs.surgicalDrainage.condition && (
                              <Text style={{ fontSize: 11, color: "#78350F" }}>
                                • Chân ống: {cs.surgicalDrainage.condition}
                              </Text>
                            )}
                          </View>
                        )}

                        {/* Fluid Infusions */}
                        {cs.fluidInfusions && cs.fluidInfusions.length > 0 && (
                          <View style={{ backgroundColor: "#EFF6FF", borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: "#BFDBFE" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                              <Activity size={14} color="#2563EB" />
                              <Text style={{ fontSize: 12, fontWeight: "700", color: "#1E3A8A" }}>
                                Lịch truyền dịch ({cs.fluidInfusions.length} chai)
                              </Text>
                            </View>
                            {cs.fluidInfusions.map((inf, i) => (
                              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: inf.status === "đang truyền" ? "#10B981" : inf.status === "tạm dừng" ? "#F59E0B" : "#94A3B8" }} />
                                <Text style={{ fontSize: 11, color: "#1E40AF", flex: 1 }}>
                                  {inf.fluidName} ({inf.volume}ml) • Tốc độ: {inf.rate}
                                </Text>
                                <Text style={{ fontSize: 10, color: "#64748B", fontWeight: "600" }}>{inf.status}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Progress Notes */}
                        <View style={{ marginTop: 4 }}>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: "#475569" }}>Diễn biến lâm sàng:</Text>
                          <Text style={{ fontSize: 12, color: "#1E293B", lineHeight: 18, marginTop: 2 }}>{cs.progressNotes}</Text>
                        </View>

                        {/* Care Actions */}
                        {cs.careActions && (
                          <View style={{ marginTop: 6 }}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: "#475569" }}>Thực hiện y lệnh & chăm sóc:</Text>
                            <Text style={{ fontSize: 12, color: "#1E293B", lineHeight: 18, marginTop: 2 }}>{cs.careActions}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ───────────────────────────────────────────────────────────────────
              4. TAB ORDER (Phiếu Chỉ Định Dịch Vụ)
              ─────────────────────────────────────────────────────────────────── */}
          {activeForm === "order" && (
            <View>
              {orderDone ? (
                /* COMPLETED PAPER FORM PREVIEW (PHIẾU CHỈ ĐỊNH DỊCH VỤ) */
                <View style={s.docPaper}>
                  <View style={s.docHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.docHospitalName}>BỆNH VIỆN CHUYÊN KHOA UNG THƯ NÃO NEUROSCAN</Text>
                      <Text style={s.docHospitalSub}>SỞ Y TẾ TP ĐÀ NẴNG</Text>
                    </View>
                    <FileText size={26} color={Colors.brandGreen} />
                  </View>
                  
                  <Text style={s.docTitle}>PHIẾU CHỈ ĐỊNH DỊCH VỤ</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 12 }}>
                    <Text style={{ fontSize: 13, color: '#374151', fontWeight: '500' }}>
                      Mức độ ưu tiên: <Text style={{ color: orderPriority === 'Cấp Cứu' ? '#B91C1C' : '#0D9488', fontWeight: 'bold' }}>
                        {orderPriority.toUpperCase()}
                      </Text>
                    </Text>
                  </View>
                  
                  <View style={s.docDivider} />
                  
                  <View style={s.docGrid}>
                    <View style={s.docCol}>
                      <Text style={s.docLabel}>Họ tên bệnh nhân: <Text style={s.docVal}>{patientName}</Text></Text>
                      <Text style={s.docLabel}>Giới tính: <Text style={s.docVal}>{gender || 'N/A'}</Text></Text>
                      <Text style={s.docLabel}>Tuổi: <Text style={s.docVal}>{age ? `${age} tuổi` : 'N/A'}</Text></Text>
                    </View>
                    <View style={s.docCol}>
                      <Text style={s.docLabel}>Khoa/Phòng khám: <Text style={s.docVal}>{department}</Text></Text>
                      <Text style={s.docLabel}>Chẩn đoán lâm sàng: <Text style={s.docVal}>{orderDiagnosis || 'N/A'}</Text></Text>
                    </View>
                  </View>
                  
                  <Text style={s.docSectionHeader}>DANH SÁCH CÁC DỊCH VỤ KỸ THUẬT CHỈ ĐỊNH</Text>
                  <View style={s.docTable}>
                    <View style={s.docTableRowHeader}>
                      <Text style={[s.docTableCellHeader, { flex: 1, textAlign: 'center' }]}>STT</Text>
                      <Text style={[s.docTableCellHeader, { flex: 4 }]}>Tên dịch vụ cận lâm sàng</Text>
                      <Text style={[s.docTableCellHeader, { flex: 2, textAlign: 'right' }]}>Đơn giá (VNĐ)</Text>
                    </View>
                    {orderServices.map((svc, idx) => (
                      <View key={idx} style={[s.docTableRow, idx % 2 === 1 && { backgroundColor: '#F8FAFC' }]}>
                        <Text style={[s.docTableCell, { flex: 1, textAlign: 'center' }]}>{idx + 1}</Text>
                        <Text style={[s.docTableCell, { flex: 4, fontWeight: '500' }]}>{svc}</Text>
                        <Text style={[s.docTableCell, { flex: 2, textAlign: 'right', color: '#475569' }]}>
                          {(svc.toLowerCase().includes('mri') ? 1500000 : svc.toLowerCase().includes('siêu âm') ? 250000 : 150000).toLocaleString('vi-VN')}
                        </Text>
                      </View>
                    ))}
                  </View>
                  
                  <View style={s.docFooterSignatures}>
                    <View style={{ flex: 1 }} />
                    <View style={s.docSignatureBox}>
                      <Text style={s.docSignatureDate}>Ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}</Text>
                      <Text style={s.docSignatureTitle}>BÁC SĨ CHỈ ĐỊNH</Text>
                      <Text style={s.docSignatureSub}>(Ký và ghi rõ họ tên)</Text>
                      <View style={{ height: 40 }} />
                      <Text style={s.docSignatureName}>{doctor}</Text>
                    </View>
                  </View>
                  
                  <View style={s.docActionRow}>
                    <TouchableOpacity onPress={() => setOrderDone(false)} style={[s.docEditBtn, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
                      <Edit2 size={13} color={Colors.brandGreen} />
                      <Text style={s.docEditBtnText}>Sửa lại chỉ định</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => window.print()} style={[s.docPrintBtn, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
                      <Printer size={13} color="#fff" />
                      <Text style={s.docPrintBtnText}>In phiếu chỉ định</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                /* INPUT FORM FOR ORDER (PHIẾU CHỈ ĐỊNH DỊCH VỤ) */
                <View>
                  <Text style={s.sectionTitle}>Phiếu Chỉ Định Dịch Vụ cận Lâm Sàng</Text>
                  <Text style={s.sectionSubtitle}>Chỉ định các cận lâm sàng dịch vụ cho bệnh nhân trước khi thanh toán.</Text>
                  <View style={s.card}>
                    <Text style={s.groupLabel}>Chế độ ưu tiên</Text>
                    <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
                      {["Thường", "Cấp Cứu"].map(p => (
                        <TouchableOpacity key={p} onPress={() => setOrderPriority(p)}
                          style={[s.toggleBtn, orderPriority === p && (p === "Cấp Cứu" ? s.toggleBtnRed : s.toggleBtnActive)]}>
                          <Text style={[s.toggleBtnText, orderPriority === p && s.toggleBtnTextActive]}>{p}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    
                    <Text style={s.fieldLabel}>Chẩn đoán lâm sàng sơ bộ *</Text>
                    <TextInput style={[s.input, { marginBottom: 14 }]} placeholder="VD: Theo dõi u não, đau đầu kéo dài chưa rõ nguyên nhân..." placeholderTextColor="#94A3B8" value={orderDiagnosis} onChangeText={setOrderDiagnosis} />
                    
                    <Text style={s.groupLabel}>Danh sách các dịch vụ chỉ định</Text>
                    {orderServices.length === 0 && <Text style={{ color: "#94A3B8", fontSize: 13, textAlign: "center", paddingVertical: 12 }}>Chưa chọn dịch vụ chỉ định nào.</Text>}
                    {orderServices.map((svc, idx) => (
                      <View key={idx} style={s.serviceRow}>
                        <FileText size={14} color="#047857" />
                        <Text style={{ flex: 1, color: "#065F46", fontSize: 13, marginLeft: 8 }}>{svc}</Text>
                        <TouchableOpacity onPress={() => setOrderServices(p => p.filter((_, i) => i !== idx))} style={{ padding: 4 }}>
                          <Trash2 size={15} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                      <TextInput style={[s.input, { flex: 1 }]} placeholder="Tên dịch vụ mới..." placeholderTextColor="#94A3B8" value={orderNewService} onChangeText={setOrderNewService} />
                      <TouchableOpacity onPress={addOrderService} style={s.addBtn}><Text style={s.addBtnText}>+</Text></TouchableOpacity>
                    </View>
                    
                    <Text style={[s.fieldLabel, { marginTop: 14 }]}>Chọn nhanh dịch vụ thường dùng:</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                      {QUICK_SERVICES.map(svc => (
                        <TouchableOpacity key={svc} onPress={() => { if (!orderServices.includes(svc)) setOrderServices(p => [...p, svc]); }} style={s.quickChip}>
                          <Text style={s.quickChipText}>{svc}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* CONFIRM BUTTON */}
                    <TouchableOpacity 
                      onPress={handleSaveOrderToBackend}
                      disabled={submitting}
                      style={[s.confirmBtn, submitting && { backgroundColor: "#94A3B8" }, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }]}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Save size={16} color="#fff" />
                          <Text style={s.confirmBtnText}>Xác nhận & Lưu phiếu chỉ định</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ───────────────────────────────────────────────────────────────────
              4. TAB FEE (Phiếu Thu Viện Phí)
              ─────────────────────────────────────────────────────────────────── */}
          {activeForm === "fee" && (
            <View>
              {invoiceDone ? (
                /* COMPLETED PAPER RECEIPT PREVIEW (PHIẾU THU VIỆN PHÍ) */
                <View style={s.docPaper}>
                  <View style={s.docHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.docHospitalName}>BỆNH VIỆN CHUYÊN KHOA UNG THƯ NÃO NEUROSCAN</Text>
                      <Text style={s.docHospitalAddress}>Khu Công Nghệ Cao Y Tế & Chuyên Khoa U Não Đà Nẵng</Text>
                    </View>
                    <CreditCard size={26} color={Colors.brandGreen} />
                  </View>
                  
                  <Text style={s.docTitle}>PHIẾU THU VIỆN PHÍ</Text>
                  <Text style={[s.docSubtitle, { marginBottom: 12 }]}>Số phiếu: {patientName ? patientName.slice(0, 3).toUpperCase() + Math.floor(100 + Math.random() * 900) : 'VP'}</Text>
                  
                  <View style={s.docDivider} />
                  
                  <View style={s.docGrid}>
                    <View style={s.docCol}>
                      <Text style={s.docLabel}>Họ và tên / Name: <Text style={s.docVal}>{patientName}</Text></Text>
                      <Text style={s.docLabel}>Giới tính / Gender: <Text style={s.docVal}>{gender || 'N/A'}</Text></Text>
                      <Text style={s.docLabel}>Đối tượng / Class: <Text style={s.docVal}>Thu Phí</Text></Text>
                    </View>
                    <View style={s.docCol}>
                      <Text style={s.docLabel}>Địa chỉ / Address: <Text style={s.docVal}>Đà Nẵng</Text></Text>
                      <Text style={s.docLabel}>Số BHYT / Insurance ID: <Text style={s.docVal}>—</Text></Text>
                    </View>
                  </View>
                  
                  <Text style={s.docSectionHeader}>CHI TIẾT CÁC KHOẢN THU (BILLING DETAILS)</Text>
                  <View style={s.docTable}>
                    <View style={s.docTableRowHeader}>
                      <Text style={[s.docTableCellHeader, { flex: 1, textAlign: 'center' }]}>STT</Text>
                      <Text style={[s.docTableCellHeader, { flex: 4 }]}>Tên dịch vụ y tế</Text>
                      <Text style={[s.docTableCellHeader, { flex: 2, textAlign: 'right' }]}>BN thanh toán</Text>
                      <Text style={[s.docTableCellHeader, { flex: 2, textAlign: 'right' }]}>Thành tiền (VNĐ)</Text>
                    </View>
                    {feeItems.map((item, idx) => (
                      <View key={idx} style={[s.docTableRow, idx % 2 === 1 && { backgroundColor: '#F8FAFC' }]}>
                        <Text style={[s.docTableCell, { flex: 1, textAlign: 'center' }]}>{idx + 1}</Text>
                        <Text style={[s.docTableCell, { flex: 4, fontWeight: '500' }]}>{item.name}</Text>
                        <Text style={[s.docTableCell, { flex: 2, textAlign: 'right', fontWeight: 'bold' }]}>{parseFloat(item.amount).toLocaleString('vi-VN')}</Text>
                        <Text style={[s.docTableCell, { flex: 2, textAlign: 'right' }]}>{parseFloat(item.amount).toLocaleString('vi-VN')}</Text>
                      </View>
                    ))}
                  </View>
                  
                  <View style={{ marginTop: 14, gap: 4 }}>
                    <Text style={{ fontSize: 13, color: '#374151', fontStyle: 'italic' }}>
                      Số tiền bằng chữ: <Text style={{ fontWeight: 'bold', fontStyle: 'normal' }}>{numberToVietnameseWords(totalFee)} đồng.</Text>
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 8, borderTopWidth: 1, borderColor: '#E2E8F0', paddingTop: 8 }}>
                      <Text style={{ fontSize: 14, color: '#475569' }}>Tổng chi phí: <Text style={{ fontWeight: 'bold', color: Colors.brandNavy }}>{totalFee.toLocaleString('vi-VN')} VNĐ</Text></Text>
                      <Text style={{ fontSize: 14, color: '#475569' }}>Tổng thu (VNĐ): <Text style={{ fontWeight: 'bold', color: '#047857', fontSize: 16 }}>{totalFee.toLocaleString('vi-VN')} VNĐ</Text></Text>
                    </View>
                  </View>
                  
                  <View style={s.docFooterSignatures}>
                    <View style={s.docSignatureBox}>
                      <Text style={s.docSignatureTitle}>Người nộp</Text>
                      <Text style={s.docSignatureSub}>(Ký và ghi rõ họ tên)</Text>
                      <View style={{ height: 45 }} />
                      <Text style={s.docSignatureName}>{patientName}</Text>
                    </View>
                    <View style={s.docSignatureBox}>
                      <Text style={s.docSignatureDate}>Ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}</Text>
                      <Text style={s.docSignatureTitle}>Người thu (Điều dưỡng)</Text>
                      <Text style={s.docSignatureSub}>(Ký và ghi rõ họ tên)</Text>
                      <View style={{ height: 45 }} />
                      <Text style={s.docSignatureName}>{localUser?.profile?.name || "Người thu tiền"}</Text>
                    </View>
                  </View>
                  
                  <Text style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 16, fontStyle: 'italic' }}>
                    (Đây không phải là hóa đơn GTGT, quý khách có nhu cầu lấy hóa đơn GTGT vui lòng liên hệ Quầy thu ngân để nhận ngay trong ngày)
                  </Text>
                  
                  <View style={s.docActionRow}>
                    <TouchableOpacity onPress={() => window.print()} style={[s.docPrintBtn, { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }]}>
                      <Printer size={14} color="#fff" />
                      <Text style={s.docPrintBtnText}>In hóa đơn viện phí</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                /* INPUT FORM FOR FEE (PHIẾU THU VIỆN PHÍ) */
                <View>
                  <Text style={s.sectionTitle}>Phiếu Thu Viện Phí</Text>
                  <Text style={s.sectionSubtitle}>Danh sách lấy từ phiếu chỉ định, giá theo bảng giá bệnh viện. Muốn thêm/bớt dịch vụ, sửa ở tab Chỉ định.</Text>
                  <View style={s.card}>
                    <View style={s.patientSummaryBox}>
                      <Text style={s.fieldLabel}>Họ và tên: <Text style={{ fontWeight: "700" }}>{patientName}</Text></Text>
                      <Text style={s.fieldLabel}>Giới tính: {gender || "N/A"}  |  Đối tượng: Thu phí</Text>
                    </View>
                    
                    <View style={s.tableHeader}>
                      <Text style={[s.tableHeaderText, { flex: 3 }]}>Tên dịch vụ y tế</Text>
                      <Text style={[s.tableHeaderText, { flex: 2, textAlign: "right" }]}>Thành tiền (VNĐ)</Text>
                    </View>
                    {feeItems.map((item, idx) => (
                      <View key={idx} style={[s.tableRow, { backgroundColor: idx % 2 === 0 ? "#fff" : "#F8FAFC" }]}>
                        <Text style={{ flex: 3, fontSize: 13, color: "#374151" }}>{item.name}</Text>
                        <Text style={{ flex: 2, fontSize: 13, fontWeight: "600", color: "#0F172A", textAlign: "right" }}>
                          {parseFloat(item.amount).toLocaleString("vi-VN")}
                        </Text>
                      </View>
                    ))}
                    {feeItems.length === 0 && (
                      <Text style={[s.hintText, { textAlign: "center", paddingVertical: 14 }]}>
                        {activeVisitId ? "Chưa có dịch vụ — hãy lưu phiếu ở tab Chỉ định." : "Bệnh nhân mở từ Hồ sơ bệnh án không gắn lượt khám nên không lập phiếu thu tại đây. Vui lòng mở từ Hàng chờ / Lượt khám hôm nay."}
                      </Text>
                    )}
                    
                    <View style={{ marginTop: 12 }}>
                      <Text style={s.fieldLabel}>Ghi chú thêm</Text>
                      <TextInput style={[s.input, { height: 56, textAlignVertical: "top" }]} placeholder="Ghi chú hóa đơn..." placeholderTextColor="#94A3B8" multiline value={feeNote} onChangeText={setFeeNote} />
                    </View>
                    
                    <View style={s.totalBox}>
                      <Text style={s.totalLabel}>TỔNG THU:</Text>
                      <Text style={s.totalValue}>{totalFee.toLocaleString("vi-VN")} VNĐ</Text>
                    </View>

                    {/* CONFIRM / SUBMIT BUTTON */}
                    <TouchableOpacity onPress={handleConfirmFee} disabled={submitting || feeItems.length === 0}
                      style={[s.confirmBtn, (submitting || feeItems.length === 0) && { backgroundColor: "#94A3B8" }, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }]}>
                      {submitting ? <ActivityIndicator color="#fff" /> : (
                        <>
                          <CreditCard size={16} color="#fff" />
                          <Text style={s.confirmBtnText}>Xác nhận & Gửi sang Thu Ngân</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    
                    <Text style={s.hintText}>Sau khi xác nhận, hóa đơn sẽ tự động chuyển sang hàng đợi Chờ thanh toán của quầy Lễ tân/Thu ngân.</Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
      {dialog}
    </ResponsiveLayout>
  );
};

const s = StyleSheet.create({
  topHeader: { backgroundColor: Colors.brandGreen, paddingHorizontal: 20, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  backBtn: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  backBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  headerSub: { color: "#CCFBF1", fontSize: 12, marginTop: 2 },
  tabBarContainer: { backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  tabBar: { flexGrow: 0 },
  tabPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#CBD5E1" },
  tabPillActive: { backgroundColor: Colors.brandGreen, borderColor: Colors.brandGreen },
  tabPillText: { color: "#475569", fontWeight: "600", fontSize: 13 },
  tabPillTextActive: { color: "#fff" },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: "#0F172A", marginBottom: 4 },
  sectionSubtitle: { fontSize: 12, color: "#64748B", marginBottom: 14, lineHeight: 18 },
  groupLabel: { fontSize: 13, fontWeight: "700", color: Colors.brandGreen, marginBottom: 10 },
  fieldLabel: { fontSize: 13, color: "#374151", marginBottom: 4, fontWeight: "600" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 18, borderWidth: 1, borderColor: "#E2E8F0", elevation: 2, marginBottom: 16 },
  infoRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#F1F5F9", paddingVertical: 9 },
  infoLabel: { width: 150, color: "#64748B", fontSize: 13 },
  infoValue: { flex: 1, color: "#0F172A", fontSize: 13, fontWeight: "500" },
  guideBox: { backgroundColor: "#ECFDF5", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#6EE7B7" },
  guideTitle: { color: "#065F46", fontWeight: "700", fontSize: 14, marginBottom: 6 },
  guideText: { color: "#047857", fontSize: 13, lineHeight: 22 },
  input: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#0F172A" },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0" },
  toggleBtnActive: { backgroundColor: "#ECFDF5", borderColor: "#6EE7B7" },
  toggleBtnRed: { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" },
  toggleBtnText: { color: "#64748B", fontWeight: "600", fontSize: 13 },
  toggleBtnTextActive: { color: "#065F46" },
  serviceRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#F0FDF4", borderRadius: 8, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: "#BBF7D0" },
  addBtn: { backgroundColor: Colors.brandGreen, borderRadius: 8, paddingHorizontal: 14, justifyContent: "center", alignItems: "center", minHeight: 44 },
  addBtnText: { color: "#fff", fontWeight: "800", fontSize: 20 },
  quickChip: { backgroundColor: "#EFF6FF", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#BFDBFE" },
  quickChipText: { color: Colors.info, fontSize: 12, fontWeight: "500" },
  patientSummaryBox: { backgroundColor: "#F8FAFC", borderRadius: 8, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: "#E2E8F0", gap: 4 },
  tableHeader: { flexDirection: "row", backgroundColor: "#F1F5F9", padding: 10, borderRadius: 6, marginBottom: 2 },
  tableHeaderText: { fontWeight: "700", color: "#374151", fontSize: 13 },
  tableRow: { flexDirection: "row", alignItems: "center", padding: 10, borderBottomWidth: 1, borderColor: "#F1F5F9" },
  totalBox: { backgroundColor: Colors.brandGreen, borderRadius: 10, padding: 14, marginTop: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { color: "#fff", fontWeight: "700", fontSize: 15 },
  totalValue: { color: "#fff", fontWeight: "800", fontSize: 18 },
  confirmBtn: { backgroundColor: Colors.brandGreen, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 20, width: "100%" },
  confirmBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  successBox: { backgroundColor: "#ECFDF5", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: "#6EE7B7", marginTop: 14, alignItems: "center" },
  successText: { color: "#065F46", fontWeight: "700", fontSize: 14 },
  hintText: { color: "#94A3B8", fontSize: 12, textAlign: "center", marginTop: 10, lineHeight: 16 },

  // ── CLINICAL DOCUMENTS PREVIEWS STYLES (A4 Paper Aesthetic) ──
  docPaper: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 24,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 20,
  },
  docHeader: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#0F172A",
    paddingBottom: 12,
    marginBottom: 16,
  },
  docHospitalName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  docHospitalAddress: {
    fontSize: 12,
    color: "#475569",
    marginTop: 2,
  },
  docHospitalSub: {
    fontSize: 12,
    color: "#475569",
    marginTop: 2,
    fontWeight: "500",
  },
  docLogoText: {
    fontSize: 28,
  },
  docTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    textTransform: "uppercase",
  },
  docSubtitle: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 2,
    fontStyle: "italic",
  },
  docDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 12,
  },
  docGrid: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  docCol: {
    flex: 1,
    gap: 6,
  },
  docLabel: {
    fontSize: 12,
    color: "#475569",
  },
  docVal: {
    fontWeight: "600",
    color: "#0F172A",
  },
  docSectionHeader: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 8,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  docTable: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 14,
  },
  docTableRowHeader: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderBottomWidth: 1,
    borderBottomColor: "#CBD5E1",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  docTableCellHeader: {
    fontSize: 12,
    fontWeight: "800",
    color: "#334155",
  },
  docTableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#FFFFFF",
  },
  docTableCell: {
    fontSize: 12,
    color: "#334155",
  },
  docFooterSignatures: {
    flexDirection: "row",
    marginTop: 20,
    marginBottom: 10,
    justifyContent: "space-between",
  },
  docSignatureBox: {
    alignItems: "center",
    width: 200,
  },
  docSignatureDate: {
    fontSize: 12,
    color: "#475569",
    fontStyle: "italic",
    marginBottom: 4,
  },
  docSignatureTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
  },
  docSignatureSub: {
    fontSize: 12,
    color: "#64748B",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 1,
  },
  docSignatureName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
    marginTop: 4,
  },
  docActionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    borderTopWidth: 1,
    borderColor: "#F1F5F9",
    paddingTop: 16,
  },
  docEditBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  docEditBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  docPrintBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.brandGreen,
    alignItems: "center",
  },
  docPrintBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  priorityText: {
    fontSize: 12,
    color: "#475569",
  },
  docTableRowDanger: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  docTableCellDanger: {
    color: '#B91C1C',
    fontWeight: '700',
  },
  docTableCellDangerVal: {
    color: '#DC2626',
    fontWeight: '800',
  },
  dangerBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  dangerBadgeText: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  normalBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  normalBadgeText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  vitalsAlertCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#F87171',
    padding: 12,
    marginBottom: 12,
  },
  vitalsAlertTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B91C1C',
  },
  vitalsAlertSubtitle: {
    fontSize: 12,
    color: '#7F1D1D',
    marginBottom: 6,
  },
  vitalsAlertItem: {
    fontSize: 12,
    color: '#991B1B',
    fontWeight: '600',
    marginTop: 2,
  },
  inputDanger: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
  },
  inputAlertText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
});

export default NursePatientDetailScreen;
