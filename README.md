# pey.visualization

[![AI](https://img.shields.io/badge/Built%20with-AI-blueviolet)](#)
[![version](https://img.shields.io/badge/version-1.0.0-blue.svg)](#)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Bonyan Architecture](https://img.shields.io/badge/bonyan-0.11-56c3bf)](https://github.com/barnevis/bonyan)

## هدف

افزونه‌ی ویژگی (feature) از زیست‌بوم پی برای مصورسازی داده: میزبان دادهٔ آماده و تنظیمات نمایش را می‌دهد؛ افزونه چهارده نوع نمودار در پنج خانواده را در ظرف میزبان رسم می‌کند، تعاملات متداول (tooltip، سوییچ سری با راهنما، گزارش کلیک) را ارائه می‌دهد و به منطق مصرف‌کننده‌ها خنثی می‌ماند. کتابخانهٔ رسم (Observable Plot) پشت آداپتور داخلی پنهان است و در رابط سرویس نشانی ندارد.

## ساختار

- `adapters/` — تنها مرز با کتابخانهٔ رسم.
- `docs/` — سندهای پروژه.
- `lib/` — سرویس، اعتبارسنجی داده، نرمال‌سازی گزینه‌ها و انبار نمودارها.
- `tests/` — آزمون‌های افزونه.
- `index.js` — نقطه‌ی ورود.
- `manifest.json` — قرارداد افزونه.

## وابستگی‌ها

- **الزامی:** ندارد.
- **اختیاری:** ندارد.

## نصب و استفاده

افزونه با `manifest.json` و بستهٔ npm به برنامه‌ی میزبان افزوده می‌شود و پس از دو فاز آماده‌سازی و فعال‌سازی، سرویس `pey.visualization.service` را عرضه می‌کند. وابستگی npm آن (`@observablehq/plot`) داخل افزونه پنهان است و مصرف‌کننده نیازی به شناختش ندارد. میزبان با `create` نمودار می‌سازد، با `update` به‌روز می‌کند و با `remove` برمی‌دارد؛ جزئیات کامل در [مرجع](docs/reference.md).

## مجوز

این پروژه با مجوز MIT منتشر شده است؛ متن کامل در [LICENSE](LICENSE).

## سندهای مرتبط

- [معرفی](docs/introduction.md) — شناخت افزونه به زبان ساده.
- [مرجع](docs/reference.md) — API، رویدادها، خطاها و پیکربندی.
- [نیازمندی‌ها](docs/requirements.md) — سند ساخت افزونه، مکتوب پیش از پیاده‌سازی.
