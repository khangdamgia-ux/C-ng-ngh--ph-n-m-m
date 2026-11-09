# Nguồn ảnh địa điểm

Ảnh `.jpg` lấy từ **Wikimedia Commons** (giấy phép tự do, thường là CC BY / CC BY-SA).
Khi đưa sản phẩm ra công khai, hãy ghi tên tác giả và giấy phép theo trang gốc của từng ảnh.

| Mã địa điểm | Trang gốc trên Commons | Ghi chú |
|---|---|---|
| nha-co-phung-hung | https://commons.wikimedia.org/wiki/File:DGJ_0967_-_Phung_Hung_Old_House_(3415825802).jpg | |
| hoi-quan-trieu-chau | https://commons.wikimedia.org/wiki/File:Trieu_Chau_Assembly_Hall.jpg | |
| cho-hoi-an | https://commons.wikimedia.org/wiki/File:Central_Market_Hoi_An.JPG | |
| bao-tang-gom-su | https://commons.wikimedia.org/wiki/File:Hội_An,_Museum_of_Trade_Ceramics,_2020-01_CN-02.jpg | |
| bao-tang-hoi-an | https://commons.wikimedia.org/wiki/File:Hoi_An_Museum_main_building.jpg | |
| cho-dem-an-hoi | https://commons.wikimedia.org/wiki/File:Lanterns_in_Hoi_An_4.jpg | Ảnh đèn lồng Hội An (đại diện cho phố đèn lồng) |
| bao-tang-sa-huynh | https://commons.wikimedia.org/wiki/File:Pottery_burial_jar_Sa_Huynh_Cultue.JPG | Ảnh hiện vật mộ chum văn hóa Sa Huỳnh, không phải mặt tiền bảo tàng |
| nha-tho-toc-tran | (ảnh do nhóm dự án cung cấp, đã có sẵn trong thư mục) | Cổng “Tổ từ tộc Trần”; kiểm tra quyền sử dụng trước khi công khai |

## Ảnh tự tìm (Phần 2 của script)

`hoi-quan-hai-nam`, `nha-co-quan-thang` chưa có ảnh tự do được chọn sẵn, nên script **tự tìm trên Wikimedia Commons**
(Hải Nam: trong chuyên mục *Category:Hainan Assembly Hall*). Tên file và trang gốc của ảnh tải về được ghi vào `NGUON-ANH-TU-DONG.txt`.
Ảnh chọn tự động **cần kiểm tra lại bằng mắt**; nếu sai địa điểm, xóa file `.jpg` đó. Nếu không tìm thấy, web giữ ảnh minh họa `.svg`.

Cách khác: tự chụp / chọn ảnh rồi dán link vào ô **URL ảnh đại diện** trong Admin (ưu tiên cao nhất), hoặc lưu thành `apps/web/public/places/<mã>.jpg`.
