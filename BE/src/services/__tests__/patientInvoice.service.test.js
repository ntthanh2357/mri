import mongoose from 'mongoose';
import { toPatientInvoice, listPatientInvoices } from '../patientInvoice.service.js';
import { Invoice } from '../../models/invoice.model.js';
import { Hospital } from '../../models/hospital.model.js';
import { Visit } from '../../models/visit.model.js';

const day = (n) => new Date(Date.UTC(2026, 9, 15) - n * 24 * 3600 * 1000);

describe('Bệnh nhân xem hóa đơn viện phí của mình', () => {
  const BHYT_INVOICE = {
    _id: new mongoose.Types.ObjectId(),
    createdAt: day(1),
    status: 'chờ thanh toán',
    totalAmount: 2_500_000,
    patientPayAmount: null,
    items: [
      { description: 'Khám chuyên khoa Thần kinh', type: 'exam', amount: 200_000, quantity: 1, unitPrice: 200_000, insuranceCoverage: { isCovered: true, coverageRate: 80, insuranceAmount: 160_000, patientCopayAmount: 40_000 } },
      { description: 'Chụp MRI sọ não có tiêm thuốc', type: 'mri', amount: 2_300_000, quantity: 1, unitPrice: 2_300_000, batchNumber: 'LO-INTERNAL', insuranceCoverage: { isCovered: true, coverageRate: 80, insuranceAmount: 1_840_000, patientCopayAmount: 460_000 } },
    ],
    bhytInfo: { cardNumber: 'DN4797912345678', coverageRate: 80, bhytAmount: 2_000_000, patientCopayAmount: 500_000, annualCap: 72_000_000 },
    amlCheck: { isFlagged: true, reason: 'bí mật nội bộ' },
    refundApproval: { firstApproverId: new mongoose.Types.ObjectId() },
    clinicalTrialProtocol: { sponsorName: 'Nhà tài trợ bí mật' },
    paymentNotes: 'ghi chú nội bộ của thu ngân',
    orderCode: 123456,
  };

  it('tách rõ tổng chi phí, BHYT chi trả, phần bệnh nhân trả; số thẻ chỉ hiện 4 số cuối', () => {
    const v = toPatientInvoice(BHYT_INVOICE);
    expect(v.totalAmount).toBe(2_500_000);
    expect(v.insuranceAmount).toBe(2_000_000);
    expect(v.patientAmount).toBe(500_000);
    expect(v.bhyt).toEqual({ coverageRate: 80, cardLast4: '5678' });
    expect(v.items.length).toBe(2);
    expect(v.items[1]).toEqual({ description: 'Chụp MRI sọ não có tiêm thuốc', type: 'mri', quantity: 1, unit: '', unitPrice: 2_300_000, amount: 2_300_000, covered: true, insuranceAmount: 1_840_000, patientAmount: 460_000 });
    const json = JSON.stringify(v);
    for (const secret of ['DN4797912345678', 'bí mật nội bộ', 'Nhà tài trợ bí mật', 'ghi chú nội bộ', 'LO-INTERNAL', '123456', 'firstApproverId', 'annualCap']) expect(json.includes(secret)).toBe(false);
  });

  it('không có BHYT: bệnh nhân trả toàn bộ; ưu tiên số tiền thực trả đã ghi nhận; hoàn tiền ghi rõ', () => {
    const plain = toPatientInvoice({ _id: 'i2', status: 'đã thanh toán', totalAmount: 300_000, paidAt: day(2), paymentMethod: 'vietqr', items: [{ description: 'Khám', amount: 300_000 }] });
    expect(plain.insuranceAmount).toBe(0);
    expect(plain.patientAmount).toBe(300_000);
    expect(plain.bhyt).toBe(null);
    expect(plain.paymentMethod).toBe('vietqr');
    const recorded = toPatientInvoice({ _id: 'i3', status: 'đã thanh toán', totalAmount: 1_000_000, patientPayAmount: 200_000, bhytInfo: { bhytAmount: 800_000, coverageRate: 80 }, items: [] });
    expect(recorded.patientAmount).toBe(200_000);
    const refunded = toPatientInvoice({ _id: 'i4', status: 'hoàn trả', totalAmount: 500_000, refundAmount: 500_000, refundReason: 'Hủy chỉ định chụp do chống chỉ định', refundedAt: day(1), items: [] });
    expect(refunded.refund).toEqual({ amount: 500_000, reason: 'Hủy chỉ định chụp do chống chỉ định', at: day(1) });
    // BHYT theo từng dòng khi hóa đơn chưa có tổng BHYT
    const perLine = toPatientInvoice({ _id: 'i5', status: 'chờ thanh toán', totalAmount: 200_000, items: [BHYT_INVOICE.items[0]] });
    expect(perLine.insuranceAmount).toBe(160_000);
    expect(perLine.patientAmount).toBe(40_000);
  });

  describe('danh sách', () => {
    const me = new mongoose.Types.ObjectId('6f0000000000000000000d01');
    const other = new mongoose.Types.ObjectId('6f0000000000000000000d02');
    const hospitalId = new mongoose.Types.ObjectId('6f0000000000000000000d0a');
    const visitId = new mongoose.Types.ObjectId('6f0000000000000000000d0b');
    const cleanup = async () => {
      await Invoice.collection.deleteMany({ patientId: { $in: [me, other] } });
      await Hospital.collection.deleteMany({ _id: hospitalId });
      await Visit.collection.deleteMany({ _id: visitId });
    };
    beforeAll(async () => {
      const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/neuroscan_test_logic';
      if (mongoose.connection.readyState === 0) await mongoose.connect(mongoUri);
      await cleanup();
      await Hospital.collection.insertOne({ _id: hospitalId, name: 'Bệnh viện Thử Nghiệm' });
      await Visit.collection.insertOne({ _id: visitId, hospitalId, patientId: me, reason: 'Đau đầu kéo dài', createdAt: day(3) });
      await Invoice.collection.insertMany([
        { hospitalId, patientId: me, visitId, status: 'đã thanh toán', totalAmount: 300_000, items: [], createdAt: day(3) },
        { hospitalId, patientId: me, status: 'chờ thanh toán', totalAmount: 500_000, items: [], createdAt: day(1) },
        { hospitalId, patientId: other, status: 'chờ thanh toán', totalAmount: 999_000, items: [], createdAt: day(0) },
      ]);
    });
    afterAll(cleanup);

    it('chỉ hóa đơn của chính mình, mới nhất trước, kèm tên bệnh viện và lý do khám; đếm số tiền còn phải trả', async () => {
      const { invoices, unpaidTotal } = await listPatientInvoices(me);
      expect(invoices.map((i) => i.totalAmount)).toEqual([500_000, 300_000]);
      expect(invoices[1].hospitalName).toBe('Bệnh viện Thử Nghiệm');
      expect(invoices[1].visitReason).toBe('Đau đầu kéo dài');
      expect(unpaidTotal).toBe(500_000);
      expect(JSON.stringify(invoices).includes('999000')).toBe(false);
      expect((await listPatientInvoices(new mongoose.Types.ObjectId())).invoices.length).toBe(0);
    });

    it('giới hạn số hóa đơn trả về (mặc định 50)', async () => {
      expect((await listPatientInvoices(me, { limit: 1 })).invoices.length).toBe(1);
      expect((await listPatientInvoices(me, { limit: 'abc' })).invoices.length).toBe(2);
    });
  });
});
