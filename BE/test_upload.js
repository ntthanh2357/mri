Tài khoản dịch vụ của bạn(drive - managerneuro@neuroscan - saas.iam.gserviceaccount.com) là tài khoản do Google tự động tạo cho Backend để kết nối API.Các tài khoản dịch vụ này mặc định có dung lượng bộ nhớ bằng 0(0 bytes quota).

Khi bạn lưu file vào một thư mục thường trên Drive cá nhân(My Drive), file tải lên sẽ được tính dung lượng vào tài khoản tải(ở đây là Service Account).Do Service Account có dung lượng bằng 0, Google Drive sẽ chặn và trả về lỗi: import { google } from "googleapis";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { Readable } from "stream";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const KEY_FILE_PATH = path.resolve(__dirname, "./credentials.json");
const PARENT_FOLDER_ID = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_FILE_PATH,
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const drive = google.drive({ version: "v3", auth });

const bufferToStream = (buffer) => {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
};

async function testUpload() {
  try {
    const fileMetadata = {
      name: "test_quota.txt",
      parents: [PARENT_FOLDER_ID],
    };
    const media = {
      mimeType: "text/plain",
      body: bufferToStream(Buffer.from("Hello world")),
    };
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id",
    });
    console.log("SUCCESS! File ID:", response.data.id);
  } catch (err) {
    console.error("FAILED UPLOAD:", err.message);
  }
}

testUpload();
