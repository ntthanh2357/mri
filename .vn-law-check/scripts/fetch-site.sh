#!/usr/bin/env bash
# Tải các trang công khai của một website về thư mục để scan.sh quét.
#
#   scripts/fetch-site.sh <url> [thư-mục-đích]
#
# Chỉ tải những gì ai mở trình duyệt cũng thấy:
#   - trang chủ (kèm response header, để nhận biết hosting)
#   - tối đa 15 trang cùng tên miền được link từ trang chủ, có tên gợi ý chính sách,
#     điều khoản, liên hệ, sản phẩm, giỏ hàng, thanh toán, đăng nhập, đăng ký
#   - tối đa 20 file JavaScript cùng tên miền (site dựng bằng React/Next/Vue thường
#     chỉ lộ form, tracking trong file JS)
# Không gửi dữ liệu đi đâu ngoài các request GET tới chính website đó.

set -uo pipefail

URL="${1:-}"
OUT="${2:-$(mktemp -d)}"
MAX_PAGES=15
MAX_JS=20
UA="vn-law-check (+https://github.com/mhfed/vn-law-check)"
CURL=(curl -sSL --max-time 20 --max-filesize 5000000 -A "$UA")

if [[ ! "$URL" =~ ^https?:// ]]; then
  echo "Cách dùng: scripts/fetch-site.sh https://ten-mien.vn [thư-mục]" >&2
  exit 1
fi
command -v curl >/dev/null || { echo "Cần cài curl" >&2; exit 1; }

origin="$(printf '%s' "$URL" | sed -E 's|^(https?://[^/?#]+).*|\1|')"
scheme="${origin%%://*}"
mkdir -p "$OUT/pages" "$OUT/js"

# Đổi link tương đối thành URL đầy đủ, bỏ link sang tên miền khác
resolve() {
  local href="$1"
  href="${href%%#*}"
  case "$href" in
    ""|mailto:*|tel:*|javascript:*|data:*) return ;;
    //*) href="$scheme:$href" ;;
    /*) href="$origin$href" ;;
    http://*|https://*) ;;
    *) href="$origin/$href" ;;
  esac
  [[ "$href" == "$origin"* ]] && printf '%s\n' "$href"
}

safe_name() { printf '%s' "$1" | sed -E "s#^$origin##; s#[^A-Za-z0-9._-]+#_#g; s#^_##" | cut -c1-80; }

echo "Tải trang chủ: $URL"
if ! "${CURL[@]}" -D "$OUT/response-headers.txt" "$URL" -o "$OUT/pages/index.html"; then
  echo "Không tải được $URL" >&2
  exit 1
fi

links="$(grep -oE 'href="[^"]+"|href='"'"'[^'"'"']+'"'" "$OUT/pages/index.html" | sed -E "s/^href=[\"']//; s/[\"']$//")"
pages="$(while read -r h; do resolve "$h"; done <<< "$links" \
  | grep -iE 'chinh-sach|bao-mat|privacy|policy|dieu-khoan|terms|lien-he|contact|san-pham|product|cart|gio-hang|checkout|thanh-toan|login|dang-nhap|signin|register|dang-ky|signup' \
  | sort -u | head -n "$MAX_PAGES")"

n=0
while read -r p; do
  [ -z "$p" ] && continue
  "${CURL[@]}" "$p" -o "$OUT/pages/$(safe_name "$p").html" && n=$((n + 1))
done <<< "$pages"
echo "Tải thêm $n trang liên quan"

scripts="$(cat "$OUT"/pages/*.html | grep -oE '<script[^>]+src="[^"]+"' | sed -E 's/.*src="//; s/"$//')"
js="$(while read -r s; do resolve "$s"; done <<< "$scripts" | sort -u | head -n "$MAX_JS")"

m=0
while read -r j; do
  [ -z "$j" ] && continue
  "${CURL[@]}" "$j" -o "$OUT/js/$(safe_name "$j").js" && m=$((m + 1))
done <<< "$js"
echo "Tải $m file JavaScript cùng tên miền"
echo "Đã lưu vào: $OUT"
