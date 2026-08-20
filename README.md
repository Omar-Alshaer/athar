# ATHR — أثر (Frontend V1)

واجهة أولية عملية لمتجر أثر للمنتجات الرقمية، مبنية بـ HTML/CSS/JavaScript بدون أي اعتمادات خارجية.

## التشغيل

```bash
cd athr-store
python3 -m http.server 8080
```

ثم افتح: `http://localhost:8080`

## الموجود حاليًا
- Home RTL responsive
- متجر مع بحث، فلترة وترتيب
- صفحة منتج ديناميكية
- سلة تسوق بـ localStorage
- Checkout تجريبي وتأكيد طلب
- صفحة عن أثر
- هوية لونية مستوحاة من اللوجو
- Responsive desktop/mobile

## الخطوة التالية للإنتاج
تحويل الواجهة إلى Next.js + PostgreSQL وإضافة Authentication وAdmin Dashboard وPayment Gateway وPrivate Storage وMy Library.
