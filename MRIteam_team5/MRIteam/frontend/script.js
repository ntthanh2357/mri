const API_URL = "http://127.0.0.1:8000/predict";

// DOM Elements
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const uploadContent = document.getElementById('upload-content');
const previewContainer = document.getElementById('preview-container');
const imagePreview = document.getElementById('image-preview');
const btnRemove = document.getElementById('btn-remove');
const btnAnalyze = document.getElementById('btn-analyze');

// Result Elements
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');
const resultContent = document.getElementById('result-content');
const predictedClass = document.getElementById('predicted-class');
const confidenceScore = document.getElementById('confidence-score');
const probBarsContainer = document.getElementById('prob-bars-container');
const yoloProbBarsContainer = document.getElementById('yolo-prob-bars-container');

// Consensus Elements
const resnetConsultResult = document.getElementById('resnet-consult-result');
const yoloConsultResult = document.getElementById('yolo-consult-result');
const geminiConsultBox = document.getElementById('gemini-consult-box');
const geminiConsultTitle = document.getElementById('gemini-consult-title');
const geminiConsultMessage = document.getElementById('gemini-consult-message');
const resultImgBox = document.getElementById('result-img-box');
const imageResult = document.getElementById('image-result');
const finalConfidenceBadge = document.getElementById('final-confidence-badge');

let selectedFile = null;

// Map for pretty naming and coloring
const tumorTypeConfig = {
    'glioma': { name: 'Khối u Glioma', colorClass: 'type-glioma' },
    'meningioma': { name: 'Khối u Meningioma', colorClass: 'type-meningioma' },
    'pituitary': { name: 'Khối u Pituitary', colorClass: 'type-pituitary' },
    'notumor': { name: 'Bình thường (Không có u)', colorClass: 'type-notumor' }
};

// Handle Drag and Drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
    }
});

// Handle Click to Upload
uploadArea.addEventListener('click', () => {
    if(!selectedFile) {
        fileInput.click();
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

// Remove File
btnRemove.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent triggering uploadArea click
    selectedFile = null;
    fileInput.value = "";
    
    // UI Reset
    previewContainer.classList.add('hidden');
    uploadContent.classList.remove('hidden');
    btnAnalyze.disabled = true;
    
    // Reset Result Panel
    resetResultPanel();
});

// Handle File Preview
function handleFileSelect(file) {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
        alert("Vui lòng tải lên định dạng ảnh hợp lệ (JPG, PNG).");
        return;
    }

    selectedFile = file;
    
    // Read and Preview
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        uploadContent.classList.add('hidden');
        previewContainer.classList.remove('hidden');
        btnAnalyze.disabled = false;
        
        // Reset old results
        imageResult.src = "";
        resultImgBox.classList.add('hidden');
        resetResultPanel();
    };
    reader.readAsDataURL(file);
}

// Reset Result Panel to Empty State
function resetResultPanel() {
    resultContent.classList.add('hidden');
    loadingState.classList.add('hidden');
    emptyState.classList.remove('hidden');
}

