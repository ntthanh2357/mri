import { Invoice } from "../models/invoice.model.js";
import { Visit } from "../models/visit.model.js";
import { Hospital } from "../models/hospital.model.js";
import { MedicalRecord } from "../models/medicalRecord.model.js";
import { EMRVersion } from "../models/emrVersion.model.js";
import payos from "../utils/payos.js";
import { PremiumOrder } from "../models/premiumOrder.model.js";
import { User } from "../models/user.model.js";

// @desc    Lễ tân tạo hóa đơn và thanh toán
// @route   POST /api/v1/invoices/visit/:visitId
// @access  Private (Receptionist, Admin)
export const createAndPayInvoice = async (req, res) => {
  try {
    const { visitId } = req.params;
    const { paymentMethod } = req.body;

    const visit = await Visit.findById(visitId);
    if (!visit) return res.status(404).json({ message: "Không tìm thấy lượt khám" });

    if (visit.hospitalId.toString() !== req.user.hospitalId) {
      return res.status(403).json({ message: "Không có quyền" });
    }

    const hospital = await Hospital.findById(req.user.hospitalId);

    // Xây dựng items
    let items = [{ description: "Khám bệnh", amount: hospital.pricing.examFee, type: "exam" }];
    if (visit.mriOrder && visit.mriOrder.orderedAt) {
      items.push({ description: "Chụp MRI", amount: hospital.pricing.mriFee, type: "mri" });
      if (visit.mriOrder.requestAiAnalysis) {
        items.push({ description: "Phân tích AI chẩn đoán", amount: hospital.pricing.aiFee, type: "ai" });
      }
    }

    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

    // Map payment method to database enum (tiền mặt / chuyển khoản)
    let mappedMethod = "tiền mặt";
    if (paymentMethod === "transfer" || paymentMethod === "chuyển khoản") {
      mappedMethod = "chuyển khoản";
    }

    const invoice = new Invoice({
      hospitalId: req.user.hospitalId,
      patientId: visit.patientId,
      visitId,
      items,
      totalAmount,
      status: "đã thanh toán",
      paymentMethod: mappedMethod,
      paidAt: new Date()
    });

    await invoice.save();

    visit.invoiceId = invoice._id;
    visit.status = "đã đóng";
    await visit.save();

    res.status(201).json({ message: "Thanh toán thành công", invoice });
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

// @desc    Lấy danh sách hóa đơn
// @route   GET /api/v1/invoices
// @access  Private (Receptionist, Admin)
export const getInvoices = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    if (!hospitalId) {
      return res.status(403).json({ message: "Bạn chưa được gán vào bệnh viện nào." });
    }

    const { status } = req.query;
    let filter = { hospitalId };
    if (status) {
      filter.status = status;
    }

    const invoices = await Invoice.find(filter)
      .populate("patientId", "email profile")
      .populate("visitId", "reason status")
      .sort({ createdAt: -1 });

    res.status(200).json({ invoices });
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

// @desc    Receptionist thanh toán hóa đơn chờ thanh toán
// @route   PUT /api/v1/invoices/:id/pay
// @access  Private (Receptionist, Admin)
export const payInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod } = req.body;

    const invoice = await Invoice.findById(id);
    if (!invoice) return res.status(404).json({ message: "Không tìm thấy hóa đơn" });

    if (invoice.hospitalId.toString() !== req.user.hospitalId) {
      return res.status(403).json({ message: "Không có quyền thao tác" });
    }

    invoice.status = "đã thanh toán";
    
    // Map payment method to database enum (tiền mặt / chuyển khoản)
    let mappedMethod = "tiền mặt";
    if (paymentMethod === "transfer" || paymentMethod === "chuyển khoản") {
      mappedMethod = "chuyển khoản";
    }
    invoice.paymentMethod = mappedMethod;
    
    invoice.paidAt = new Date();
    await invoice.save();

    // Cập nhật trạng thái lượt khám
    const visit = await Visit.findById(invoice.visitId);
    if (visit) {
      visit.status = "đã đóng";
      await visit.save();
    }

    // ── Ghi nhận Lịch sử sửa đổi bệnh án (Audit Trail / EMR Version) ──
    try {
      const patientUser = await User.findById(invoice.patientId);
      if (patientUser) {
        const medicalId = patientUser.profile?.medicalId;
        const patientName = patientUser.profile?.name || patientUser.profile?.fullName;
        
        let query = {};
        if (medicalId) {
          query = { $or: [{ patientId: medicalId }, { patientId: invoice.patientId.toString() }] };
        } else {
          query = { patientId: invoice.patientId.toString() };
        }
        
        let medicalRecord = await MedicalRecord.findOne(query);
        if (!medicalRecord && patientName) {
          medicalRecord = await MedicalRecord.findOne({ patientName });
        }

        if (medicalRecord) {
          const nextVersion = (medicalRecord.currentVersion || 1) + 1;
          
          const changes = {
            paymentStatus: {
              old: "Chờ thanh toán",
              new: `Đã xác nhận thanh toán thành công cho bệnh nhân (Mã HS: ${medicalId || 'N/A'}, ID: ${invoice.patientId}) bởi Điều dưỡng / Lễ tân (ID: ${req.user.id})`
            }
          };

          const emrVersion = new EMRVersion({
            medicalRecordId: medicalRecord._id,
            version: medicalRecord.currentVersion || 1,
            modifiedBy: `${req.user?.profile?.name || req.user?.email || "Điều dưỡng / Lễ tân"} (ID: ${req.user?.id})`,
            changes,
          });
          
          await emrVersion.save();
          medicalRecord.currentVersion = nextVersion;
          await medicalRecord.save();
          console.log(`[Audit Log] Created EMRVersion v${nextVersion - 1} for payment confirmation by ${req.user?.id}.`);
        }
      }
    } catch (auditError) {
      // Log audit error but don't fail the payment request
      console.error("Lỗi ghi nhận lịch sử sửa đổi bệnh án khi thanh toán:", auditError);
    }

    res.status(200).json({ message: "Thanh toán hóa đơn thành công", invoice });
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};
// @desc    Điều dưỡng tạo hóa đơn chờ thanh toán (từ phiếu thu viện phí)
// @route   POST /api/v1/invoices/pending
// @access  Private (Nurse, Admin)
export const createPendingInvoice = async (req, res) => {
  try {
    const { patientId, visitId, items, totalAmount, notes } = req.body;

    if (!patientId || !items || !totalAmount) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc." });
    }

    // Build items array from nurse's service selections
    const invoiceItems = (items || []).map(item => ({
      description: item.description || item.name,
      amount: Number(item.amount) || 0,
      type: 'other'
    }));

    const invoice = new Invoice({
      hospitalId: req.user.hospitalId,
      patientId,
      visitId: visitId || null,
      items: invoiceItems,
      totalAmount: Number(totalAmount),
      status: 'chờ thanh toán',
      paymentMethod: '',
      paidAt: null
    });

    await invoice.save();

    const populated = await Invoice.findById(invoice._id)
      .populate('patientId', 'email profile')
      .populate('visitId', 'reason status');

    res.status(201).json({ message: "Đã tạo hóa đơn chờ thanh toán.", invoice: populated });
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

// @desc    Tạo link thanh toán PayOS cho lượt khám
// @route   POST /api/v1/invoices/visit/:visitId/payos
// @access  Private
export const createPayOSPayment = async (req, res) => {
  try {
    const { visitId } = req.params; // Có thể là invoiceId hoặc visitId

    let invoice = null;
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(visitId);

    if (isValidObjectId) {
      // 1. Tìm theo invoiceId trước
      invoice = await Invoice.findOne({ _id: visitId, status: "chờ thanh toán" });
      // 2. Nếu không thấy, tìm theo visitId
      if (!invoice) {
        invoice = await Invoice.findOne({ visitId, status: "chờ thanh toán" });
      }
    }

    if (!invoice) return res.status(404).json({ message: "Không tìm thấy hóa đơn ở trạng thái chờ thanh toán" });

    // Kiểm tra quyền (phải là lễ tân, admin, điều dưỡng hoặc chính bệnh nhân)
    const isPatient = invoice.patientId.toString() === req.user.id.toString();
    const isClinicStaff = req.user.hospitalId && invoice.hospitalId.toString() === req.user.hospitalId.toString();

    if (!isPatient && !isClinicStaff) {
      return res.status(403).json({ message: "Bạn không có quyền thanh toán cho hóa đơn này" });
    }

    // Tạo mã orderCode duy nhất dạng số nguyên cho PayOS (9 chữ số cuối của timestamp + số ngẫu nhiên)
    const orderCode = Number(String(Date.now()).slice(-9)) + Math.floor(Math.random() * 1000);
    invoice.orderCode = orderCode;
    invoice.paymentMethod = "vietqr";
    await invoice.save();

    // Chuẩn bị dữ liệu gửi lên PayOS
    const hostname = req.get("host");
    const protocol = req.protocol;
    // URL dẫn đến endpoint GET của backend để hiển thị trang success/cancel đẹp mắt
    const returnUrl = `${protocol}://${hostname}/api/v1/invoices/payment/success?invoiceId=${invoice._id}`;
    const cancelUrl = `${protocol}://${hostname}/api/v1/invoices/payment/cancel?invoiceId=${invoice._id}`;

    const paymentBody = {
      orderCode,
      amount: invoice.totalAmount,
      description: `Thanh toan HD ${orderCode}`,
      items: invoice.items.map(item => ({
        name: item.description,
        quantity: 1,
        price: item.amount
      })),
      returnUrl,
      cancelUrl
    };

    const paymentLinkData = await payos.paymentRequests.create(paymentBody);

    res.status(200).json({
      message: "Tạo link thanh toán thành công",
      checkoutUrl: paymentLinkData.checkoutUrl,
      orderCode,
      invoice
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi tạo link thanh toán PayOS", error: error.message });
  }
};

// @desc    Webhook tiếp nhận kết quả thanh toán từ PayOS
// @route   POST /api/v1/invoices/payos-webhook
// @access  Public
export const handlePayOSWebhook = async (req, res) => {
  try {
    const webhookData = req.body;

    // Xác thực chữ ký dữ liệu từ PayOS để chống giả mạo
    const verifiedData = payos.webhooks.verify(webhookData);

    if (verifiedData.code === "00") {
      const orderCode = verifiedData.orderCode;

      // 1. Kiểm tra xem có phải là hóa đơn lượt khám
      const invoice = await Invoice.findOne({ orderCode });
      if (invoice) {
        if (invoice.status !== "đã thanh toán") {
          invoice.status = "đã thanh toán";
          invoice.paidAt = new Date();
          await invoice.save();

          // Cập nhật trạng thái lượt khám liên quan
          const visit = await Visit.findById(invoice.visitId);
          if (visit) {
            visit.invoiceId = invoice._id;
            visit.status = "đã đóng";
            await visit.save();
          }
          console.log(`[PayOS Webhook] Thanh toán thành công cho hóa đơn: ${invoice._id}, orderCode: ${orderCode}`);
        }
      } else {
        // 2. Nếu không phải hóa đơn lượt khám, kiểm tra đơn hàng Premium
        const premiumOrder = await PremiumOrder.findOne({ orderCode });
        if (premiumOrder && premiumOrder.status !== "completed") {
          premiumOrder.status = "completed";
          premiumOrder.paidAt = new Date();
          await premiumOrder.save();

          // Cập nhật trạng thái Premium của User
          const user = await User.findById(premiumOrder.userId);
          if (user) {
            user.isPremium = true;

            // Premium có giá trị trong 1 phút (Gói test 2000đ)
            const oneMinFromNow = new Date(Date.now() + 60 * 1000);
            user.premiumUntil = oneMinFromNow;
            user.autoRenew = true; // Bật tự động gia hạn khi đăng ký mới

            await user.save();
            console.log(`[PayOS Webhook] Nâng cấp Premium thành công cho User: ${user.email}, orderCode: ${orderCode}`);
          }
        }
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[PayOS Webhook Error]", error.message);
    res.status(400).json({ message: "Lỗi xác thực webhook", error: error.message });
  }
};

// @desc    Tạo link thanh toán PayOS để nâng cấp Premium
// @route   POST /api/v1/invoices/premium-payment
// @access  Private
export const createPremiumPayment = async (req, res) => {
  try {
    const userId = req.user.id; // Lấy từ auth middleware

    // Kiểm tra xem người dùng đã là Premium chưa
    const user = await User.findById(userId);
    if (user && user.isPremium) {
      return res.status(400).json({ message: "Tài khoản của bạn đã là Premium" });
    }

    const amount = 2000; // Gói test 2000 VNĐ

    // Tạo mã orderCode duy nhất dạng số nguyên cho PayOS (9 chữ số cuối của timestamp + số ngẫu nhiên)
    const orderCode = Number(String(Date.now()).slice(-9)) + Math.floor(Math.random() * 1000);

    // Lưu thông tin đơn hàng Premium
    const premiumOrder = new PremiumOrder({
      userId,
      amount,
      orderCode,
      status: "pending"
    });
    await premiumOrder.save();

    // Chuẩn bị dữ liệu gửi lên PayOS
    const hostname = req.get("host");
    const protocol = req.protocol;

    // Sử dụng trang thông báo thành công đẹp mắt có sẵn (kèm orderCode để kích hoạt offline nếu dev cục bộ)
    const returnUrl = `${protocol}://${hostname}/api/v1/invoices/payment/success?orderCode=${orderCode}`;
    const cancelUrl = `${protocol}://${hostname}/api/v1/invoices/payment/cancel?orderCode=${orderCode}`;

    const paymentBody = {
      orderCode,
      amount,
      description: "Nang cap Premium",
      items: [
        {
          name: "Gói Hội viên Premium (1 Năm)",
          quantity: 1,
          price: amount
        }
      ],
      returnUrl,
      cancelUrl
    };

    const paymentLinkData = await payos.paymentRequests.create(paymentBody);

    res.status(200).json({
      message: "Tạo link thanh toán Premium thành công",
      checkoutUrl: paymentLinkData.checkoutUrl,
      orderCode,
      premiumOrder
    });
  } catch (error) {
    console.error("[Create Premium Payment Error]", error);
    res.status(500).json({ message: "Lỗi tạo link thanh toán Premium", error: error.message });
  }
};

// @desc    Trang HTML hiển thị thanh toán thành công
// @route   GET /api/v1/invoices/payment/success
// @access  Public
export const paymentSuccess = async (req, res) => {
  try {
    const { orderCode, invoiceId } = req.query;

    if (orderCode) {
      // 1. Kiểm tra và kích hoạt đơn hàng Premium
      const premiumOrder = await PremiumOrder.findOne({ orderCode });
      if (premiumOrder && premiumOrder.status !== "completed") {
        premiumOrder.status = "completed";
        premiumOrder.paidAt = new Date();
        await premiumOrder.save();

        const user = await User.findById(premiumOrder.userId);
        if (user) {
          user.isPremium = true;
          const oneMinFromNow = new Date(Date.now() + 60 * 1000);
          user.premiumUntil = oneMinFromNow;
          user.autoRenew = true; // Bật tự động gia hạn khi đăng ký mới
          await user.save();
          console.log(`[Local Direct Activation] Activated Premium for User: ${user.email}, orderCode: ${orderCode}`);
        }
      }

      // 2. Kiểm tra và xác nhận hóa đơn lượt khám
      const invoice = await Invoice.findOne({ orderCode });
      if (invoice && invoice.status !== "đã thanh toán") {
        invoice.status = "đã thanh toán";
        invoice.paidAt = new Date();
        await invoice.save();

        const visit = await Visit.findById(invoice.visitId);
        if (visit) {
          visit.invoiceId = invoice._id;
          visit.status = "đã đóng";
          await visit.save();
        }
        console.log(`[Local Direct Activation] Paid invoice: ${invoice._id}, orderCode: ${orderCode}`);
      }
    } else if (invoiceId) {
      // Xác nhận trực tiếp bằng invoiceId
      const invoice = await Invoice.findById(invoiceId);
      if (invoice && invoice.status !== "đã thanh toán") {
        invoice.status = "đã thanh toán";
        invoice.paidAt = new Date();
        await invoice.save();

        const visit = await Visit.findById(invoice.invoiceId || invoice.visitId);
        if (visit) {
          visit.invoiceId = invoice._id;
          visit.status = "đã đóng";
          await visit.save();
        }
        console.log(`[Local Direct Activation] Paid invoice via invoiceId: ${invoice._id}`);
      }
    }
  } catch (error) {
    console.error("Lỗi cập nhật trực tiếp tại paymentSuccess:", error);
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thanh toán thành công - NeuroScan AI</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
        <style>
            body {
                font-family: 'Outfit', sans-serif;
                background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
                color: #f8fafc;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                padding: 20px;
                box-sizing: border-box;
            }
            .card {
                background: rgba(30, 41, 59, 0.7);
                backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 24px;
                padding: 40px;
                text-align: center;
                max-width: 480px;
                width: 100%;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                animation: fadeIn 0.6s ease-out;
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .icon-container {
                width: 80px;
                height: 80px;
                background: rgba(16, 185, 129, 0.1);
                border: 2px solid #10b981;
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                margin: 0 auto 24px;
                animation: scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.3s both;
            }
            @keyframes scaleIn {
                from { transform: scale(0); }
                to { transform: scale(1); }
            }
            .icon-container svg {
                width: 40px;
                height: 40px;
                stroke: #10b981;
            }
            h1 {
                font-size: 28px;
                font-weight: 800;
                margin: 0 0 12px;
                background: linear-gradient(to right, #34d399, #059669);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            p {
                color: #94a3b8;
                font-size: 16px;
                line-height: 1.6;
                margin: 0 0 32px;
            }
            .btn {
                display: inline-block;
                background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                color: white;
                text-decoration: none;
                padding: 14px 32px;
                border-radius: 12px;
                font-weight: 600;
                font-size: 16px;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                border: none;
                cursor: pointer;
                width: 100%;
                box-sizing: border-box;
            }
            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
                background: linear-gradient(135deg, #60a5fa 0%, #2563eb 100%);
            }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon-container">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
            </div>
            <h1>Thanh toán thành công</h1>
            <p>Giao dịch của bạn đã được xử lý an toàn thông qua PayOS. Hồ sơ bệnh án và lịch chụp MRI đã sẵn sàng để tiếp tục.</p>
            <button class="btn" onclick="window.location.href='http://localhost:8081'">Quay lại ứng dụng</button>
        </div>
    </body>
    </html>
  `);
};

// @desc    Trang HTML hiển thị thanh toán bị hủy
// @route   GET /api/v1/invoices/payment/cancel
// @access  Public
export const paymentCancel = async (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thanh toán bị hủy - NeuroScan AI</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
        <style>
            body {
                font-family: 'Outfit', sans-serif;
                background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
                color: #f8fafc;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                padding: 20px;
                box-sizing: border-box;
            }
            .card {
                background: rgba(30, 41, 59, 0.7);
                backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 24px;
                padding: 40px;
                text-align: center;
                max-width: 480px;
                width: 100%;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                animation: fadeIn 0.6s ease-out;
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .icon-container {
                width: 80px;
                height: 80px;
                background: rgba(239, 68, 68, 0.1);
                border: 2px solid #ef4444;
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                margin: 0 auto 24px;
                animation: scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.3s both;
            }
            @keyframes scaleIn {
                from { transform: scale(0); }
                to { transform: scale(1); }
            }
            .icon-container svg {
                width: 40px;
                height: 40px;
                stroke: #ef4444;
            }
            h1 {
                font-size: 28px;
                font-weight: 800;
                margin: 0 0 12px;
                background: linear-gradient(to right, #f87171, #dc2626);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            p {
                color: #94a3b8;
                font-size: 16px;
                line-height: 1.6;
                margin: 0 0 32px;
            }
            .btn {
                display: inline-block;
                background: linear-gradient(135deg, #475569 0%, #1e293b 100%);
                color: white;
                text-decoration: none;
                padding: 14px 32px;
                border-radius: 12px;
                font-weight: 600;
                font-size: 16px;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(71, 85, 105, 0.3);
                border: none;
                cursor: pointer;
                width: 100%;
                box-sizing: border-box;
            }
            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(71, 85, 105, 0.4);
                background: linear-gradient(135deg, #64748b 0%, #334155 100%);
            }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon-container">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </div>
            <h1>Giao dịch bị hủy</h1>
            <p>Yêu cầu thanh toán của bạn đã bị hủy. Vui lòng thử lại nếu bạn muốn hoàn thành thanh toán dịch vụ.</p>
            <button class="btn" onclick="window.location.href='http://localhost:8081'">Quay lại ứng dụng</button>
        </div>
    </body>
    </html>
  `);
};

