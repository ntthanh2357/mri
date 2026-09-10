import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Colors from '../../constants/colors';
import { FlaskConical, Droplets, Edit2 } from 'lucide-react';

const LabOrdersTab = ({
  isDesktop,
  labOrders = [],
  selectedOrder,
  setSelectedOrder,
  currentUser,
  handleCreateLabOrder,
  patient,
  isEditingLab,
  setIsEditingLab,
  getAbnormalDirection,
  renderManualLabForm,
  styles,
}) => {
  return (
    <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
      {/* Cột trái: Danh sách phiếu xét nghiệm & Tạo phiếu mới */}
      <View style={isDesktop ? styles.sideCol : styles.fullWidth}>
        <View style={styles.card}>
          <Text style={styles.cardTitleText}>Phiếu chỉ định ({labOrders.length})</Text>
          <Text style={styles.cardSubtitleText}>Chọn phiếu xét nghiệm để xem kết quả chi tiết</Text>
          
          <View style={styles.labOrdersList}>
            {labOrders.map((order) => {
              const isSelected = selectedOrder?._id === order._id;
              const date = new Date(order.ordered_at);
              return (
                <TouchableOpacity
                  key={order._id}
                  style={[styles.orderItem, isSelected && styles.selectedOrderItem]}
                  onPress={() => setSelectedOrder(order)}
                >
                  <View style={styles.orderItemHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {order.category === 'HOA_SINH' ? (
                        <FlaskConical size={14} color={isSelected ? '#0891B2' : '#0284C7'} />
                      ) : (
                        <Droplets size={14} color={isSelected ? '#0891B2' : '#DC2626'} />
                      )}
                      <Text style={[styles.orderCategoryText, isSelected && styles.selectedOrderText]}>
                        {order.category === 'HOA_SINH' ? 'Hóa sinh máu' : 'Huyết học'}
                      </Text>
                    </View>
                    <View style={[styles.statusBadgeSmall, order.status === 'COMPLETED' ? styles.badgeSuccess : styles.badgePending]}>
                      <Text style={styles.badgeTextSmall}>
                        {order.status === 'COMPLETED' ? 'Đã trả KQ' : 'Chờ KQ'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.orderBarcodeText}>Mã vạch: {order.barcode}</Text>
                  <Text style={styles.orderDateText}>
                    Yêu cầu: {date.getHours()}:{date.getMinutes()} - {date.getDate()}/{date.getMonth() + 1}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {labOrders.length === 0 && (
              <Text style={styles.emptyText}>Chưa có chỉ định xét nghiệm nào.</Text>
            )}
          </View>

          {/* Bác sĩ/Admin có quyền chỉ định xét nghiệm mới */}
          {currentUser?.role !== 'patient' && (
            <View style={styles.createOrderActions}>
              <Text style={styles.actionSectionTitle}>Yêu cầu xét nghiệm mới</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.actionBtnOutline, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderColor: '#0891B2' }]}
                  onPress={() => handleCreateLabOrder('HOA_SINH')}
                >
                  <FlaskConical size={14} color="#0891B2" />
                  <Text style={[styles.actionBtnOutlineText, { color: '#0891B2' }]}>Hóa Sinh</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionBtnOutline, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderColor: '#DC2626' }]}
                  onPress={() => handleCreateLabOrder('HUYET_HOC')}
                >
                  <Droplets size={14} color="#DC2626" />
                  <Text style={[styles.actionBtnOutlineText, { color: '#DC2626' }]}>Huyết Học</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Cột phải: Chi tiết phiếu kết quả & LIS Simulator */}
      <View style={isDesktop ? styles.mainCol : styles.fullWidth}>
        {selectedOrder ? (
          <View>
            {/* Bảng kết quả xét nghiệm chuẩn Y tế */}
            <View style={styles.labReportSheet}>
              {/* Tiêu đề biểu mẫu */}
              <View style={styles.reportHeader}>
                <View style={styles.reportHeaderLeft}>
                  <Text style={styles.hospitalName}>SỞ Y TẾ HÀ NỘI</Text>
                  <Text style={styles.hospitalSub}>BỆNH VIỆN ĐA KHOA NEUROSCAN AI</Text>
                </View>
                <View style={styles.reportHeaderRight}>
                  <Text style={styles.departmentName}>KHOA XÉT NGHIỆM CHI NHÁNH 1</Text>
                  <Text style={styles.barcodeLabel}>Barcode: {selectedOrder.barcode}</Text>
                </View>
              </View>

              <Text style={styles.reportTitle}>PHIẾU KẾT QUẢ XÉT NGHIỆM</Text>
              <Text style={styles.reportSubtitle}>
                Chuyên khoa: {selectedOrder.category === 'HOA_SINH' ? 'Hóa sinh máu' : 'Huyết học tế bào'}
              </Text>

              {/* Thông tin hành chính bệnh nhân trên phiếu */}
              <View style={styles.reportDemographics}>
                <View style={styles.demoRow}>
                  <Text style={styles.demoLabel}>Họ tên bệnh nhân:</Text>
                  <Text style={styles.demoVal}>{patient?.profile?.name || 'N/A'}</Text>
                  
                  <Text style={styles.demoLabel}>Giới tính:</Text>
                  <Text style={styles.demoVal}>{selectedOrder.patient_gender}</Text>
                </View>
                <View style={styles.demoRow}>
                  <Text style={styles.demoLabel}>Số điện thoại:</Text>
                  <Text style={styles.demoVal}>{patient?.phone || 'Chưa cập nhật'}</Text>

                  <Text style={styles.demoLabel}>Thời gian chỉ định:</Text>
                  <Text style={styles.demoVal}>
                    {new Date(selectedOrder.ordered_at).toLocaleString('vi-VN')}
                  </Text>
                </View>
                {selectedOrder.resulted_at && (
                  <View style={styles.demoRow}>
                    <Text style={styles.demoLabel}>Thời gian trả kết quả:</Text>
                    <Text style={[styles.demoVal, { color: Colors.success, fontWeight: 'bold' }]}>
                      {new Date(selectedOrder.resulted_at).toLocaleString('vi-VN')}
                    </Text>
                  </View>
                )}
              </View>

              {selectedOrder.status === 'COMPLETED' && !isEditingLab && currentUser?.role !== 'patient' && (
                <TouchableOpacity
                  style={[styles.editLabResultsBtn, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#ECFEFF', borderWidth: 1, borderColor: '#0891B2' }]}
                  onPress={() => setIsEditingLab(true)}
                >
                  <Edit2 size={14} color="#0891B2" />
                  <Text style={[styles.editLabResultsBtnText, { color: '#0891B2' }]}>Chỉnh sửa kết quả xét nghiệm</Text>
                </TouchableOpacity>
              )}

              {/* Bảng kết quả chi tiết */}
              {selectedOrder.status === 'COMPLETED' && !isEditingLab ? (
                <View style={styles.tableContainer}>
                  <View style={styles.tableRowHeader}>
                    <Text style={[styles.colHeader, { flex: 2.2 }]}>Tên chỉ số xét nghiệm</Text>
                    <Text style={[styles.colHeader, { flex: 1.2 }]}>Trị số kết quả</Text>
                    <Text style={[styles.colHeader, { flex: 0.8 }]}>Đơn vị</Text>
                    <Text style={[styles.colHeader, { flex: 1.8 }]}>Khoảng tham chiếu</Text>
                    <Text style={[styles.colHeader, { flex: 0.8, textAlign: 'center' }]}>Cảnh báo</Text>
                  </View>
                  
                  {selectedOrder.results.map((res, index) => {
                    const direction = getAbnormalDirection(res);
                    return (
                      <View
                        key={index}
                        style={[
                          styles.tableRow,
                          res.is_abnormal && styles.tableRowAbnormal,
                          index === selectedOrder.results.length - 1 && styles.lastTableRow
                        ]}
                      >
                        <Text style={[styles.colCell, { flex: 2.2 }, res.is_abnormal && styles.textAbnormalBold]}>
                          {res.biomarker_name} ({res.biomarker_code})
                        </Text>
                        <Text style={[styles.colCell, { flex: 1.2 }, res.is_abnormal && styles.textAbnormalBold]}>
                          {res.value_result}
                        </Text>
                        <Text style={[styles.colCell, { flex: 0.8 }, res.is_abnormal && styles.textAbnormalBold]}>
                          {res.unit}
                        </Text>
                        <Text style={[styles.colCell, { flex: 1.8 }, styles.textMuted]}>
                          {res.reference_range_display || '—'}
                        </Text>
                        <View style={[styles.colCell, { flex: 0.8, alignItems: 'center', justifyContent: 'center' }]}>
                          {res.is_abnormal && (
                            <View style={styles.alertIndicator}>
                              <Text style={styles.alertIndicatorText}>{direction}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : currentUser?.role !== 'patient' ? (
                renderManualLabForm()
              ) : (
                <View style={styles.pendingReportBox}>
                  <ActivityIndicator size="small" color={Colors.primary} style={{ marginBottom: 12 }} />
                  <Text style={styles.pendingReportText}>Đang chờ kết quả từ phòng xét nghiệm LIS...</Text>
                  <Text style={styles.pendingReportSubText}>
                    Hệ thống sẽ tự động cập nhật ngay khi phòng xét nghiệm trả kết quả.
                  </Text>
                </View>
              )}

              <View style={styles.signatureRow}>
                <Text style={styles.signatureTitle}>TRƯỞNG KHOA XÉT NGHIỆM</Text>
                <Text style={styles.signatureSigned}>Đã phê duyệt điện tử</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.noOrderSelectedCard}>
            <Text style={styles.noOrderSelectedText}>Chọn phiếu xét nghiệm ở menu bên trái để xem báo cáo chi tiết.</Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default LabOrdersTab;
