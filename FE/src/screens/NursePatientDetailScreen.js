import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, StyleSheet, SafeAreaView, Platform
} from "react-native";
import ResponsiveLayout from "../components/ResponsiveLayout";
import Colors from "../constants/colors";
import { get, post, put } from "../services/api.service";

const NursePatientDetailScreen = ({ navigation, route }) => {
  const patient = route?.params?.patient || {};
  const patientName  = patient.patientName || patient?.profile?.name || "Bệnh nhân";
  const patientIdStr = patient.patientId   || patient._id || "";
  const gender       = patient.gender      || patient?.profile?.gender || "";
  const age          = patient.age         || "";
  const department   = patient.department  || "Khoa Nội Thần Kinh";
  const doctor       = patient.doctorInCharge || "Bs. Văn Trung Nghĩa";

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
  const [examRequest,setExamRequest]= useState("Khám sức khỏe tổng quát");
  const [examObject, setExamObject] = useState("Thu phí");

  // ── Phiếu chỉ định dịch vụ (Service Order) ──
  const [orderPriority,   setOrderPriority]   = useState("Thường");
  const [orderDiagnosis,  setOrderDiagnosis]  = useState("Theo dõi chấn thương đầu");
  const [orderServices,   setOrderServices]   = useState(["Chụp MRI sọ não"]);
  const [orderNewService, setOrderNewService] = useState("");

  // ── Phiếu thu viện phí (Fee Items) ──
  const [feeItems,    setFeeItems]    = useState([
    { name: "Khám chuyên khoa thần kinh", amount: "150000" }
  ]);
  const [feeNewName,  setFeeNewName]  = useState("");
  const [feeNewAmt,   setFeeNewAmt]   = useState("");
  const [feeNote,     setFeeNote]     = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [invoiceDone, setInvoiceDone] = useState(false);

  // Local Cache Load/Save state
  const [isLoaded, setIsLoaded] = useState(false);

  const totalFee = feeItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  // 1. Fetch logged in user to show nurse name on signatures
  useEffect(() => {
    const loadUser = async () => {
      try {
        if (Platform.OS === 'web') {
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            setLocalUser(JSON.parse(storedUser));
            return;
          }
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

  // 2. Load Patient-Specific Form Cache from localStorage
  useEffect(() => {
    if (!patient._id) return;
    try {
      if (Platform.OS === 'web') {
        const savedData = localStorage.getItem(`emr_detail_${patient._id}`);
        if (savedData) {
          const data = JSON.parse(savedData);
          
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
          setOrderDiagnosis("Theo dõi chấn thương đầu");
          setOrderServices(["Chụp MRI sọ não lát cắt mỏng", "Xét nghiệm máu"]);
          
          setFeeItems([
            { name: "Khám chuyên khoa thần kinh", amount: "150000" },
            { name: "Chụp MRI sọ não lát cắt mỏng", amount: "1500000" },
            { name: "Xét nghiệm tổng phân tích tế bào máu", amount: "150000" }
          ]);
          setFeeNote("");
          setInvoiceDone(false);
        }
      }
    } catch (e) {
      console.log("Error loading cached patient form data:", e);
    } finally {
      setIsLoaded(true);
    }
  }, [patient._id]);

  // 3. Auto-Save Patient-Specific Form Cache to localStorage when state changes
  useEffect(() => {
    if (!patient._id || !isLoaded) return;
    try {
      if (Platform.OS === 'web') {
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
        localStorage.setItem(`emr_detail_${patient._id}`, JSON.stringify(cacheData));
      }
    } catch (e) {
      console.log("Error caching patient form data:", e);
    }
  }, [
    patient._id,
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

  const addFeeItem = () => {
    if (!feeNewName.trim() || !feeNewAmt.trim()) return;
    setFeeItems(p => [...p, { name: feeNewName.trim(), amount: feeNewAmt.trim() }]);
    setFeeNewName(""); 
    setFeeNewAmt("");
  };

  const getOrCreateMedicalRecordId = async () => {
    const pid = patient._id || patient.patientId;
    try {
      const res = await get(`/emr/records?search=${pid}`);
      if (res?.data && res.data.length > 0) {
        return res.data[0]._id;
      }
      // Create new record if not exists
      const newRes = await post('/emr/records', {
        patientId: pid,
        patientName: patientName || "Bệnh nhân",
        age: age || 30,
        diagnosis: "Khám tổng quát",
        doctorInCharge: doctor || "Bác sĩ",
      });
      return newRes?.data?._id || pid;
    } catch (e) {
      console.error("Lỗi lấy/tạo bệnh án:", e);
      return pid; // fallback
    }
  };

  // 4. Save Clinical Exam (Vitals) to Backend EMR
  const handleSaveExamToBackend = async () => {
    if (!examPulse || !examBP || !examTemp || !examSpo2) {
      Alert.alert("Thông báo", "Vui lòng nhập đầy đủ các chỉ số sinh hiệu chính.");
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

      // Update visit vitals if visitId exists
      if (patient.visitId) {
        await put(`/api/v1/visits/${patient.visitId}/vitals`, {
          vitals: {
            pulse: parseInt(examPulse),
            bloodPressure: examBP,
            temperature: parseFloat(examTemp),
            spo2: parseInt(examSpo2),
            respiratoryRate: examBreath ? parseInt(examBreath) : undefined
          }
        });
        // Cập nhật trạng thái lượt khám để thông báo Bác sĩ
        await put(`/api/v1/visits/${patient.visitId}/status`, { status: 'đang khám' });
      }

      setExamDone(true);
      Alert.alert("Thành công", "Phiếu khám lâm sàng và sinh hiệu đã được lưu thành công vào hồ sơ bệnh án!");
    } catch (err) {
      Alert.alert("Lỗi", err?.message || "Không thể lưu thông tin phiếu khám lên hệ thống.");
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Save Service Order (Chỉ định) to Backend EMR
  const handleSaveOrderToBackend = async () => {
    if (orderServices.length === 0) {
      Alert.alert("Thông báo", "Vui lòng chỉ định ít nhất một dịch vụ.");
      return;
    }
    setSubmitting(true);
    try {
      const recordId = await getOrCreateMedicalRecordId();
      // Update MedicalRecord diagnosis and treatment plan
      await put(`/emr/records/${recordId}`, {
        diagnosis: orderDiagnosis,
        treatmentPlan: `Chỉ định dịch vụ cận lâm sàng: ${orderServices.join(", ")}`
      });

      // Synchronize services to Viện phí ONLY upon clicking confirm in Chỉ định
      const baseFees = [];
      const hasExamFee = orderServices.some(svc => svc.toLowerCase().includes("khám") || svc.toLowerCase().includes("kham"));
      if (!hasExamFee) {
        baseFees.push({ name: "Khám chuyên khoa thần kinh", amount: "150000" });
      }

      const orderedFees = orderServices.map(svc => {
        let amt = "150000";
        const lower = svc.toLowerCase();
        if (lower.includes("mri") || lower.includes("cộng hưởng từ")) {
          amt = "1500000";
        } else if (lower.includes("ai") || lower.includes("phân tích")) {
          amt = "200000";
        } else if (lower.includes("khám") || lower.includes("kham")) {
          amt = "150000";
        } else if (lower.includes("siêu âm")) {
          amt = "250000";
        } else if (lower.includes("x-quang") || lower.includes("xquang")) {
          amt = "150000";
        }
        return { name: svc, amount: amt };
      });
      setFeeItems([...baseFees, ...orderedFees]);

      setOrderDone(true);
      Alert.alert("Thành công", "Đã lưu phiếu chỉ định và đồng bộ hóa danh sách sang viện phí thành công!");
    } catch (err) {
      Alert.alert("Lỗi", err?.message || "Không thể lưu phiếu chỉ định lên hệ thống.");
    } finally {
      setSubmitting(false);
    }
  };

  // 6. Save Invoice to Backend (Chuyển quầy Thu Ngân)
  const handleConfirmFee = async () => {
    if (feeItems.length === 0) { 
      Alert.alert("Thông báo", "Vui lòng thêm ít nhất một dịch vụ."); 
      return; 
    }
    setSubmitting(true);
    try {
      const items = feeItems.map(i => ({ description: i.name, amount: parseFloat(i.amount) || 0 }));
      const pid = patient._id || patient.patientId;
      const vid = patient.visitId || undefined;
      
      await post("/api/v1/invoices/pending", { 
        patientId: pid, 
        visitId: vid, 
        items, 
        totalAmount: totalFee, 
        notes: feeNote 
      });
      
      setInvoiceDone(true);
      Alert.alert(
        "Xác nhận thành công",
        `Phiếu thu của ${patientName} đã được gửi sang quầy Thu Ngân.\nTổng thu: ${totalFee.toLocaleString("vi-VN")} VNĐ`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert("Lỗi", err?.message || "Không thể tạo hóa đơn chờ thanh toán.");
    } finally {
      setSubmitting(false);
    }
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
    { key: "info",  label: "👤 Thông tin" },
    { key: "exam",  label: "📋 Khám bệnh" },
    { key: "order", label: "📝 Chỉ định" },
    { key: "fee",   label: "💰 Viện phí" },
  ];

  const QUICK_SERVICES = ["Khám chuyên khoa thần kinh", "Chụp MRI sọ não", "Phân tích AI chẩn đoán"];

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="EMRDashboard">
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F1F5F9" }}>
        {/* Top bar */}
        <View style={s.topHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backBtnText}>← Quay lại</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>🏥 {patientName}</Text>
            <Text style={s.headerSub}>{gender}{age ? " • " + age + " tuổi" : ""}{department ? " • " + department : ""}</Text>
          </View>
        </View>

        {/* Form tab selector */}
        <View style={s.tabBarContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 10, flexDirection: "row" }}>
            {FORM_TABS.map(t => {
              let statusMark = "";
              if (t.key === 'exam' && examDone) statusMark = " ✅";
              if (t.key === 'order' && orderDone) statusMark = " ✅";
              if (t.key === 'fee' && invoiceDone) statusMark = " ✅";
              
              return (
                <TouchableOpacity key={t.key} onPress={() => setActiveForm(t.key)}
                  style={[s.tabPill, activeForm === t.key && s.tabPillActive]}>
                  <Text style={[s.tabPillText, activeForm === t.key && s.tabPillTextActive]}>
                    {t.label}{statusMark}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>

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
                <Text style={s.guideTitle}>💡 Quy trình điền hồ sơ (Dành cho Điều dưỡng)</Text>
                <Text style={s.guideText}>
                  {"1. Tab Khám bệnh ➔ Ghi nhận sinh hiệu ➔ Bấm Xác nhận để lưu Phiếu khám.\n2. Tab Chỉ định ➔ Thêm chỉ định lâm sàng ➔ Bấm Xác nhận để lưu Phiếu chỉ định.\n3. Tab Viện phí ➔ Xác nhận hóa đơn dịch vụ ➔ Gửi thông tin sang quầy Thu ngân thanh toán."}
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
                      <Text style={s.docHospitalSub}>BỆNH VIỆN ĐA KHOA TÂM TRÍ ĐÀ NẴNG</Text>
                    </View>
                    <Text style={s.docLogoText}>🏥</Text>
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
                  
                  <Text style={s.docSectionHeader}>🫀 SINH HIỆU LÂM SÀNG (VITAL SIGNS)</Text>
                  <View style={s.docTable}>
                    <View style={s.docTableRowHeader}>
                      <Text style={[s.docTableCellHeader, { flex: 2 }]}>Chỉ số sinh hiệu</Text>
                      <Text style={[s.docTableCellHeader, { flex: 1, textAlign: 'center' }]}>Giá trị</Text>
                      <Text style={[s.docTableCellHeader, { flex: 1, textAlign: 'center' }]}>Đơn vị</Text>
                    </View>
                    {[
                      ['Mạch / Pulse', examPulse, 'lần/phút'],
                      ['Huyết áp / Blood pressure', examBP, 'mmHg'],
                      ['Chiều cao / Height', examHeight, 'cm'],
                      ['Cân nặng / Weight', examWeight, 'kg'],
                      ['Nhịp thở / Breath', examBreath, 'lần/phút'],
                      ['Nhiệt độ / Temperature', examTemp, '°C'],
                      ['Chỉ số SpO2', examSpo2, '%'],
                      ['Chỉ số BMI thể trạng', examHeight && examWeight ? (parseFloat(examWeight) / Math.pow(parseFloat(examHeight)/100, 2)).toFixed(1) : '—', ''],
                    ].map(([name, val, unit], idx) => (
                      <View key={idx} style={[s.docTableRow, idx % 2 === 1 && { backgroundColor: '#F8FAFC' }]}>
                        <Text style={[s.docTableCell, { flex: 2 }]}>{name}</Text>
                        <Text style={[s.docTableCell, { flex: 1, textAlign: 'center', fontWeight: 'bold', color: '#0F172A' }]}>{val || '—'}</Text>
                        <Text style={[s.docTableCell, { flex: 1, textAlign: 'center', color: '#64748B' }]}>{unit}</Text>
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
                    <TouchableOpacity onPress={() => setExamDone(false)} style={s.docEditBtn}>
                      <Text style={s.docEditBtnText}>✏️ Sửa lại phiếu</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => window.print()} style={s.docPrintBtn}>
                      <Text style={s.docPrintBtnText}>🖨️ In Phiếu Khám</Text>
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
                    {[
                      ["Mạch (lần/phút) *", examPulse,  setExamPulse,  "numeric", "Ví dụ: 80"],
                      ["Huyết áp (mmHg) *", examBP,      setExamBP,     "default", "Ví dụ: 120/80"],
                      ["Chiều cao (cm)",  examHeight,  setExamHeight, "numeric", "Ví dụ: 165"],
                      ["Cân nặng (kg)",   examWeight,  setExamWeight, "numeric", "Ví dụ: 60"],
                      ["Nhịp thở (lần/phút)", examBreath,  setExamBreath, "numeric", "Ví dụ: 18"],
                      ["Nhiệt độ (°C) *",    examTemp,    setExamTemp,   "numeric", "Ví dụ: 37.0"],
                      ["SpO2 (%) *",        examSpo2,    setExamSpo2,   "numeric", "Ví dụ: 98"],
                    ].map(([label, val, setter, kb, ph]) => (
                      <View key={label} style={{ marginBottom: 12 }}>
                        <Text style={s.fieldLabel}>{label}</Text>
                        <TextInput style={s.input} placeholder={ph} placeholderTextColor="#94A3B8" keyboardType={kb} value={val} onChangeText={setter} />
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
                      style={[s.confirmBtn, submitting && { backgroundColor: "#94A3B8" }]}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={s.confirmBtnText}>💾 Xác nhận & Lưu phiếu khám</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ───────────────────────────────────────────────────────────────────
              3. TAB ORDER (Phiếu Chỉ Định Dịch Vụ)
              ─────────────────────────────────────────────────────────────────── */}
          {activeForm === "order" && (
            <View>
              {orderDone ? (
                /* COMPLETED PAPER FORM PREVIEW (PHIẾU CHỈ ĐỊNH DỊCH VỤ) */
                <View style={s.docPaper}>
                  <View style={s.docHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.docHospitalName}>BỆNH VIỆN ĐA KHOA TÂM TRÍ ĐÀ NẴNG</Text>
                      <Text style={s.docHospitalSub}>SỞ Y TẾ TP ĐÀ NẴNG</Text>
                    </View>
                    <Text style={s.docLogoText}>📝</Text>
                  </View>
                  
                  <Text style={s.docTitle}>PHIẾU CHỈ ĐỊNH DỊCH VỤ</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 12 }}>
                    <Text style={{ fontSize: 13, color: '#374151', fontWeight: '500' }}>
                      Mức độ ưu tiên: <Text style={{ color: orderPriority === 'Cấp Cứu' ? '#DC2626' : '#0D9488', fontWeight: 'bold' }}>
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
                  
                  <Text style={s.docSectionHeader}>📋 DANH SÁCH CÁC DỊCH VỤ KỸ THUẬT CHỈ ĐỊNH</Text>
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
                    <TouchableOpacity onPress={() => setOrderDone(false)} style={s.docEditBtn}>
                      <Text style={s.docEditBtnText}>✏️ Sửa lại chỉ định</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => window.print()} style={s.docPrintBtn}>
                      <Text style={s.docPrintBtnText}>🖨️ In Phiếu Chỉ Định</Text>
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
                    
                    <Text style={s.fieldLabel}>Chẩn đoán lâm sàng sơ bộ</Text>
                    <TextInput style={[s.input, { marginBottom: 14 }]} placeholder="Nhập chẩn đoán sơ bộ..." placeholderTextColor="#94A3B8" value={orderDiagnosis} onChangeText={setOrderDiagnosis} />
                    
                    <Text style={s.groupLabel}>Danh sách các dịch vụ chỉ định</Text>
                    {orderServices.length === 0 && <Text style={{ color: "#94A3B8", fontSize: 13, textAlign: "center", paddingVertical: 12 }}>Chưa chọn dịch vụ chỉ định nào.</Text>}
                    {orderServices.map((svc, idx) => (
                      <View key={idx} style={s.serviceRow}>
                        <Text style={{ flex: 1, color: "#065F46", fontSize: 13 }}>📌 {svc}</Text>
                        <TouchableOpacity onPress={() => setOrderServices(p => p.filter((_, i) => i !== idx))}>
                          <Text style={{ color: "#EF4444", fontWeight: "700", fontSize: 16 }}>✕</Text>
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
                      style={[s.confirmBtn, submitting && { backgroundColor: "#94A3B8" }]}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={s.confirmBtnText}>💾 Xác nhận & Lưu phiếu chỉ định</Text>
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
                      <Text style={s.docHospitalName}>BỆNH VIỆN ĐA KHOA TÂM TRÍ ĐÀ NẴNG</Text>
                      <Text style={s.docHospitalAddress}>64, Cách Mạng Tháng 8, P. Khuê Trung, Q. Cẩm Lệ, TP Đà Nẵng</Text>
                    </View>
                    <Text style={s.docLogoText}>💰</Text>
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
                  
                  <Text style={s.docSectionHeader}>💰 CHI TIẾT CÁ C KHOẢN THU (BILLING DETAILS)</Text>
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
                      <Text style={{ fontSize: 14, color: '#475569' }}>Tổng chi phí: <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>{totalFee.toLocaleString('vi-VN')} VNĐ</Text></Text>
                      <Text style={{ fontSize: 14, color: '#475569' }}>Tổng thu (VNĐ): <Text style={{ fontWeight: 'bold', color: '#059669', fontSize: 16 }}>{totalFee.toLocaleString('vi-VN')} VNĐ</Text></Text>
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
                  
                  <Text style={{ fontSize: 10, color: '#94A3B8', textAlign: 'center', marginTop: 16, fontStyle: 'italic' }}>
                    (Đây không phải là hóa đơn GTGT, quý khách có nhu cầu lấy hóa đơn GTGT vui lòng liên hệ Quầy thu ngân để nhận ngay trong ngày)
                  </Text>
                  
                  <View style={s.docActionRow}>
                    <TouchableOpacity onPress={() => window.print()} style={[s.docPrintBtn, { flex: 1 }]}>
                      <Text style={s.docPrintBtnText}>🖨️ In Hóa Đơn Thu Viện Phí</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                /* INPUT FORM FOR FEE (PHIẾU THU VIỆN PHÍ) */
                <View>
                  <Text style={s.sectionTitle}>Phiếu Thu Viện Phí</Text>
                  <Text style={s.sectionSubtitle}>Kiểm tra lại danh sách các dịch vụ thu phí của bệnh nhân trước khi chuyển.</Text>
                  <View style={s.card}>
                    <View style={s.patientSummaryBox}>
                      <Text style={s.fieldLabel}>Họ và tên: <Text style={{ fontWeight: "700" }}>{patientName}</Text></Text>
                      <Text style={s.fieldLabel}>Giới tính: {gender || "N/A"}  |  Đối tượng: Thu phí</Text>
                    </View>
                    
                    <View style={s.tableHeader}>
                      <Text style={[s.tableHeaderText, { flex: 3 }]}>Tên dịch vụ y tế</Text>
                      <Text style={[s.tableHeaderText, { flex: 2, textAlign: "right" }]}>Thành tiền (VNĐ)</Text>
                      <View style={{ width: 28 }} />
                    </View>
                    {feeItems.map((item, idx) => (
                      <View key={idx} style={[s.tableRow, { backgroundColor: idx % 2 === 0 ? "#fff" : "#F8FAFC" }]}>
                        <Text style={{ flex: 3, fontSize: 13, color: "#374151" }}>{item.name}</Text>
                        <Text style={{ flex: 2, fontSize: 13, fontWeight: "600", color: "#0F172A", textAlign: "right" }}>
                          {parseFloat(item.amount).toLocaleString("vi-VN")}
                        </Text>
                        <TouchableOpacity onPress={() => setFeeItems(p => p.filter((_, i) => i !== idx))} style={{ width: 28, alignItems: "center" }}>
                          <Text style={{ color: "#EF4444", fontWeight: "700" }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                    
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                      <TextInput style={[s.input, { flex: 2 }]} placeholder="Tên dịch vụ phát sinh..." placeholderTextColor="#94A3B8" value={feeNewName} onChangeText={setFeeNewName} />
                      <TextInput style={[s.input, { flex: 1 }]} placeholder="Số tiền..." placeholderTextColor="#94A3B8" keyboardType="numeric" value={feeNewAmt} onChangeText={setFeeNewAmt} />
                      <TouchableOpacity onPress={addFeeItem} style={s.addBtn}><Text style={s.addBtnText}>+</Text></TouchableOpacity>
                    </View>
                    
                    <View style={{ marginTop: 12 }}>
                      <Text style={s.fieldLabel}>Ghi chú thêm</Text>
                      <TextInput style={[s.input, { height: 56, textAlignVertical: "top" }]} placeholder="Ghi chú hóa đơn..." placeholderTextColor="#94A3B8" multiline value={feeNote} onChangeText={setFeeNote} />
                    </View>
                    
                    <View style={s.totalBox}>
                      <Text style={s.totalLabel}>TỔNG THU:</Text>
                      <Text style={s.totalValue}>{totalFee.toLocaleString("vi-VN")} VNĐ</Text>
                    </View>

                    {/* CONFIRM / SUBMIT BUTTON */}
                    <TouchableOpacity onPress={handleConfirmFee} disabled={submitting}
                      style={[s.confirmBtn, submitting && { backgroundColor: "#94A3B8" }]}>
                      {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.confirmBtnText}>Xác nhận & Gửi sang Thu Ngân</Text>}
                    </TouchableOpacity>
                    
                    <Text style={s.hintText}>Sau khi xác nhận, hóa đơn sẽ tự động chuyển sang hàng đợi Chờ Thanh Toán của quầy Lễ tân/Thu ngân.</Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ResponsiveLayout>
  );
};

const s = StyleSheet.create({
  topHeader: { backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  backBtn: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  backBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  headerSub: { color: "#CCFBF1", fontSize: 12, marginTop: 2 },
  tabBarContainer: { backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  tabBar: { flexGrow: 0 },
  tabPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#CBD5E1" },
  tabPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabPillText: { color: "#475569", fontWeight: "600", fontSize: 13 },
  tabPillTextActive: { color: "#fff" },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: "#0F172A", marginBottom: 4 },
  sectionSubtitle: { fontSize: 12, color: "#64748B", marginBottom: 14, lineHeight: 18 },
  groupLabel: { fontSize: 13, fontWeight: "700", color: Colors.primary, marginBottom: 10 },
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
  addBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 14, justifyContent: "center", alignItems: "center", minHeight: 44 },
  addBtnText: { color: "#fff", fontWeight: "800", fontSize: 20 },
  quickChip: { backgroundColor: "#EFF6FF", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#BFDBFE" },
  quickChipText: { color: Colors.info, fontSize: 12, fontWeight: "500" },
  patientSummaryBox: { backgroundColor: "#F8FAFC", borderRadius: 8, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: "#E2E8F0", gap: 4 },
  tableHeader: { flexDirection: "row", backgroundColor: "#F1F5F9", padding: 10, borderRadius: 6, marginBottom: 2 },
  tableHeaderText: { fontWeight: "700", color: "#374151", fontSize: 13 },
  tableRow: { flexDirection: "row", alignItems: "center", padding: 10, borderBottomWidth: 1, borderColor: "#F1F5F9" },
  totalBox: { backgroundColor: Colors.primary, borderRadius: 10, padding: 14, marginTop: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { color: "#fff", fontWeight: "700", fontSize: 15 },
  totalValue: { color: "#fff", fontWeight: "800", fontSize: 18 },
  confirmBtn: { backgroundColor: Colors.primary, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 20, width: "100%" },
  confirmBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  successBox: { backgroundColor: "#ECFDF5", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: "#6EE7B7", marginTop: 14, alignItems: "center" },
  successText: { color: "#065F46", fontWeight: "700", fontSize: 14 },
  hintText: { color: "#94A3B8", fontSize: 11, textAlign: "center", marginTop: 10, lineHeight: 16 },

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
    fontSize: 10,
    color: "#475569",
    marginTop: 2,
  },
  docHospitalSub: {
    fontSize: 11,
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
    fontSize: 11,
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
    fontSize: 11,
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
    fontSize: 11,
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
    fontSize: 10,
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
    backgroundColor: Colors.primary,
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
});

export default NursePatientDetailScreen;
