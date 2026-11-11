import crypto from "crypto";

/**
 * Metadata ký báo cáo CĐHA — dùng chung cho PUT /imaging/:id và POST /clinical-view/imaging/:id/sign.
 * Hệ thống chỉ có mã băm toàn vẹn nội bộ (SHA-256), KHÔNG phải chữ ký PKI/CA. Trước đây ký qua clinical-view
 * không ghi signedHash nên báo cáo ký theo đường đó không phát hiện được bị sửa sau ký.
 */
export const buildImagingSignatureMetadata = ({ imagingId, medicalId, patientName, findings, conclusion, signedAt, signerId, signerName }) => {
  const payload = `${imagingId}|${medicalId}|${patientName}|${findings}|${conclusion}|${new Date(signedAt).toISOString()}|${signerId}`;
  return {
    signatureType: "internal_hash",
    certificateSerial: null,
    signingAlgorithm: "SHA-256",
    timestampToken: null,
    caProvider: "NONE",
    signedHash: crypto.createHash("sha256").update(payload).digest("hex"),
    signedBy: signerName,
    signedAt: new Date(signedAt),
    isTampered: false,
  };
};