// Analyze Button Click
btnAnalyze.addEventListener('click', async () => {
    if (!selectedFile) return;

    // Show Loading State
    emptyState.classList.add('hidden');
    resultContent.classList.add('hidden');
    loadingState.classList.remove('hidden');
    
    // Disable button during process
    btnAnalyze.disabled = true;
    btnAnalyze.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Phân Tích...';

    // Prepare FormData
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Lỗi server: ${response.status}`);
        }

        const data = await response.json();
        
        if(data.error) {
            throw new Error(data.error);
        }

        displayResults(data);
        
        // Kích hoạt Agent 1 ngầm gửi Prompt sau khi ResNet chạy xong
        generateMedicalReport(data);

    } catch (error) {
        console.error("Lỗi:", error);
        alert("Đã xảy ra lỗi khi kết nối tới AI: " + error.message);
        resetResultPanel();
    } finally {
        // Reset button
        btnAnalyze.disabled = false;
        btnAnalyze.innerHTML = '<i class="fa-solid fa-microchip"></i> Phân Tích Hình Ảnh';
    }
});

// Display Results nicely
function displayResults(data) {
    // Hide loading, show results
    loadingState.classList.add('hidden');
    resultContent.classList.remove('hidden');

    const config = tumorTypeConfig[data.class_name] || { name: data.class_name, colorClass: '' };

    // Update the image with the annotated heatmap/box if available
    if (data.annotated_image) {
        imageResult.src = data.annotated_image;
        resultImgBox.classList.remove('hidden');
    } else {
        resultImgBox.classList.add('hidden');
    }

    // 1. ResNet Consult Result
    resnetConsultResult.textContent = `${config.name} (${data.confidence}%)`;

    // 2. YOLO Consult Result
    if (data.tumor_location && data.tumor_location.source === 'yolo' && data.tumor_location.yolo_class) {
        const yoloConf = (data.tumor_location.yolo_conf * 100).toFixed(1);
        const yoloNiceName = tumorTypeConfig[data.tumor_location.yolo_class.toLowerCase().replace(' ', '')]?.name || data.tumor_location.yolo_class;
        yoloConsultResult.textContent = `${yoloNiceName} (${yoloConf}%)`;
    } else {
        yoloConsultResult.textContent = `Không nhận diện được box`;
    }

    // 3. Gemini Consensus & Final Result
    if (data.consensus_message) {
        geminiConsultBox.classList.remove('hidden');
        geminiConsultMessage.innerHTML = data.consensus_message.replace(/\n/g, '<br>');
        
        if (data.is_conflict) {
            // Conflict
            geminiConsultBox.style.background = 'rgba(245, 158, 11, 0.1)';
            geminiConsultBox.style.borderLeftColor = 'var(--warning)';
            geminiConsultTitle.style.color = 'var(--warning)';
            geminiConsultTitle.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Cảnh báo phân kỳ dữ liệu';
            
            // Final Result
            predictedClass.textContent = "YÊU CẦU BÁC SĨ ĐÁNH GIÁ";
            predictedClass.style.color = "var(--warning)";
            finalConfidenceBadge.style.background = "rgba(245, 158, 11, 0.1)";
            finalConfidenceBadge.style.color = "var(--warning)";
            finalConfidenceBadge.innerHTML = '<i class="fa-solid fa-user-doctor"></i> Cần chuyên môn con người';
        } else {
            // Consensus
            geminiConsultBox.style.background = 'rgba(16, 185, 129, 0.1)';
            geminiConsultBox.style.borderLeftColor = 'var(--success)';
            geminiConsultTitle.style.color = 'var(--success)';
            geminiConsultTitle.innerHTML = '<i class="fa-solid fa-handshake"></i> Đồng thuận tuyệt đối';
            
            // Final Result
            predictedClass.textContent = config.name;
            finalConfidenceBadge.style.background = "rgba(16, 185, 129, 0.1)";
            finalConfidenceBadge.style.color = "var(--success)";
            finalConfidenceBadge.innerHTML = `<i class="fa-solid fa-bullseye"></i> Độ tin cậy: <span id="confidence-score">${data.confidence}%</span>`;
            
            if(data.class_name === 'notumor') {
                predictedClass.style.color = 'var(--success)';
            } else {
                predictedClass.style.color = 'var(--danger)';
            }
        }
    } else {
        geminiConsultBox.classList.add('hidden');
        // Fallback final result
        predictedClass.textContent = config.name;
        finalConfidenceBadge.innerHTML = `<i class="fa-solid fa-bullseye"></i> Độ tin cậy: <span id="confidence-score">${data.confidence}%</span>`;
        if(data.class_name === 'notumor') {
            predictedClass.style.color = 'var(--success)';
        } else {
            predictedClass.style.color = 'var(--danger)';
        }
    }

    // Render detailed probability bars
    probBarsContainer.innerHTML = '';
    
    // Sort probabilities descending
    const sortedProbs = Object.entries(data.all_probabilities)
        .sort((a, b) => b[1] - a[1]);

    sortedProbs.forEach(([className, probValue]) => {
        const classConfig = tumorTypeConfig[className] || { name: className, colorClass: '' };
        
        const probItem = document.createElement('div');
        probItem.className = `prob-item ${classConfig.colorClass}`;
        
        probItem.innerHTML = `
            <div class="prob-header">
                <span class="prob-name">${classConfig.name}</span>
                <span class="prob-val">${probValue}%</span>
            </div>
            <div class="prob-bar-bg">
                <div class="prob-bar-fill" style="width: 0%"></div>
            </div>
        `;
        
        probBarsContainer.appendChild(probItem);
        
        // Trigger animation after a slight delay
        setTimeout(() => {
            const barFill = probItem.querySelector('.prob-bar-fill');
            barFill.style.width = `${probValue}%`;
        }, 50);
    });

    // Render YOLO probability bars
    yoloProbBarsContainer.innerHTML = '';
    if (data.tumor_location && data.tumor_location.source === 'yolo' && data.tumor_location.yolo_class) {
        const yClass = data.tumor_location.yolo_class.toLowerCase().replace(' ', '');
        const classConfig = tumorTypeConfig[yClass] || { name: data.tumor_location.yolo_class, colorClass: '' };
        const conf = (data.tumor_location.yolo_conf * 100).toFixed(1);
        
        const probItem = document.createElement('div');
        probItem.className = `prob-item ${classConfig.colorClass}`;
        probItem.innerHTML = `
            <div class="prob-header">
                <span class="prob-name">${classConfig.name}</span>
                <span class="prob-val">${conf}%</span>
            </div>
            <div class="prob-bar-bg">
                <div class="prob-bar-fill" style="width: 0%; background: var(--warning);"></div>
            </div>
        `;
        yoloProbBarsContainer.appendChild(probItem);
        setTimeout(() => { probItem.querySelector('.prob-bar-fill').style.width = `${conf}%`; }, 50);
    } else {
        yoloProbBarsContainer.innerHTML = '<span style="font-size:0.85rem;color:var(--text-secondary);">YOLO không nhận diện được khối u rõ ràng.</span>';
    }
}

// Print functionality
document.getElementById('btn-print').addEventListener('click', () => {
    window.print();
});

// --- Active Learning & Feedback Module ---
const btnFeedbackMode = document.getElementById('btn-feedback-mode');
const feedbackPanel = document.getElementById('feedback-panel');
const btnCancelFeedback = document.getElementById('btn-cancel-feedback');
const btnSubmitFeedback = document.getElementById('btn-submit-feedback');
const drawCanvas = document.getElementById('draw-canvas');
const ctx = drawCanvas.getContext('2d');
const correctClassSelect = document.getElementById('correct-class-select');

let isFeedbackMode = false;
let isDrawing = false;
let startX = 0, startY = 0;
let drawRect = { x: 0, y: 0, w: 0, h: 0 };

// Toggle Feedback Mode
if(btnFeedbackMode) {
    btnFeedbackMode.addEventListener('click', () => {
        isFeedbackMode = true;
        feedbackPanel.classList.remove('hidden');
        drawCanvas.classList.remove('hidden');
        
        // Set canvas dimensions to match the displayed image EXACTLY
        const imgRect = imagePreview.getBoundingClientRect();
        drawCanvas.width = imgRect.width;
        drawCanvas.height = imgRect.height;
        
        // Cố định kích thước ảnh để vẽ chính xác
        imagePreview.style.width = imgRect.width + 'px';
        imagePreview.style.height = imgRect.height + 'px';
    });
}

if(btnCancelFeedback) {
    btnCancelFeedback.addEventListener('click', () => {
        isFeedbackMode = false;
        feedbackPanel.classList.add('hidden');
        drawCanvas.classList.add('hidden');
        ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        drawRect = { x: 0, y: 0, w: 0, h: 0 };
        // Bỏ cố định kích thước ảnh
        imagePreview.style.width = '';
        imagePreview.style.height = '';
    });
}

// Canvas Drawing Logic
if(drawCanvas) {
    drawCanvas.addEventListener('mousedown', (e) => {
        if (!isFeedbackMode) return;
        isDrawing = true;
        const rect = drawCanvas.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        
        // Reset previous rect
        drawRect = { x: 0, y: 0, w: 0, h: 0 };
    });

    drawCanvas.addEventListener('mousemove', (e) => {
        if (!isDrawing || !isFeedbackMode) return;
        const rect = drawCanvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        
        drawRect.x = Math.min(startX, currentX);
        drawRect.y = Math.min(startY, currentY);
        drawRect.w = Math.abs(currentX - startX);
        drawRect.h = Math.abs(currentY - startY);
        
        // Clear and redraw
        ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        
        // Draw semi-transparent overlay outside the box
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
        ctx.clearRect(drawRect.x, drawRect.y, drawRect.w, drawRect.h);
        
        // Draw box border (Neon Orange/Warning)
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.strokeRect(drawRect.x, drawRect.y, drawRect.w, drawRect.h);
        
        // Draw corner points
        ctx.fillStyle = '#f59e0b';
        const pSize = 5;
        ctx.fillRect(drawRect.x - pSize/2, drawRect.y - pSize/2, pSize, pSize);
        ctx.fillRect(drawRect.x + drawRect.w - pSize/2, drawRect.y - pSize/2, pSize, pSize);
        ctx.fillRect(drawRect.x - pSize/2, drawRect.y + drawRect.h - pSize/2, pSize, pSize);
        ctx.fillRect(drawRect.x + drawRect.w - pSize/2, drawRect.y + drawRect.h - pSize/2, pSize, pSize);
    });

    drawCanvas.addEventListener('mouseup', () => { isDrawing = false; });
    drawCanvas.addEventListener('mouseleave', () => { isDrawing = false; });
}

// Submit Feedback
if(btnSubmitFeedback) {
    btnSubmitFeedback.addEventListener('click', async () => {
        if (!selectedFile) return;
        if (drawRect.w === 0 || drawRect.h === 0) {
            alert('LỖI: Bạn chưa dùng chuột vẽ khung trên ảnh! Vui lòng vẽ khung khoanh vùng khối u trước khi Gửi phản hồi.');
            return;
        }

        const originalText = btnSubmitFeedback.innerHTML;
        btnSubmitFeedback.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...';
        btnSubmitFeedback.disabled = true;

        // Tính tọa độ scale theo ảnh gốc
        const scaleX = imagePreview.naturalWidth / drawCanvas.width;
        const scaleY = imagePreview.naturalHeight / drawCanvas.height;

        const realX = Math.round(drawRect.x * scaleX);
        const realY = Math.round(drawRect.y * scaleY);
        const realW = Math.round(drawRect.w * scaleX);
        const realH = Math.round(drawRect.h * scaleY);

        const formData = new FormData();
        formData.append('file', selectedFile); // Gửi luôn file gốc mà bác sĩ đã tải lên
        formData.append('correct_class', correctClassSelect.value);
        formData.append('x', realX);
        formData.append('y', realY);
        formData.append('w', realW);
        formData.append('h', realH);

        try {
            const response = await fetch('http://127.0.0.1:8000/feedback', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Lỗi server');
            
            alert('🎉 THÀNH CÔNG! Phản hồi của Bác sĩ đã được ghi nhận vào Sổ tay học tập. AI sẽ tự động học lại từ tọa độ và nhãn này.');
            btnCancelFeedback.click(); // Đóng giao diện vẽ
        } catch (error) {
            console.error(error);
            alert('Không thể kết nối đến hệ thống máy chủ.');
        } finally {
            btnSubmitFeedback.innerHTML = originalText;
            btnSubmitFeedback.disabled = false;
        }
    });
}

// =====================================================================
// GEMINI MULTI-AGENT INTEGRATION
// =====================================================================

// Agent 1 & Agent 2: Report Auto-drafting & Patient Translation
let currentDraftReport = "";
const geminiReportPanel = document.getElementById('gemini-report-panel');
const geminiDraftTextarea = document.getElementById('gemini-draft-report');
const pendingBadge = document.querySelector('.pending-badge');

async function generateMedicalReport(resnetData) {
    if(!geminiReportPanel) return;
    geminiReportPanel.classList.remove('hidden');
    geminiDraftTextarea.value = "Agent 1 (Bác sĩ AI) đang biên soạn báo cáo... Vui lòng chờ.";
    
    try {
        const response = await fetch("http://127.0.0.1:8000/generate_clinical_report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resnet_data: resnetData })
        });
        const data = await response.json();
        if(data.draft_report) {
            currentDraftReport = data.draft_report;
            geminiDraftTextarea.value = currentDraftReport;
        } else {
            geminiDraftTextarea.value = "Lỗi sinh báo cáo.";
        }
    } catch(e) {
        geminiDraftTextarea.value = "LỖI NGOẠI TUYẾN: Không thể kết nối với Agent 1.";
    }
}

if(document.getElementById('btn-approve-report')) {
    document.getElementById('btn-approve-report').addEventListener('click', () => {
        pendingBadge.textContent = "✅ ĐÃ PHÊ DUYỆT BỞI BÁC SĨ";
        pendingBadge.style.background = "#10b981";
        pendingBadge.style.color = "#fff";
        geminiDraftTextarea.readOnly = true;
        alert("Báo cáo đã được xác nhận và lưu vào hệ thống bệnh án.");
    });
}

if(document.getElementById('btn-edit-report')) {
    document.getElementById('btn-edit-report').addEventListener('click', () => {
        geminiDraftTextarea.readOnly = false;
        geminiDraftTextarea.focus();
        pendingBadge.textContent = "✏️ ĐANG CHỈNH SỬA";
        pendingBadge.style.background = "#3b82f6";
    });
}

if(document.getElementById('btn-reject-report')) {
    document.getElementById('btn-reject-report').addEventListener('click', () => {
        geminiDraftTextarea.value = "";
        geminiReportPanel.classList.add('hidden');
    });
}

if(document.getElementById('btn-translate-report')) {
    document.getElementById('btn-translate-report').addEventListener('click', async () => {
        if(pendingBadge.textContent.includes("BẢN NHÁP") || pendingBadge.textContent.includes("ĐANG CHỈNH SỬA")) {
            alert("Vui lòng Xác nhận & Lưu báo cáo (Approve) trước khi phiên dịch cho bệnh nhân để đảm bảo an toàn y khoa.");
            return;
        }
        
        const btnTranslate = document.getElementById('btn-translate-report');
        const originalText = btnTranslate.innerHTML;
        btnTranslate.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Agent 2 đang dịch...';
        btnTranslate.disabled = true;
        
        try {
            const response = await fetch("http://127.0.0.1:8000/translate_for_patient", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clinical_report: geminiDraftTextarea.value })
            });
            const data = await response.json();
            if(data.translated_report) {
                geminiDraftTextarea.value += "\n\n==============================\nBẢN DỊCH CHO BỆNH NHÂN (AGENT 2):\n==============================\n" + data.translated_report;
            }
        } catch (e) {
            alert("Lỗi dịch báo cáo.");
        } finally {
            btnTranslate.innerHTML = originalText;
            btnTranslate.disabled = false;
        }
    });
}

// Agent 3 & Agent 4: Chatbox & Meeting Summarizer
const sidebar = document.getElementById('assistant-sidebar');
const btnToggleAssistant = document.getElementById('btn-toggle-assistant');
const btnCloseSidebar = document.getElementById('close-sidebar');

if(btnToggleAssistant && sidebar) {
    btnToggleAssistant.addEventListener('click', () => sidebar.classList.toggle('hidden'));
    btnCloseSidebar.addEventListener('click', () => sidebar.classList.add('hidden'));
}

const btnSendChat = document.getElementById('btn-send-chat');
const chatInput = document.getElementById('chat-input-field');
const chatHistory = document.getElementById('chat-history');

if(btnSendChat) {
    btnSendChat.addEventListener('click', async () => {
        const msg = chatInput.value.trim();
        if(!msg) return;
        
        const userDiv = document.createElement('div');
        userDiv.style = "background: rgba(255,255,255,0.1); padding: 10px; border-radius: 8px; text-align: right; margin-left: 20px; font-size: 0.9rem; color: #fff;";
        userDiv.textContent = msg;
        chatHistory.appendChild(userDiv);
        chatInput.value = "";
        
        const loadingDiv = document.createElement('div');
        loadingDiv.style = "padding: 10px; color: #38bdf8; font-size: 0.9rem;";
        loadingDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Agent 3 đang tra cứu RAG...';
        chatHistory.appendChild(loadingDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        
        try {
            const response = await fetch("http://127.0.0.1:8000/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ doctor_id: "DR_001", message: msg })
            });
            const data = await response.json();
            
            chatHistory.removeChild(loadingDiv);
            
            const aiDiv = document.createElement('div');
            aiDiv.style = "background: rgba(56, 189, 248, 0.1); padding: 10px; border-radius: 8px; border: 1px solid rgba(56, 189, 248, 0.2); font-size: 0.9rem; margin-right: 20px; color: #fff;";
            if(data.error) {
                aiDiv.style.border = "1px solid #ef4444";
                aiDiv.style.background = "rgba(239, 68, 68, 0.2)";
                aiDiv.style.color = "#fca5a5";
                aiDiv.textContent = data.error;
            } else {
                aiDiv.innerHTML = data.answer.replace(/\n/g, "<br>");
            }
            chatHistory.appendChild(aiDiv);
            chatHistory.scrollTop = chatHistory.scrollHeight;
        } catch(e) {
            chatHistory.removeChild(loadingDiv);
            const errDiv = document.createElement('div');
            errDiv.style = "color: #ef4444;";
            errDiv.textContent = "Lỗi kết nối đến Backend.";
            chatHistory.appendChild(errDiv);
        }
    });

    chatInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') btnSendChat.click();
    });
}

if(document.getElementById('btn-summarize-meeting')) {
    document.getElementById('btn-summarize-meeting').addEventListener('click', async () => {
        const logs = Array.from(chatHistory.children).map(div => div.textContent).join('\n');
        
        const aiDiv = document.createElement('div');
        aiDiv.style = "background: rgba(16, 185, 129, 0.1); padding: 10px; border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.2); font-size: 0.9rem; color: #fff; margin-top: 15px;";
        aiDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Agent 4 đang tổng hợp hội chẩn...';
        chatHistory.appendChild(aiDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        
        try {
            const response = await fetch("http://127.0.0.1:8000/summarize_meeting", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_logs: logs })
            });
            const data = await response.json();
            if(data.summary) {
                aiDiv.innerHTML = "<strong style='color: #34d399;'><i class='fa-solid fa-file-contract'></i> TÓM TẮT HỘI CHẨN (AGENT 4):</strong><br><br>" + data.summary.replace(/\n/g, "<br>");
            } else {
                aiDiv.textContent = "Lỗi tổng hợp.";
            }
        } catch(e) {
            aiDiv.textContent = "Ngoại tuyến: Không thể gọi Agent 4.";
        }
    });
}

